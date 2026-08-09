import { HeaderBackButton, ScreenHeader } from '@/components/primitives';
import { FoodScreen } from '@/features/food/food-screen';
import { PlanShoppingPanel } from '@/features/food/plan-shopping';
import { PlanWeekPanel } from '@/features/food/plan-week';
import { useResponsive } from '@/hooks/use-responsive';

/**
 * Meal Plan & Shopping — SCREENS.md §10. The week grid writes `useMealPlan`;
 * the shopping panel is a bridge onto the existing todos grocery list.
 */
export default function FoodPlanScreen() {
  const { spacing } = useResponsive();

  return (
    <FoodScreen contentStyle={{ gap: spacing.xl }}>
      <ScreenHeader
        eyebrow="Food"
        title="Plan & Shopping"
        subtitle="This week's meals and what to buy for them"
        leading={<HeaderBackButton compact />}
      />
      <PlanWeekPanel />
      <PlanShoppingPanel />
    </FoodScreen>
  );
}
