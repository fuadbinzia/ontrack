import { StyleSheet, View } from 'react-native';

import { categoryColors, radii, spacing } from '@/design-system';
import { useTheme } from '@/hooks/use-theme';
import type { ActivityCategory } from '@/types/models';
import { AppText, Symbol } from '@/components/primitives';

interface CategoryIconProps {
  category: ActivityCategory;
  size?: number;
}

/** Tinted circular icon for an activity category. */
export function CategoryIcon({ category, size = 40 }: CategoryIconProps) {
  const theme = useTheme();
  const colors = categoryColors(theme, category.colorKey);
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: colors.tint,
        alignItems: 'center',
        justifyContent: 'center',
      }}>
      <Symbol name={category.icon} size={size * 0.45} color={colors.main} />
    </View>
  );
}

interface CategoryBadgeProps {
  category: ActivityCategory;
  /** Accent rim when the badge is the selected control. */
  selected?: boolean;
  /** `large` = vibe picker chips (bigger type + tap target). */
  size?: 'default' | 'large';
}

/** Small pill label with the category color. */
export function CategoryBadge({
  category,
  selected = false,
  size = 'default',
}: CategoryBadgeProps) {
  const theme = useTheme();
  const colors = categoryColors(theme, category.colorKey);
  const large = size === 'large';
  return (
    <View
      style={[
        styles.badge,
        large ? styles.badgeLarge : null,
        {
          backgroundColor: colors.tint,
          borderColor: selected ? theme.accentPrimary : 'transparent',
        },
      ]}>
      <AppText variant={large ? 'callout' : 'caption'} fit={large} style={{ color: colors.main }}>
        {category.name}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    borderRadius: radii.pill,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xxs,
    alignSelf: 'flex-start',
  },
  badgeLarge: {
    minHeight: 44,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    justifyContent: 'center',
  },
});
