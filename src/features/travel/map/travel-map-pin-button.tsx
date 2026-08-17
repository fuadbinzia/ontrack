import { memo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { shadows } from '@/design-system/shadows';
import { ProfileAvatar } from '@/features/account/profile-avatar';
import { AgentTestId } from '@/utils/agent-ui';

import type { TravelMapPerson } from './types';

/** Memoized — globe frames and chrome state changes reuse settled pins. */
export const TravelMapPinButton = memo(function TravelMapPinButton({
  testID,
  label,
  people,
  left,
  top,
  selected,
  onPress,
}: {
  testID: string;
  label: string;
  people: TravelMapPerson[];
  left: number;
  top: number;
  selected?: boolean;
  onPress: () => void;
}) {
  const primary = people[0];
  return (
    <AgentTestId
      testID={testID}
      label={label}
      onPress={onPress}
      style={[styles.pinHit, { left: left - 22, top: top - 22 }]}
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
            borderColor: selected ? '#FFFFFF' : 'rgba(255,255,255,0.72)',
            borderWidth: selected ? 3 : 2,
            transform: [{ scale: pressed ? 0.92 : selected ? 1.12 : 1 }],
          },
        ]}
      >
        {primary ? (
          <ProfileAvatar
            displayName={primary.displayName}
            userId={primary.userId}
            avatar={primary.avatar}
            isSelf={primary.isSelf}
            size={30}
            borderColor={primary.color}
            borderWidth={2}
            accessibilityLabel={`${primary.displayName} map pin`}
          />
        ) : null}
        {people.slice(1, 4).map((person, index) => (
          <View
            key={person.userId}
            style={[styles.extraAvatar, { right: -4 + index * 8 }]}
          >
            <ProfileAvatar
              displayName={person.displayName}
              userId={person.userId}
              avatar={person.avatar}
              isSelf={person.isSelf}
              size={12}
              borderColor={person.color}
              borderWidth={1.5}
            />
          </View>
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
    backgroundColor: 'transparent',
  },
  extraAvatar: {
    position: 'absolute',
    bottom: -3,
  },
});
