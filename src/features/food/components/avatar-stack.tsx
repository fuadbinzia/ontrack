import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { AppText, GlassPlate } from '@/components/primitives';
import type { PhoneWidthClass } from '@/design-system/responsive';
import { ProfileAvatar } from '@/features/account/profile-avatar';
import type { ProfileAvatarMeta } from '@/features/account/profile-avatar-model';
import { useResponsive } from '@/hooks/use-responsive';
import { useTheme } from '@/hooks/use-theme';

export interface AvatarStackPerson {
  id: string;
  displayName: string;
  userId?: string;
  avatar?: ProfileAvatarMeta;
}

export interface AvatarStackProps {
  people: readonly AvatarStackPerson[];
  /** Visible avatars before collapsing into a "+N" bubble (default 4). */
  maxVisible?: number;
  /** Explicit avatar diameter; defaults from the width class (30–34). */
  size?: number;
  testID?: string;
  style?: StyleProp<ViewStyle>;
}

/** Spec: phone avatars 30–34, larger on the `large` width class. */
export function avatarStackSize(widthClass: PhoneWidthClass): number {
  switch (widthClass) {
    case 'compact':
      return 30;
    case 'large':
      return 34;
    default:
      return 32;
  }
}

/** How many avatars render and how many collapse into the count bubble. */
export function avatarStackSplit(
  total: number,
  maxVisible: number,
): { visible: number; overflow: number } {
  if (total <= maxVisible) return { visible: total, overflow: 0 };
  return { visible: maxVisible, overflow: total - maxVisible };
}

const OVERLAP = 9;
const RING_WIDTH = 2;

/** Overlapping avatar row with a surface ring and a "+N" overflow bubble. */
export function AvatarStack({
  people,
  maxVisible = 4,
  size,
  testID,
  style,
}: AvatarStackProps) {
  const theme = useTheme();
  const { widthClass } = useResponsive();
  const avatarSize = size ?? avatarStackSize(widthClass);
  const { visible, overflow } = avatarStackSplit(people.length, maxVisible);
  const shown = people.slice(0, visible);

  return (
    <View
      testID={testID}
      accessible
      accessibilityRole="text"
      accessibilityLabel={
        people.length === 1
          ? people[0]!.displayName
          : `${people.length} people`
      }
      style={[styles.row, style]}>
      {shown.map((person, index) => (
        <View
          key={person.id}
          style={index > 0 ? { marginLeft: -OVERLAP } : null}>
          <ProfileAvatar
            displayName={person.displayName}
            userId={person.userId}
            avatar={person.avatar}
            size={avatarSize}
            borderColor={theme.backgroundPrimary}
            borderWidth={RING_WIDTH}
          />
        </View>
      ))}
      {overflow > 0 ? (
        <GlassPlate
          mist
          style={[
            styles.countBubble,
            {
              width: avatarSize,
              height: avatarSize,
              borderRadius: avatarSize / 2,
              marginLeft: shown.length > 0 ? -OVERLAP : 0,
              borderWidth: RING_WIDTH,
              borderColor: theme.backgroundPrimary,
            },
          ]}>
          <AppText variant="caption" color="secondary" fit>
            {`+${overflow}`}
          </AppText>
        </GlassPlate>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  countBubble: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
