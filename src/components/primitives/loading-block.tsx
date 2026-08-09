import { StyleSheet, View } from 'react-native';

import { spacing } from '@/design-system';
import { useResponsive } from '@/hooks/use-responsive';
import { AppText } from './app-text';
import { LoadingSpinner } from './loading-spinner';

interface LoadingBlockProps {
  label?: string;
  /** Compact padding for inline loaders inside forms/lists. */
  compact?: boolean;
}

/** Shared centered loading indicator for screens and panels. */
export function LoadingBlock({
  label,
  compact = false,
}: LoadingBlockProps) {
  const { s } = useResponsive();

  return (
    <View style={[styles.container, compact && styles.compact]}>
      <LoadingSpinner size={compact ? Math.max(22, s(24)) : Math.max(28, s(32))} />
      {label ? (
        <AppText variant="callout" color="secondary" align="center" fit={compact}>
          {label}
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xxl,
  },
  compact: {
    paddingVertical: spacing.md,
  },
});
