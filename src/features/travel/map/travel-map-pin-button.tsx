import { memo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Symbol } from '@/components/primitives';
import { shadows } from '@/design-system/shadows';
import { AgentTestId } from '@/utils/agent-ui';

/** Memoized — globe frames and chrome state changes reuse settled pins. */
export const TravelMapPinButton = memo(function TravelMapPinButton({
  testID,
  label,
  colors,
  left,
  top,
  selected,
  onPress,
}: {
  testID: string;
  label: string;
  colors: string[];
  left: number;
  top: number;
  selected?: boolean;
  onPress: () => void;
}) {
  const primary = colors[0] ?? '#155EA8';
  return (
    <AgentTestId
      testID={testID}
      label={label}
      onPress={onPress}
      style={[styles.pinHit, { left: left - 22, top: top - 36 }]}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        onPress={onPress}
        hitSlop={4}
        style={({ pressed }) => [
          styles.pinButton,
          shadows.card,
          {
            borderColor: selected ? '#FFFFFF' : 'rgba(255,255,255,0.78)',
            borderWidth: selected ? 3 : 2,
            backgroundColor: `${primary}E8`,
            transform: [{ scale: pressed ? 0.92 : selected ? 1.12 : 1 }],
          },
        ]}
      >
        <Symbol name="map-pin" size={20} color="#FFFFFF" />
        {colors.slice(1, 4).map((color, index) => (
          <View
            key={color}
            style={[
              styles.colorDot,
              { backgroundColor: color, right: -3 + index * 7 },
            ]}
          />
        ))}
      </Pressable>
    </AgentTestId>
  );
});

const styles = StyleSheet.create({
  pinHit: {
    position: 'absolute',
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pinButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  colorDot: {
    position: 'absolute',
    bottom: -3,
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
});
