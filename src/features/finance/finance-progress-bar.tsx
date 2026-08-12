import { View } from 'react-native';

import { useResponsive } from '@/hooks/use-responsive';
import { useTheme } from '@/hooks/use-theme';

export function FinanceProgressBar({ progress }: { progress: number }) {
  const theme = useTheme();
  const { s } = useResponsive();
  return (
    <View
      style={{
        height: s(8),
        borderRadius: s(999),
        backgroundColor: theme.separator,
        overflow: 'hidden',
      }}>
      <View
        style={{
          width: `${Math.round(Math.min(1, Math.max(0, progress)) * 100)}%`,
          height: '100%',
          backgroundColor: theme.accentPrimary,
        }}
      />
    </View>
  );
}
