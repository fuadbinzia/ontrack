import * as Linking from 'expo-linking';
import { Platform } from 'react-native';

import { googleMapsUrl } from '@/features/travel/address-map-link';

export function wazeNavigateUrl(query: string): string {
  return `waze://?q=${encodeURIComponent(query)}&navigate=yes`;
}

export function wazeHttpsNavigateUrl(query: string): string {
  return `https://waze.com/ul?q=${encodeURIComponent(query)}&navigate=yes`;
}

/**
 * Explicit maps/Waze handoff (in-app-browser exception: OS navigation apps).
 * Tries Waze first, then Google Maps.
 */
export async function openNavigateTo(query: string): Promise<{ opened: 'waze' | 'maps' }> {
  const trimmed = query.trim();
  if (!trimmed) throw new Error('No destination to navigate to.');
  const waze = wazeNavigateUrl(trimmed);
  try {
    if (await Linking.canOpenURL(waze)) {
      await Linking.openURL(waze);
      return { opened: 'waze' };
    }
  } catch {
    // Fall through to HTTPS Waze / Maps.
  }
  try {
    await Linking.openURL(wazeHttpsNavigateUrl(trimmed));
    return { opened: 'waze' };
  } catch {
    await Linking.openURL(googleMapsUrl(trimmed) ?? `https://maps.google.com/?q=${encodeURIComponent(trimmed)}`);
    return { opened: 'maps' };
  }
}

export async function openDeviceAssistant(): Promise<{ opened: boolean; reason?: string }> {
  if (Platform.OS !== 'android') {
    return {
      opened: false,
      reason: 'Siri cannot be started from onTrack. Ask me to do that instead.',
    };
  }
  try {
    await Linking.sendIntent('android.intent.action.VOICE_COMMAND');
    return { opened: true };
  } catch {
    return { opened: false, reason: 'Google Assistant could not be opened.' };
  }
}
