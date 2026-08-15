import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { createJSONStorage, type StateStorage } from 'zustand/middleware';

export const STORAGE_KEYS = {
  schedule: 'ontrack/schedule/v1',
  preferences: 'ontrack/preferences/v1',
  themeOverrides: 'ontrack/theme-overrides/v1',
  plants: 'ontrack/plants/v1',
  addons: 'ontrack/addons/v1',
  agents: 'ontrack/agents/v1',
  travel: 'ontrack/travel/v1',
  travelMap: 'ontrack/travel-map/v1',
  /** Device-local expand/collapse chrome for trip detail (not cloud-synced). */
  travelPlanUi: 'ontrack/travel-plan-ui/v1',
  todos: 'ontrack/todos/v1',
  authAccess: 'ontrack/auth-access/v1',
  visionBoard: 'ontrack/vision-board/v1',
  vehicles: 'ontrack/vehicles/v1',
  health: 'ontrack/health/v1',
  journal: 'ontrack/journal/v1',
  finance: 'ontrack/finance/v1',
  /** Device-local index of durable E-ZPass source files; never cloud-synced. */
  financeEzPassStatements: 'ontrack/finance-ezpass-statements/v1',
  foodProfile: 'ontrack/food-profile/v1',
  foodPantry: 'ontrack/food-pantry/v1',
  foodRecipes: 'ontrack/food-recipes/v1',
  foodMealPlan: 'ontrack/food-meal-plan/v1',
  flightParserMemory: 'ontrack/travel-flight-parser-memory/v1',
  usageAnalytics: 'ontrack/usage-analytics/v1',
  flowAnalytics: 'ontrack/flow-analytics/v1',
  /** Developer-only, device-local hourly process performance rollups. */
  performanceHistory: 'ontrack/performance-history/v1',
  /** Floating tab carousel order by last focus (device-local). */
  tabRecency: 'ontrack/tab-recency/v1',
  /** Pinned bottom-nav trackers + Trackers page order (device-local). */
  tabPins: 'ontrack/tab-pins/v1',
  /** Device-local Overview attention acknowledgements; source records stay unchanged. */
  overviewAttention: 'ontrack/overview-attention/v1',
  /** Dev Mode toggle + live-account snapshot (sandbox isolation). */
  devMode: 'ontrack/dev-mode/v1',
} as const;

const MIGRATION_FLAG = 'ontrack/storage/mmkv-migrated/v1';
/** Never block cold start on a native module that fails to resolve. */
const MMKV_INIT_TIMEOUT_MS = 400;

type PersistBackend = StateStorage & {
  kind: 'mmkv' | 'async';
};

let backendPromise: Promise<PersistBackend> | undefined;
let sensitiveBackendPromise: Promise<PersistBackend> | undefined;

const SENSITIVE_KEY_NAME = 'ontrack.health.storage-key.v1';
const SENSITIVE_KEY_OPTIONS: SecureStore.SecureStoreOptions = {
  keychainService: 'com.imtihoss.ontracknow.health-storage',
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};

function asyncBackend(): PersistBackend {
  return {
    kind: 'async',
    getItem: (name) => AsyncStorage.getItem(name),
    setItem: (name, value) => AsyncStorage.setItem(name, value),
    removeItem: (name) => AsyncStorage.removeItem(name),
  };
}

function memoryBackend(): PersistBackend {
  const values = new Map<string, string>();
  return {
    kind: 'async',
    getItem: async (name) => values.get(name) ?? null,
    setItem: async (name, value) => {
      values.set(name, value);
    },
    removeItem: async (name) => {
      values.delete(name);
    },
  };
}

function withTimeout<T>(promise: Promise<T>, ms: number, fallback: () => T): Promise<T> {
  return new Promise((resolve) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      resolve(fallback());
    }, ms);
    void promise.then(
      (value) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve(value);
      },
      () => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve(fallback());
      },
    );
  });
}

async function migrateAsyncStorageToMmkv(mmkv: {
  getString: (key: string) => string | undefined;
  set: (key: string, value: string) => void;
  contains: (key: string) => boolean;
}) {
  if (mmkv.contains(MIGRATION_FLAG)) return;
  const keys = Object.values(STORAGE_KEYS);
  await Promise.all(
    keys.map(async (key) => {
      if (mmkv.contains(key)) return;
      const value = await AsyncStorage.getItem(key);
      if (value != null) mmkv.set(key, value);
    }),
  );
  mmkv.set(MIGRATION_FLAG, '1');
}

