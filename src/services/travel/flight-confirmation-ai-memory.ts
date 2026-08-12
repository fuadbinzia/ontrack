import * as Crypto from 'expo-crypto';

import { createSensitivePersistStorage, STORAGE_KEYS } from '@/services/storage';

import type { FlightConfirmationAIResult } from './flight-confirmation-ai-types';

const MAX_ENTRIES = 48;
const MAX_AGE_MS = 365 * 24 * 60 * 60 * 1000;

type MemoryEntry = {
  fingerprint: string;
  result: FlightConfirmationAIResult;
  learnedAt: string;
  lastUsedAt: string;
};

type MemoryState = {
  entries: MemoryEntry[];
};

export type FlightConfirmationAIMemory = {
  read: (redactedText: string) => Promise<FlightConfirmationAIResult | undefined>;
  write: (redactedText: string, result: FlightConfirmationAIResult) => Promise<void>;
};

const storage = createSensitivePersistStorage<MemoryState>();

function canonicalText(value: string) {
  return value
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

async function fingerprint(value: string) {
  return Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    canonicalText(value),
  );
}

function validResult(value: unknown): value is FlightConfirmationAIResult {
  if (!value || typeof value !== 'object') return false;
  const row = value as Partial<FlightConfirmationAIResult>;
  return (
    Array.isArray(row.segments) &&
    row.segments.length > 0 &&
    row.segments.every(
      (segment) =>
        segment &&
        typeof segment === 'object' &&
        typeof segment.confidence === 'number' &&
        segment.confidence >= 0.55,
    ) &&
    Array.isArray(row.itineraryDates)
  );
}

async function readState(): Promise<MemoryState> {
  const stored = await storage?.getItem(STORAGE_KEYS.flightParserMemory);
  const entries = stored?.state?.entries;
  if (!Array.isArray(entries)) return { entries: [] };
  const cutoff = Date.now() - MAX_AGE_MS;
  return {
    entries: entries.filter(
      (entry) =>
        entry &&
        typeof entry.fingerprint === 'string' &&
        Date.parse(entry.learnedAt) >= cutoff &&
        validResult(entry.result),
    ),
  };
}

async function writeState(state: MemoryState) {
  await storage?.setItem(STORAGE_KEYS.flightParserMemory, {
    state,
    version: 1,
  });
}

export const flightConfirmationAIMemory: FlightConfirmationAIMemory = {
  async read(redactedText) {
    const key = await fingerprint(redactedText);
    const state = await readState();
    const found = state.entries.find((entry) => entry.fingerprint === key);
    if (!found) return undefined;
    found.lastUsedAt = new Date().toISOString();
    await writeState({
      entries: [
        found,
        ...state.entries.filter((entry) => entry.fingerprint !== key),
      ].slice(0, MAX_ENTRIES),
    });
    return found.result;
  },

  async write(redactedText, result) {
    if (!validResult(result)) return;
    const key = await fingerprint(redactedText);
    const now = new Date().toISOString();
    const state = await readState();
    await writeState({
      entries: [
        { fingerprint: key, result, learnedAt: now, lastUsedAt: now },
        ...state.entries.filter((entry) => entry.fingerprint !== key),
      ].slice(0, MAX_ENTRIES),
    });
  },
};

export async function clearFlightConfirmationAIMemory(): Promise<void> {
  await storage?.removeItem(STORAGE_KEYS.flightParserMemory);
}
