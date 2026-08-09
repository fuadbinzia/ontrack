import type { ComponentProps } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Screen } from '@/components/primitives';
import { useResponsive } from '@/hooks/use-responsive';

type FoodScreenProps = ComponentProps<typeof Screen>;

/**
 * Food page shell: `Screen` with the width-class content gutter
 * (compact 14 / regular 16 / large 20) instead of the default screen padding.
 */
export function FoodScreen({ padded = true, contentStyle, ...rest }: FoodScreenProps) {
  const insets = useSafeAreaInsets();
  const { gutter } = useResponsive();

  return (
    <Screen
      {...rest}
      padded={false}
      contentStyle={{
        ...(padded
          ? {
              paddingLeft: insets.left + gutter,
              paddingRight: insets.right + gutter,
            }
          : null),
        ...contentStyle,
      }}
    />
  );
}
