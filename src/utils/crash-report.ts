import Constants from 'expo-constants';
import * as Device from 'expo-device';
import { Platform } from 'react-native';

import { resolveExpoApiUrl } from '@/services/http/api-url';

const MAX_REPORT_CHARS = 40_000;
const SEND_TIMEOUT_MS = 10_000;

export type CrashReportInput = {
  error: Error;
  /** Optional route / screen hint when known. */
  context?: string;
};

export type CrashReportSendResult =
  | { method: 'sent' }
  | { method: 'unavailable'; reason: string };

function safeComponent(value: unknown): string {
  if (typeof value === 'string' && value.trim()) return value.trim();
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return '—';
}

/** Build plain-text diagnostics for the server-delivered support email. */
export function buildCrashLogText(input: CrashReportInput): string {
  const { error, context } = input;
  const appVersion = safeComponent(
    Constants.nativeAppVersion ?? Constants.expoConfig?.version,
  );
  const build = safeComponent(
    Constants.nativeBuildVersion ??
      Constants.expoConfig?.ios?.buildNumber ??
      Constants.expoConfig?.android?.versionCode,
  );
  const lines = [
    'onTrack crash report',
    `Generated: ${new Date().toISOString()}`,
    '',
    '— App —',
    `Version: ${appVersion} (${build})`,
    `Platform: ${Platform.OS} ${safeComponent(Platform.Version)}`,
    context ? `Context: ${context}` : null,
    '',
    '— Device —',
    `Brand: ${safeComponent(Device.brand)}`,
    `Model: ${safeComponent(Device.modelName)}`,
    `OS: ${safeComponent(Device.osName)} ${safeComponent(Device.osVersion)}`,
    '',
    '— Error —',
    `Name: ${safeComponent(error.name)}`,
    `Message: ${safeComponent(error.message)}`,
    '',
    '— Stack —',
    error.stack?.trim() || '(no stack)',
  ];
  return lines.filter((line) => line !== null).join('\n');
}

export function crashReportSubject(error: Error): string {
  const short = (error.message || error.name || 'Unknown error')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80);
  return `onTrack crash: ${short || 'Unknown error'}`;
}

function crashReportApiUrl(): string {
  return resolveExpoApiUrl('/api/crash-report', {
    configuredBaseUrl: process.env.EXPO_PUBLIC_API_BASE_URL,
    requireHttpsInProduction: true,
    createNotConfiguredError: () =>
      new Error('Crash reporting is not configured for this build.'),
  });
}

/** Deliver diagnostics without opening the device share sheet or email client. */
export async function sendCrashReport(
  input: CrashReportInput,
): Promise<CrashReportSendResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), SEND_TIMEOUT_MS);

  try {
    const response = await fetch(crashReportApiUrl(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        subject: crashReportSubject(input.error),
        report: buildCrashLogText(input).slice(0, MAX_REPORT_CHARS),
      }),
      signal: controller.signal,
    });
    if (!response.ok) {
      return {
        method: 'unavailable',
        reason: 'We could not send the report. Check your connection and try again.',
      };
    }
    return { method: 'sent' };
  } catch {
    return {
      method: 'unavailable',
      reason: 'We could not send the report. Check your connection and try again.',
    };
  } finally {
    clearTimeout(timer);
  }
}
