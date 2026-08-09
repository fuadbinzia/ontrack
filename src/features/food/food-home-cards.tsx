import { ScrollView, StyleSheet, View } from 'react-native';

import {
  ActionChip,
  AppText,
  Card,
  GlassIconWell,
  LoadingBlock,
  StatusBadge,
  Symbol,
  type StatusBadgeTone,
} from '@/components/primitives';
import { useResponsive } from '@/hooks/use-responsive';
import { useTheme } from '@/hooks/use-theme';
import {
  AvatarStack,
  NutritionStat,
  type AvatarStackPerson,
} from '@/features/food/components';
import { ScheduledMealRow } from '@/features/food/scheduled-meal-row';
import type {
  ScheduledMeal,
  ScheduledMealNutrition,
} from '@/store/food-selectors';
import type { PantryItem } from '@/types/food';
import { formatDateLong, isPast, isToday, todayKey } from '@/utils/date';
import { AgentUiIds } from '@/utils/agent-ui';

// ── Today's meals ────────────────────────────────────────────────────────

/** Today's meal summary — rows into the existing food detail route. */
export function FoodHomeTodayCard({
  meals,
  onOpenMeal,
}: {
  meals: readonly ScheduledMeal[];
  onOpenMeal: (activityId: string) => void;
}) {
  const { spacing } = useResponsive();

  return (
    <Card padded={false} style={{ paddingHorizontal: spacing.lg, paddingVertical: spacing.sm }}>
      {meals.length === 0 ? (
        <AppText
          variant="callout"
          color="secondary"
          style={{ paddingVertical: spacing.md }}>
          No meals yet today — add one and it lands on your timeline.
        </AppText>
      ) : (
        meals.map((entry) => (
          <ScheduledMealRow
            key={entry.activity.id}
            entry={entry}
            testID={AgentUiIds.food.home.todayRow(entry.activity.id)}
            onPress={() => onOpenMeal(entry.activity.id)}
          />
        ))
      )}
    </Card>
  );
}

// ── Pantry use-soon ──────────────────────────────────────────────────────

const PANTRY_PREVIEW_COUNT = 4;

/** "Expired" / "Use today" / "Use by March 5" — text always beside tone. */
export function pantryUseByStatus(
  bestByDate: string,
  anchor = todayKey(),
): { label: string; tone: StatusBadgeTone } {
  if (isPast(bestByDate)) return { label: 'Expired', tone: 'danger' };
  if (isToday(bestByDate) || bestByDate === anchor) {
    return { label: 'Use today', tone: 'warning' };
  }
  return { label: `By ${formatDateLong(bestByDate)}`, tone: 'warning' };
}

/** Pantry "use soon" card driven by `expiringSoon` (items carry bestByDate). */
export function FoodHomePantryCard({
  items,
  onScan,
}: {
  items: readonly PantryItem[];
  onScan: () => void;
}) {
  const { spacing } = useResponsive();
  const preview = items.slice(0, PANTRY_PREVIEW_COUNT);
  const overflow = items.length - preview.length;

  if (items.length === 0) {
    return (
      <Card style={{ gap: spacing.md }}>
        <AppText variant="callout" color="secondary">
          Your pantry is empty — scan or add ingredients as you shop.
        </AppText>
        <View style={styles.chipRow}>
          <ActionChip
            label="Scan ingredients"
            icon="scan"
            testID={AgentUiIds.food.home.pantryScan}
            onPress={onScan}
          />
        </View>
      </Card>
    );
  }

  return (
    <Card style={{ gap: spacing.sm }}>
      {preview.map((item) => {
        const status = pantryUseByStatus(item.bestByDate!);
        return (
          <View
            key={item.id}
            accessible
            accessibilityLabel={`${item.displayLabel}, ${status.label}`}
            style={[styles.row, { gap: spacing.md, minHeight: spacing.xl }]}>
            <AppText variant="body" numberOfLines={1} style={styles.grow}>
              {item.displayLabel}
            </AppText>
            <StatusBadge label={status.label} tone={status.tone} />
          </View>
        );
      })}
      {overflow > 0 ? (
        <AppText variant="caption" color="tertiary">
          {`+${overflow} more expiring soon`}
        </AppText>
      ) : null}
    </Card>
  );
}

// ── Leftover Rescue ──────────────────────────────────────────────────────

/** One-tap bridge into AI ideas seeded around leftovers. */
export function FoodHomeLeftoverCard({ onPress }: { onPress: () => void }) {
  const theme = useTheme();
  const { spacing, s } = useResponsive();

  return (
    <Card
      padded={false}
      onPress={onPress}
      accessibilityLabel="Leftover Rescue"
      testID={AgentUiIds.food.home.leftoverCard}>
      <View style={[styles.row, { padding: spacing.lg, gap: spacing.md }]}>
        <GlassIconWell size={Math.max(40, s(42))}>
          <Symbol name="leftover" size="sm" color={theme.accentPrimary} />
        </GlassIconWell>
        <View style={[styles.grow, { gap: spacing.xxs }]}>
          <AppText variant="subheading" numberOfLines={1}>
            Leftover Rescue
          </AppText>
          <AppText variant="caption" color="secondary" numberOfLines={2}>
            {"Turn what's left in the fridge into tomorrow's plan."}
          </AppText>
        </View>
        <Symbol name="chevron-right" size="sm" color={theme.textTertiary} />
      </View>
    </Card>
  );
}

// ── Nutrition snapshot ───────────────────────────────────────────────────

/** Today's macro tiles; quiet single-line copy until a meal is logged. */
export function FoodHomeNutrition({ totals }: { totals: ScheduledMealNutrition }) {
  const { spacing } = useResponsive();

  if (totals.loggedItemCount === 0) {
    return (
      <AppText variant="callout" color="secondary">
        {"Log a meal and today's macros build here."}
      </AppText>
    );
  }

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ gap: spacing.sm }}>
      <NutritionStat value={`${Math.round(totals.calories)}`} label="Calories" />
      <NutritionStat value={`${Math.round(totals.proteinG)}g`} label="Protein" />
      <NutritionStat value={`${Math.round(totals.carbsG)}g`} label="Carbs" />
      <NutritionStat value={`${Math.round(totals.fatG)}g`} label="Fat" />
    </ScrollView>
  );
}

// ── Friends / community preview ──────────────────────────────────────────

/** Friends summary — the Community feed lives at /food/community. */
export function FoodHomeCommunity({
  people,
  loading = false,
}: {
  people: readonly AvatarStackPerson[];
  loading?: boolean;
}) {
  const { spacing } = useResponsive();

  if (loading && people.length === 0) {
    return (
      <Card>
        <LoadingBlock compact label="Checking in with friends…" />
      </Card>
    );
  }

  return (
    <Card style={[styles.row, { gap: spacing.md }]}>
      {people.length > 0 ? (
        <>
          <AvatarStack people={people} />
          <AppText variant="callout" color="secondary" style={styles.grow} numberOfLines={2}>
            {`${people.length} ${people.length === 1 ? 'friend' : 'friends'} to swap recipes with — share what you cook in Community.`}
          </AppText>
        </>
      ) : (
        <AppText variant="callout" color="secondary" style={styles.grow} numberOfLines={2}>
          {"Add friends and you'll see what they're cooking here."}
        </AppText>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  grow: {
    flex: 1,
    flexShrink: 1,
    minWidth: 0,
  },
  chipRow: {
    flexDirection: 'row',
  },
});
