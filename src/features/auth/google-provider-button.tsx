import type { Ref } from 'react';
import type { LayoutChangeEvent, View } from 'react-native';

import { ProviderButton } from './provider-button';
import { GoogleMark } from './provider-marks';

/**
 * Google's two permitted button treatments. On the night sky the light slab
 * reads as a cut-out, so dark appearance gets the dark treatment.
 */
const LIGHT = { background: '#FFFFFF', border: '#DADCE0', text: '#3C4043' };
const DARK = { background: '#131314', border: '#8E918F', text: '#E3E3E3' };

export function GoogleProviderButton({
  onPress,
  disabled,
  dark,
  testID,
  buttonRef,
  onLayout,
}: {
  onPress: () => void;
  disabled?: boolean;
  dark: boolean;
  testID?: string;
  buttonRef?: Ref<View>;
  onLayout?: (event: LayoutChangeEvent) => void;
}) {
  const scheme = dark ? DARK : LIGHT;
  return (
    <ProviderButton
      icon={<GoogleMark />}
      onPress={onPress}
      disabled={disabled}
      backgroundColor={scheme.background}
      borderColor={scheme.border}
      textColor={scheme.text}
      testID={testID}
      buttonRef={buttonRef}
      onLayout={onLayout}
      accessibilityLabel="Continue with Google">
      Continue with Google
    </ProviderButton>
  );
}
