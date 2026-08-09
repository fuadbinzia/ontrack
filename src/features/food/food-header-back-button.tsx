import type { ComponentProps } from 'react';

import { HeaderBackButton } from '@/components/primitives';

type Props = Omit<ComponentProps<typeof HeaderBackButton>, 'compact' | 'fallback'> & {
  fallback?: ComponentProps<typeof HeaderBackButton>['fallback'];
};

/**
 * Compact eyebrow-row back for Food stack screens.
 * Always dismisses to Food home when history cannot (default fallback was `/`).
 */
export function FoodHeaderBackButton({
  fallback = '/(tabs)/food',
  ...rest
}: Props) {
  return <HeaderBackButton compact fallback={fallback} {...rest} />;
}
