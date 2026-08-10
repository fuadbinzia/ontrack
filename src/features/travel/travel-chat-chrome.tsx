import { StyleSheet, useWindowDimensions, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { AppText, GlassMetaChip } from '@/components/primitives';
import { ProfileAvatar } from '@/features/account/profile-avatar';
import { travelDialogPalette } from '@/features/travel/travel-dialog-chrome';
import type { TravelChatMember } from '@/features/travel/chat';
import { glassMaterials } from '@/design-system/glass';
import { useResponsive } from '@/hooks/use-responsive';
import { useTheme } from '@/hooks/use-theme';

export type { TravelChatMember } from '@/features/travel/chat';

/** Ink + accent tokens for the group-chat surface (chrome is GlassPlate). */
export function travelChatPalette(theme: ReturnType<typeof useTheme>) {
  const dialog = travelDialogPalette(theme);
  const light = dialog.light;
  return {
    ...dialog,
    timestamp: light ? '#B5986E' : dialog.chrome.subtitle,
    senderName: light ? '#2D1C13' : dialog.chrome.title,
    stamp: light ? '#C4A882' : dialog.chrome.subtitle,
  };
}

export function travelChatPlateBorder(theme: ReturnType<typeof useTheme>): string {
  return theme.name === 'dark'
    ? glassMaterials.border.darkStrong
    : glassMaterials.border.lightStrong;
}

/** Overlapping member discs with a thin gold rim (header under subtitle). */
export function TravelChatMemberStack({
  members,
  maxVisible = 5,
}: {
  members: TravelChatMember[];
  maxVisible?: number;
}) {
  const theme = useTheme();
  const palette = travelChatPalette(theme);
  const { s } = useResponsive();
  if (members.length === 0) return null;

  const visible = members.slice(0, maxVisible);
  const size = Math.max(36, s(40));
  const step = Math.round(size * 0.68);
  const width = size + Math.max(0, visible.length - 1) * step;
  const rim = palette.goldFrom;

  return (
    <View
      accessibilityRole="image"
      accessibilityLabel={`${members.length} trip members`}
      style={[styles.memberStack, { width, height: size }]}>
      {visible.map((person, index) => (
        <View
          key={person.id}
          style={[
            styles.memberDisc,
            {
              width: size,
              height: size,
              borderRadius: size / 2,
              borderColor: rim,
              left: index * step,
              zIndex: index + 1,
            },
          ]}>
          <ProfileAvatar
            displayName={person.name}
            userId={person.userId}
            avatar={person.avatar}
            isSelf={person.isSelf}
            size={size}
          />
        </View>
      ))}
    </View>
  );
}

/** Date divider: line · diamond · label · diamond · line. */
export function TravelChatDateSeparator({ label }: { label: string }) {
  const theme = useTheme();
  const palette = travelChatPalette(theme);
  const { s, spacing: rs } = useResponsive();
  const diamondSize = Math.max(6, s(7));

  return (
    <View
      style={[
        styles.dateRow,
        { gap: Math.max(8, s(10)), paddingVertical: rs.sm, minHeight: Math.max(28, s(28)) },
      ]}>
      <View style={[styles.dateLine, { backgroundColor: palette.ruleColor }]} />
      <View
        style={[
          styles.diamond,
          {
            width: diamondSize,
            height: diamondSize,
            backgroundColor: palette.diamondColor,
          },
        ]}
      />
      <GlassMetaChip style={styles.dateChip}>
        <AppText
          variant="caption"
          fit
          numberOfLines={1}
          style={[
            styles.dateLabel,
            {
              color: palette.timestamp,
              fontSize: Math.max(12, s(13)),
              flexShrink: 1,
              minWidth: 0,
              zIndex: 1,
            },
          ]}>
          {label}
        </AppText>
      </GlassMetaChip>
      <View
        style={[
          styles.diamond,
          {
            width: diamondSize,
            height: diamondSize,
            backgroundColor: palette.diamondColor,
          },
        ]}
      />
      <View style={[styles.dateLine, { backgroundColor: palette.ruleColor }]} />
    </View>
  );
}

/** Soft circular destination seal behind the close control. */
export function TravelChatDestinationStamp({
  title,
  destination,
  color,
}: {
  title?: string;
  destination: string;
  color: string;
}) {
  const { s } = useResponsive();
  const titlePart = title?.trim().split(/[,\s]+/).filter(Boolean)[0];
  const placePart = destination.trim().split(/[,\s]+/).filter(Boolean)[0];
  const parts = [titlePart, placePart]
    .filter((part, index, list): part is string => Boolean(part) && list.indexOf(part) === index)
    .slice(0, 2)
    .map((part) => part.toUpperCase());
  const label = parts.length > 0 ? parts.join(' ') : 'DESTINATION';
  const size = Math.max(96, s(110));

  return (
    <View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        styles.stamp,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          borderColor: color,
          opacity: 0.22,
          transform: [{ rotate: '12deg' }],
        },
      ]}>
      <View
        style={[
          styles.stampInner,
          {
            borderRadius: size / 2 - Math.max(4, s(5)),
            borderColor: color,
            paddingHorizontal: Math.max(8, s(10)),
          },
        ]}>
        <AppText
          fit
          numberOfLines={2}
          style={[
            styles.stampText,
            {
              color,
              fontSize: Math.max(9, s(10)),
              lineHeight: Math.max(11, s(12)),
              letterSpacing: 1.1,
            },
          ]}>
          {label}
        </AppText>
      </View>
    </View>
  );
}

