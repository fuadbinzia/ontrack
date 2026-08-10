import { TravelCurrencySheetContent } from './travel-currency-sheet-content';
import type { TravelPlan } from '@/features/travel/types';

export function TravelCurrencySheet({
  plan,
  visible,
  onClose,
}: {
  plan: TravelPlan;
  visible: boolean;
  onClose: () => void;
}) {
  const sheetKey = `${plan.id}-${visible ? 'open' : 'closed'}`;
  return (
    <TravelCurrencySheetContent
      key={sheetKey}
      plan={plan}
      visible={visible}
      onClose={onClose}
    />
  );
}
