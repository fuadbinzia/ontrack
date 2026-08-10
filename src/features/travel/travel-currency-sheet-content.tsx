import type { TravelPlan } from '@/features/travel/types';

import { TravelCurrencySheetBody } from './travel-currency-sheet-body';
import { useTravelCurrencySheetState } from './use-travel-currency-sheet-state';

export function TravelCurrencySheetContent({
  plan,
  visible,
  onClose,
}: {
  plan: TravelPlan;
  visible: boolean;
  onClose: () => void;
}) {
  const state = useTravelCurrencySheetState({ plan, visible });
  return <TravelCurrencySheetBody state={state} onClose={onClose} />;
}