async function tryMmkvBackend(): Promise<PersistBackend | null> {
  if (Platform.OS === 'web') return null;
  try {
    // Prefer sync require so Metro/native init cannot hang an `import()`.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { createMMKV } = require('react-native-mmkv') as typeof import('react-native-mmkv');
    const mmkv = createMMKV({ id: 'ontrack-persist' });
    await migrateAsyncStorageToMmkv(mmkv);
    return {
      kind: 'mmkv',
      getItem: (name) => mmkv.getString(name) ?? null,
      setItem: (name, value) => {
        mmkv.set(name, value);
      },
      removeItem: (name) => {
        mmkv.remove(name);
      },
    };
  } catch {
    return null;
  }
}

async function createBackend(): Promise<PersistBackend> {
  if (Platform.OS === 'web') return asyncBackend();
  const mmkv = await withTimeout(
    tryMmkvBackend(),
    MMKV_INIT_TIMEOUT_MS,
    () => null,
  );
  return mmkv ?? asyncBackend();
}

async function sensitiveEncryptionKey(): Promise<string> {
  const existing = await SecureStore.getItemAsync(SENSITIVE_KEY_NAME, SENSITIVE_KEY_OPTIONS);
  if (existing) return existing;
  const created = Crypto.randomUUID().replace(/-/g, '') + Crypto.randomUUID().replace(/-/g, '');
  await SecureStore.setItemAsync(SENSITIVE_KEY_NAME, created, SENSITIVE_KEY_OPTIONS);
  return created;
}

async function createSensitiveBackend(): Promise<PersistBackend> {
  if (Platform.OS === 'web') return memoryBackend();
  try {
    const key = await sensitiveEncryptionKey();
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { createMMKV } = require('react-native-mmkv') as typeof import('react-native-mmkv');
    const mmkv = createMMKV({ id: 'ontrack-sensitive', encryptionKey: key });
    return {
      kind: 'mmkv',
      getItem: (name) => mmkv.getString(name) ?? null,
      setItem: (name, value) => {
        mmkv.set(name, value);
      },
      removeItem: (name) => {
        mmkv.remove(name);
      },
    };
  } catch {
    // Sensitive records must never silently fall back to unencrypted native storage.
    return memoryBackend();
  }
}

function getBackend() {
  backendPromise ??= createBackend();
  return backendPromise;
}

function getSensitiveBackend() {
  sensitiveBackendPromise ??= createSensitiveBackend();
  return sensitiveBackendPromise;
}

/**
 * Persistence adapter for client stores. Prefers MMKV on native (with a
 * one-time AsyncStorage migration); falls back to AsyncStorage on web /
 * when the native module is unavailable or slow to initialize.
 */
export function createPersistStorage<T>() {
  const storage: StateStorage = {
    getItem: async (name) => (await getBackend()).getItem(name),
    setItem: async (name, value) => {
      await (await getBackend()).setItem(name, value);
    },
    removeItem: async (name) => {
      await (await getBackend()).removeItem(name);
    },
  };
  return createJSONStorage<T>(() => storage);
}

/** Encrypted, device-only persistence for health and other sensitive records. */
export function createSensitivePersistStorage<T>() {
  const storage: StateStorage = {
    getItem: async (name) => (await getSensitiveBackend()).getItem(name),
    setItem: async (name, value) => {
      await (await getSensitiveBackend()).setItem(name, value);
    },
    removeItem: async (name) => {
      await (await getSensitiveBackend()).removeItem(name);
    },
  };
  return createJSONStorage<T>(() => storage);
}

/** Remove persisted values without reaching into a backend-specific API. */
export async function removePersistedStorageItems(
  keys: readonly string[],
  options?: { sensitive?: boolean },
): Promise<void> {
  const backend = options?.sensitive ? await getSensitiveBackend() : await getBackend();
  await Promise.all(keys.map((key) => backend.removeItem(key)));
}

/** Test helper — reset cached backend between suites. */
export function resetPersistBackendForTests() {
  backendPromise = undefined;
  sensitiveBackendPromise = undefined;
}
