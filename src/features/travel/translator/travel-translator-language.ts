import { getDisplayNamesFormatter } from '@/utils/intl-cache';

import type {
  TravelTranslatorDirection,
  TravelTranslatorLanguage,
} from './travel-translator-types';

const LANGUAGE_TAG = /^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/;

const COMMON_LANGUAGE_CODES = [
  'en-US',
  'es-ES',
  'fr-FR',
  'de-DE',
  'it-IT',
  'pt-BR',
  'nl-NL',
  'el-GR',
  'tr-TR',
  'ar-SA',
  'he-IL',
  'hi-IN',
  'th-TH',
  'vi-VN',
  'id-ID',
  'ja-JP',
  'ko-KR',
  'zh-CN',
] as const;

function primaryLanguageCode(tag: string): string {
  return tag.split('-')[0].toLowerCase();
}

function displayNameForLanguage(code: string): string {
  const language = primaryLanguageCode(code);
  if (typeof Intl.DisplayNames !== 'function') return language;
  try {
    return getDisplayNamesFormatter(['en'], { type: 'language' }).of(language) ?? code;
  } catch {
    return language;
  }
}

export function languageFromLocale(locale: string): TravelTranslatorLanguage {
  const fallback = 'en-US';
  const candidate = locale && locale !== 'system' ? locale.replace('_', '-') : fallback;
  const speechLocale = LANGUAGE_TAG.test(candidate) ? candidate : fallback;
  return {
    code: primaryLanguageCode(speechLocale),
    displayName: displayNameForLanguage(speechLocale),
    speechLocale,
  };
}

export function isTravelTranslatorLanguage(
  value: unknown,
): value is TravelTranslatorLanguage {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const row = value as Record<string, unknown>;
  return (
    Object.keys(row).every((key) =>
      ['code', 'displayName', 'speechLocale'].includes(key),
    ) &&
    typeof row.code === 'string' &&
    LANGUAGE_TAG.test(row.code) &&
    row.code.length <= 35 &&
    typeof row.displayName === 'string' &&
    row.displayName.trim().length > 0 &&
    row.displayName.length <= 80 &&
    typeof row.speechLocale === 'string' &&
    LANGUAGE_TAG.test(row.speechLocale) &&
    row.speechLocale.length <= 35
  );
}

export function normalizeTravelTranslatorLanguage(
  value: TravelTranslatorLanguage,
): TravelTranslatorLanguage {
  return {
    code: value.code.trim(),
    displayName: value.displayName.trim(),
    speechLocale: value.speechLocale.trim().replace('_', '-'),
  };
}

export function commonTravelTranslatorLanguages(): TravelTranslatorLanguage[] {
  return COMMON_LANGUAGE_CODES.map(languageFromLocale);
}

export function mergeTravelTranslatorLanguages(
  ...groups: readonly TravelTranslatorLanguage[][]
): TravelTranslatorLanguage[] {
  const seen = new Set<string>();
  return groups.flat().filter((language) => {
    const key = language.speechLocale.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function languagesForDirection(
  direction: TravelTranslatorDirection,
  home: TravelTranslatorLanguage,
  destination: TravelTranslatorLanguage,
): { source: TravelTranslatorLanguage; target: TravelTranslatorLanguage } {
  return direction === 'home-to-destination'
    ? { source: home, target: destination }
    : { source: destination, target: home };
}

export function reverseTravelTranslatorDirection(
  direction: TravelTranslatorDirection,
): TravelTranslatorDirection {
  return direction === 'home-to-destination'
    ? 'destination-to-home'
    : 'home-to-destination';
}

export const TRAVEL_TRANSLATOR_QUICK_PHRASES = [
  'Hello',
  'Thank you',
  'Where is the restroom?',
  'How much is this?',
] as const;
