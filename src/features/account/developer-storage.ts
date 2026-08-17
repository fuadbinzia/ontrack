import AsyncStorage from '@react-native-async-storage/async-storage';

import { STORAGE_KEYS } from '@/services/storage';

export type StorageSizeRow = {
  id: string;
  label: string;
  bytes: number;
};

const LABELS: Record<string, string> = {
  [STORAGE_KEYS.schedule]: 'Schedule',
  [STORAGE_KEYS.preferences]: 'Preferences',
  [STORAGE_KEYS.themeOverrides]: 'Theme overrides',
  [STORAGE_KEYS.plants]: 'Plants',
  [STORAGE_KEYS.addons]: 'Add-ons',
  [STORAGE_KEYS.agents]: 'Agents',
  [STORAGE_KEYS.travel]: 'Travel',
  [STORAGE_KEYS.checklists]: 'Checklists',
  [STORAGE_KEYS.authAccess]: 'Auth access',
  [STORAGE_KEYS.visionBoard]: 'Vision board',
  [STORAGE_KEYS.vehicles]: 'Vehicles',
  [STORAGE_KEYS.health]: 'Health (device)',
  [STORAGE_KEYS.flightParserMemory]: 'Flight parser memory',
  [STORAGE_KEYS.usageAnalytics]: 'Usage Analytics',
  [STORAGE_KEYS.devMode]: 'Dev Mode sandbox',
};

function byteLength(value: string | null): number {
  if (!value) return 0;
  return value.length * 2;
}

export async function listLocalStorageSizes(): Promise<StorageSizeRow[]> {
  const keys = Object.values(STORAGE_KEYS);
  const pairs = await AsyncStorage.multiGet(keys);
  return pairs
    .map(([key, value]) => ({
      id: key,
      label: LABELS[key] ?? key.replace(/^ontrack\//, ''),
      bytes: byteLength(value),
    }))
    .sort((a, b) => b.bytes - a.bytes);
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
