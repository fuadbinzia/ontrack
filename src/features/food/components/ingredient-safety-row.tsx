import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import {
    AppText,
    Card,
    GlassIconWell,
    StatusBadge,
    statusBadgeToneColor,
    Symbol,
    type StatusBadgeTone,
} from '@/components/primitives';
import type { AppIconName } from '@/design-system';
import type { PhoneWidthClass } from '@/design-system/responsive';
import { foodTestIdSlug } from '@/features/food/food-slug';
import { useResponsive } from '@/hooks/use-responsive';
import { useTheme } from '@/hooks/use-theme';
import type { IngredientSafetyLevel } from '@/services/food/safety';
import type { AllergySeverity } from '@/types/food';
import { AgentUiIds } from '@/utils/agent-ui';

/** `avoided` = preference/intolerance flag — deliberately not an allergy severity. */
export type IngredientSafetyStatus = 'safe' | 'avoided' | AllergySeverity;

/** Map a profile assessment level to a row badge (`unknown` → no badge at all). */
export function ingredientSafetyStatusForLevel(
  level: IngredientSafetyLevel,
): IngredientSafetyStatus | undefined {
  switch (level) {
    case 'none':
      return 'safe';
    case 'unknown':
      return undefined;
    default:
      return level;
  }
}

export interface IngredientSafetyRowProps {
  name: string;
  status: IngredientSafetyStatus;
  /** One-line reason preview, e.g. "Contains peanuts". */
  reason?: string;
  /** Disclosure — opens the ingredient detail. */
  onPress?: () => void;
  testID?: string;
  style?: StyleProp<ViewStyle>;
}

/** Severity is never color-only: tone + icon + label always travel together. */
export function ingredientSafetyTone(
  status: IngredientSafetyStatus,
): StatusBadgeTone {
  switch (status) {
    case 'safe':
      return 'success';
    case 'mild':
    case 'avoided':
      return 'neutral';
    case 'moderate':
      return 'warning';
    case 'severe':
      return 'danger';
  }
}

export function ingredientSafetyIcon(
  status: IngredientSafetyStatus,
): AppIconName {
  switch (status) {
    case 'safe':
      return 'check';
    case 'mild':
      return 'allergy';
    case 'avoided':
      return 'minus-circle';
    default:
      return 'warning';
  }
}

export function ingredientSafetyLabel(status: IngredientSafetyStatus): string {
  switch (status) {
    case 'safe':
      return 'No Conflicts Found';
    case 'avoided':
      return 'Avoided';
    case 'mild':
      return 'Mild';
    case 'moderate':
      return 'Moderate';
    case 'severe':
      return 'Severe';
  }
}

/**
 * Reason placement: inline beside the title where space permits; on compact
 * phones it moves below the title instead of shrinking (component spec).
 */
export function ingredientSafetyReasonPlacement(
  widthClass: PhoneWidthClass,
): 'inline' | 'below' {
  return widthClass === 'compact' ? 'below' : 'inline';
}

/** Stable testID key from a display name (not an entity id). */
export function ingredientSafetyRowKey(name: string): string {
  return foodTestIdSlug(name);
}

/**
 * Ingredient safety verdict row: severity icon well, name, one-line reason,
 * and an icon+text status badge (never color-only).
 */
export function IngredientSafetyRow({
  name,
  status,
  reason,
  onPress,
  testID,
  style,
}: IngredientSafetyRowProps) {
  const theme = useTheme();
  const { spacing, s, widthClass } = useResponsive();
  const tone = ingredientSafetyTone(status);
  const toneColor = statusBadgeToneColor(tone, theme);
  const label = ingredientSafetyLabel(status);
  const placement = ingredientSafetyReasonPlacement(widthClass);
  const rowTestID =
    testID ?? AgentUiIds.food.ingredients.row(ingredientSafetyRowKey(name));
  // Screen-reader order per spec: name → status → short explanation.
  const a11yLabel = [name, label, reason].filter(Boolean).join(', ');

  return (
    <Card
      padded={false}
      onPress={onPress}
      accessibilityLabel={a11yLabel}
      testID={rowTestID}
      style={style}>
      <View
        style={[
          styles.row,
          { minHeight: s(56), padding: spacing.md, gap: spacing.md },
        ]}>
        <GlassIconWell size={Math.max(36, s(38))}>
          <Symbol
            name={ingredientSafetyIcon(status)}
            size="sm"
            color={toneColor}
          />
        </GlassIconWell>
        <View style={[styles.body, { gap: spacing.xxs }]}>
          <View style={[styles.titleRow, { gap: spacing.sm }]}>
            <AppText
              variant="body"
              numberOfLines={1}
              style={styles.shrinkText}>
              {name}
            </AppText>
            {placement === 'inline' && reason ? (
              <AppText
                variant="caption"
                color="secondary"
                numberOfLines={1}
                testID={rowTestID ? `${rowTestID}.reasonInline` : undefined}
                style={styles.reasonInline}>
                {reason}
              </AppText>
            ) : null}
          </View>
          {placement === 'below' && reason ? (
            <AppText
              variant="caption"
              color="secondary"
              testID={rowTestID ? `${rowTestID}.reasonBelow` : undefined}>
              {reason}
            </AppText>
          ) : null}
        </View>
        <StatusBadge label={label} tone={tone} />
        {onPress ? (
          <Symbol name="chevron-right" size="sm" color={theme.textTertiary} />
        ) : null}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  body: {
    flex: 1,
    minWidth: 0,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  shrinkText: {
    flexShrink: 1,
    minWidth: 0,
  },
  reasonInline: {
    flex: 1,
    minWidth: 0,
  },
});
