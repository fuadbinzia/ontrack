import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const KEY_PREFIX = 'ontrack.finance.plaid.access.';

export async function savePlaidAccessToken(
  itemId: string,
  accessToken: string,
): Promise<void> {
  if (Platform.OS === 'web') return;
  await SecureStore.setItemAsync(`${KEY_PREFIX}${itemId}`, accessToken);
}

export async function loadPlaidAccessToken(
  itemId: string,
): Promise<string | undefined> {
  if (Platform.OS === 'web') return undefined;
  return (await SecureStore.getItemAsync(`${KEY_PREFIX}${itemId}`)) ?? undefined;
}

export async function deletePlaidAccessToken(itemId: string): Promise<void> {
  if (Platform.OS === 'web') return;
  await SecureStore.deleteItemAsync(`${KEY_PREFIX}${itemId}`);
}
