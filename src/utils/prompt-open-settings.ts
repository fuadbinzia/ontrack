import { Linking } from 'react-native';

import { appPrompt } from '@/components/primitives';

/** Branded prompt that opens the OS app settings page (iOS and Android). */
export function promptOpenAppSettings(title: string, message: string) {
  appPrompt.alert(title, message, [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Open Settings', onPress: () => Linking.openSettings() },
  ]);
}
