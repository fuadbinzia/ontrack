import { StyleSheet } from 'react-native';

import { AppText } from '@/components/primitives';

/**
 * Header wordmark — readable size, natural tracking.
 * Do not use overline + wide letterSpacing (that fragments "onTrack").
 */
export function AuthWordmark({
  color = 'primary',
}: {
  color?: 'primary' | 'accent';
}) {
  return (
    <AppText variant="subheading" color={color} style={styles.mark}>
      onTrack
    </AppText>
  );
}

const styles = StyleSheet.create({
  mark: {
    letterSpacing: 0,
    flexShrink: 0,
  },
});
