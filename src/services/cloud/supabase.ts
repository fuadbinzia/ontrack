import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';

const developmentAuthStorage = new Map<string, string>();

function isMissingDevelopmentEntitlement(error: unknown): boolean {
  return (
    __DEV__ &&
    error instanceof Error &&
    /required entitlement isn't present|errSecMissingEntitlement/i.test(error.message)
  );
}

const secureStorage = {
  getItem: async (key: string) => {
    try {
      return await SecureStore.getItemAsync(key);
    } catch (error) {
      if (!isMissingDevelopmentEntitlement(error)) throw error;
      return developmentAuthStorage.get(key) ?? null;
    }
  },
  setItem: async (key: string, value: string) => {
    try {
      await SecureStore.setItemAsync(key, value);
    } catch (error) {
      if (!isMissingDevelopmentEntitlement(error)) throw error;
      developmentAuthStorage.set(key, value);
    }
  },
  removeItem: async (key: string) => {
    try {
      await SecureStore.deleteItemAsync(key);
    } catch (error) {
      if (!isMissingDevelopmentEntitlement(error)) throw error;
      developmentAuthStorage.delete(key);
    }
  },
};

/**
 * Node 25+ exposes a broken global `localStorage` (getItem is not a function)
 * that crashes Expo's SSR/Metro path during Fast Refresh. Only use real Storage.
 */
function getUsableWebStorage(): Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> | null {
  try {
    const storage = (globalThis as { localStorage?: Storage }).localStorage;
    if (!storage || typeof storage.getItem !== 'function') return null;
    return storage;
  } catch {
    return null;
  }
}

// Web cannot use SecureStore. localStorage remains XSS-readable; keep the web
// surface minimal, enforce CSP, and prefer native builds for full auth sessions.
const webStorage = {
  getItem: (key: string) => getUsableWebStorage()?.getItem(key) ?? null,
  setItem: (key: string, value: string) => {
    getUsableWebStorage()?.setItem(key, value);
  },
  removeItem: (key: string) => {
    getUsableWebStorage()?.removeItem(key);
  },
};

let client: SupabaseClient | undefined;

/** Returns undefined until the high-compliance cloud environment is configured. */
export function getSupabaseClient(): SupabaseClient | undefined {
  if (client) return client;
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !publishableKey) return undefined;
  client = createClient(url, publishableKey, {
    auth: {
      storage: process.env.EXPO_OS === 'web' ? webStorage : secureStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
      flowType: 'pkce',
    },
  });
  return client;
}
