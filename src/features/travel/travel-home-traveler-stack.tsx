import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/primitives';
import { ProfileAvatar } from '@/features/account/profile-avatar';
import type { CoTravelerAvatarPerson } from '@/features/travel/travel-cotraveler-stack';
import { TravelHomeGlass } from '@/features/travel/travel-home-glass';
import {
    travelHomeFontFamily,
    travelHomeTokens,
} from '@/features/travel/travel-home-tokens';
import { useResponsive } from '@/hooks/use-responsive';
import { useTheme } from '@/hooks/use-theme';
import { AgentTestId } from '@/utils/agent-ui';
import { haptics } from '@/utils/haptics';

/**
 * Pair threshold: 1–2 travelers show every face; 3+ collapses to self + +N.
 * (`TRAVEL_HOME_TRAVELER_PAIR_SLOTS` = max faces without a count chip.)
 */
export const TRAVEL_HOME_TRAVELER_PAIR_SLOTS = 2;

/** How many faces render and how many collapse into the +N chip. */
export function travelHomeTravelerStackSplit(total: number): {
  visible: number;
  overflow: number;
} {
  if (total <= TRAVEL_HOME_TRAVELER_PAIR_SLOTS) {
    return { visible: total, overflow: 0 };
  }
  // 3+: current user only, remainder in +N.
  return { visible: 1, overflow: total - 1 };
}

type TravelHomeTravelerStackProps = {
  people: CoTravelerAvatarPerson[];
  tripTitle: string;
  testID?: string;
  onPress?: () => void;
};

/** Title-row avatar stack: ≤2 faces, else self + +N. */
export function TravelHomeTravelerStack({
  people,
  tripTitle,
  testID,
  onPress,
}: TravelHomeTravelerStackProps) {
  const theme = useTheme();
  const { s } = useResponsive();
  if (people.length === 0) return null;

  const size = Math.max(34, s(travelHomeTokens.sizes.avatar));
  const overlap = travelHomeTokens.spacing.avatarOverlap;
  const { visible: faceSlots, overflow: remainder } = travelHomeTravelerStackSplit(
    people.length,
  );
  const shown =
    faceSlots === 1 && remainder > 0
      ? [people.find((person) => person.isSelf) ?? people[0]!]
      : people.slice(0, faceSlots);
  const width =
    size +
    Math.max(0, shown.length - 1) * (size - overlap) +
    (remainder > 0 ? size - overlap : 0);
  const label = `${people.length} traveler${people.length === 1 ? '' : 's'}`;
  const border =
    theme.name === 'light' ? travelHomeTokens.colors.surface : theme.backgroundElevated;

  const content = (
    <View
      style={[styles.row, { width, height: size }]}
      accessibilityElementsHidden={!!onPress}
      importantForAccessibility={onPress ? 'no-hide-descendants' : 'yes'}>
      {shown.map((person, index) => (
        <View
          key={person.id}
          accessible
          accessibilityLabel={person.name}
          style={[
            styles.avatar,
            {
              width: size,
              height: size,
              left: index * (size - overlap),
              zIndex: shown.length - index,
              borderColor: border,
              borderWidth: travelHomeTokens.sizes.avatarBorder,
            },
          ]}>
          <ProfileAvatar
            displayName={person.name}
            userId={person.userId}
            isSelf={person.isSelf}
            size={size - travelHomeTokens.sizes.avatarBorder * 2}
          />
        </View>
      ))}
      {remainder > 0 ? (
        <TravelHomeGlass
          accessible
          accessibilityLabel={`${remainder} more travelers`}
          intensity={theme.name === 'dark' ? 40 : 48}
          style={[
            styles.count,
            {
              width: size,
              height: size,
              left: shown.length * (size - overlap),
              zIndex: 0,
              borderRadius: size / 2,
              borderWidth: travelHomeTokens.sizes.avatarBorder,
              borderColor: border,
            },
          ]}>
          <AppText
            variant="caption"
            fit
            numberOfLines={1}
            style={{
              color:
                theme.name === 'dark'
                  ? theme.accentPrimary
                  : travelHomeTokens.colors.avatarCountText,
              fontFamily: travelHomeFontFamily,
              fontSize: Math.max(12, s(13)),
              fontWeight: '400',
            }}>
            +{remainder}
          </AppText>
        </TravelHomeGlass>
      ) : null}
    </View>
  );

  if (!onPress) {
    return (
      <View accessibilityRole="text" accessibilityLabel={label}>
        {content}
      </View>
    );
  }

  const handlePress = () => {
    haptics.tap();
    onPress();
  };

  return (
    <AgentTestId testID={testID} label={label} onPress={handlePress}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityHint={`Open travelers for ${tripTitle}`}
        onPress={handlePress}
        hitSlop={12}
        style={({ pressed }) => [
          styles.pressable,
          { minWidth: width },
          pressed ? styles.pressed : undefined,
        ]}>
        {content}
      </Pressable>
    </AgentTestId>
  );
}

const styles = StyleSheet.create({
  pressable: {
    justifyContent: 'center',
    alignItems: 'flex-end',
  },
  pressed: { opacity: 0.72 },
  row: {
    position: 'relative',
  },
  avatar: {
    position: 'absolute',
    top: 0,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  count: {
    position: 'absolute',
    top: 0,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
