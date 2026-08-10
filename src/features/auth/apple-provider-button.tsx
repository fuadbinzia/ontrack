import type { Ref } from 'react';
import type { LayoutChangeEvent, View } from 'react-native';

import { authPalette } from './auth-palette';
import { ProviderButton } from './provider-button';
import { AppleMark } from './provider-marks';

export function AppleProviderButton({
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
  // Dusty-blue mock: Apple fill is ink charcoal, not pure black.
  const backgroundColor = dark ? '#FFFFFF' : authPalette.ink;
  const textColor = dark ? authPalette.ink : '#FFFFFF';
  return (
    <ProviderButton
      icon={<AppleMark color={textColor} />}
      onPress={onPress}
      disabled={disabled}
      backgroundColor={backgroundColor}
      borderColor={backgroundColor}
      textColor={textColor}
      testID={testID}
      buttonRef={buttonRef}
      onLayout={onLayout}
      accessibilityLabel="Continue with Apple">
      Continue with Apple
    </ProviderButton>
  );
}