/** Faint landscape sketch spanning the lower half of the chat screen. */
export function TravelChatLandscape({ color }: { color: string }) {
  const { height: windowHeight } = useWindowDimensions();
  /** Fill most of the screen length so the cream field isn’t a blank middle band. */
  const height = Math.round(windowHeight * 0.62);

  return (
    <View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.landscape, { height }]}>
      <Svg
        width="100%"
        height={height}
        viewBox="0 0 390 420"
        preserveAspectRatio="xMidYMax meet">
        <Path
          d="M0 280 C48 250 78 190 120 205 C162 220 186 150 230 170 C274 190 298 120 340 145 C368 160 380 200 390 220 L390 420 L0 420 Z"
          fill={color}
          opacity={0.18}
        />
        <Path
          d="M0 300 C42 270 70 220 112 230 C156 242 178 180 222 198 C266 216 292 150 336 175 C360 188 378 215 390 235"
          stroke={color}
          strokeWidth={1.15}
          fill="none"
          opacity={0.38}
        />
        <Path
          d="M0 330 C46 300 74 255 118 268 C160 280 186 225 230 245 C274 265 300 210 344 235 C366 248 380 275 390 295"
          stroke={color}
          strokeWidth={1}
          fill="none"
          opacity={0.28}
        />
        <Path
          d="M18 250 C54 210 82 155 120 175 C158 195 180 130 224 155 C268 180 292 115 336 145 C360 160 376 195 390 215"
          stroke={color}
          strokeWidth={0.95}
          fill="none"
          opacity={0.24}
        />
        <Path
          d="M168 340 C182 300 192 255 198 210 C204 255 214 300 228 340"
          stroke={color}
          strokeWidth={0.9}
          fill="none"
          opacity={0.3}
        />
        <Path
          d="M286 310 L298 250 L310 310 Z"
          fill={color}
          opacity={0.22}
        />
        <Path
          d="M292 278 L306 278"
          stroke={color}
          strokeWidth={0.8}
          opacity={0.28}
        />
        <Path
          d="M40 360 C90 348 140 352 190 360 C240 368 290 355 340 360 C360 362 375 365 390 368"
          stroke={color}
          strokeWidth={0.85}
          fill="none"
          opacity={0.2}
        />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  memberStack: {
    position: 'relative',
    alignSelf: 'flex-start',
  },
  memberDisc: {
    position: 'absolute',
    top: 0,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    overflow: 'hidden',
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'stretch',
  },
  dateLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth * 2,
    minWidth: 12,
  },
  diamond: {
    transform: [{ rotate: '45deg' }],
    borderRadius: 1,
    flexShrink: 0,
  },
  dateChip: {
    flexShrink: 1,
    minWidth: 0,
    maxWidth: '56%',
  },
  dateLabel: {
    textAlign: 'center',
  },
  stamp: {
    position: 'absolute',
    top: 8,
    right: -4,
    borderWidth: 1.25,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 0,
  },
  stampInner: {
    position: 'absolute',
    top: 5,
    right: 5,
    bottom: 5,
    left: 5,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stampText: {
    textAlign: 'center',
    fontWeight: '600',
    flexShrink: 1,
    minWidth: 0,
  },
  landscape: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 0,
  },
});
