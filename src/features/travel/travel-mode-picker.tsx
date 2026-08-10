import { View } from 'react-native';

import { SegmentedControl } from '@/components/primitives';
import { TRAVEL_TRANSPORT_MODES } from '@/features/travel/travel-mode';
import type { TravelTransportMode } from '@/features/travel/types';
import { useResponsive } from '@/hooks/use-responsive';
import { AgentUiIds } from '@/utils/agent-ui';

function chunks<T>(items: readonly T[], size: number): T[][] {
  const rows: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    rows.push(items.slice(index, index + size));
  }
  return rows;
}

export function TravelTransportModePicker({
  value,
  onChange,
}: {
  value: TravelTransportMode;
  onChange: (value: TravelTransportMode) => void;
}) {
  const { spacing } = useResponsive();
  return (
    <View style={{ gap: spacing.xs }}>
      {chunks(TRAVEL_TRANSPORT_MODES, 2).map((row, index) => (
        <SegmentedControl
          key={index}
          label={index === 0 ? 'Transport mode' : undefined}
          value={value}
          options={row.map((option) => ({
            ...option,
            testID: AgentUiIds.travel.transport.mode(option.value),
          }))}
          onChange={onChange}
        />
      ))}
    </View>
  );
}
