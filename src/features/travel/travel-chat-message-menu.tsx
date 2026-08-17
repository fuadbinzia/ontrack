import { useMemo, useRef, useState } from 'react';
import {
    Pressable,
    StyleSheet,
    useWindowDimensions,
    View,
    type View as ViewType,
} from 'react-native';
import Animated, {
    FadeIn,
    FadeInDown,
    FadeInUp,
    FadeOut,
    ReduceMotion,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText, GlassPlate, Symbol } from '@/components/primitives';
import type { DropdownAnchor } from '@/components/primitives/dropdown-layout';
import { clampNumber } from '@/components/primitives/dropdown-layout';
import {
    motion,
    radii,
    shadows,
    spacing,
    type AppIconName,
} from '@/design-system';
import {
    isTravelChatMessageMine,
    TRAVEL_CHAT_REACTION_EMOJIS,
    type OptimisticTravelChatMessage,
} from '@/features/travel/chat';
import { travelChatPlateBorder } from '@/features/travel/travel-chat-chrome';
import { placeTravelChatMessageMenu } from '@/features/travel/travel-chat-message-menu-layout';
import { useResponsive } from '@/hooks/use-responsive';
import { useTheme } from '@/hooks/use-theme';
import { AgentUiIds } from '@/utils/agent-ui';
import { haptics } from '@/utils/haptics';

export type TravelChatMessageMenuAction =
  | 'reply'
  | 'copy'
  | 'edit'
  | 'delete'
  | 'report'
  | 'block'
  | { react: string };

type MenuItem = {
  id: 'reply' | 'copy' | 'edit' | 'delete' | 'report' | 'block';
  title: string;
  icon: AppIconName;
  destructive?: boolean;
};

/**
 * iMessage-style reaction + action popovers.
 * In-tree (not Modal) so GlassPlate BlurView frosts the live chat — Modal
 * only blurs its own scrim and reads as opaque paper.
 */
export function TravelChatMessageMenu({
  message,
  anchor,
  identity,
  /** Clears tab dock / keyboard — defaults to home-indicator only. */
  bottomChrome = 0,
  onClose,
  onAction,
}: {
  message: OptimisticTravelChatMessage | null;
  anchor: DropdownAnchor | null;
  identity: { userId?: string | null; deviceId?: string | null };
  bottomChrome?: number;
  onClose: () => void;
  onAction: (action: TravelChatMessageMenuAction) => void;
}) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const { spacing: rs, s, layout } = useResponsive();
  const dark = theme.name === 'dark';
  const visible = Boolean(message && anchor);
  const mine = message
    ? isTravelChatMessageMine(message, identity)
    : false;
  const rootRef = useRef<ViewType>(null);
  const [origin, setOrigin] = useState({ x: 0, y: 0 });

  const items = useMemo<MenuItem[]>(() => {
    if (!message) return [];
    const next: MenuItem[] = [
      { id: 'reply', title: 'Reply', icon: 'reply' },
      { id: 'copy', title: 'Copy', icon: 'copy' },
    ];
    if (mine && message.kind === 'text' && !message.deletedAt) {
      next.push({ id: 'edit', title: 'Edit', icon: 'edit' });
    }
    if (mine && !message.deletedAt) {
      next.push({
        id: 'delete',
        title: 'Delete',
        icon: 'delete',
        destructive: true,
      });
    }
    if (!mine && message.senderUserId && !message.deletedAt) {
      next.push({ id: 'report', title: 'Report', icon: 'warning' });
      next.push({
        id: 'block',
        title: 'Block',
        icon: 'minus-circle',
        destructive: true,
      });
    }
    return next;
  }, [message, mine]);

  const chip = Math.max(40, s(40));
  const reactionPad = rs.sm;
  const reactionGap = rs.xs;
  const reactionCount = TRAVEL_CHAT_REACTION_EMOJIS.length;
  const reactionWidth =
    reactionPad * 2 +
    chip * reactionCount +
    reactionGap * Math.max(0, reactionCount - 1);
  const reactionHeight = chip + reactionPad * 2;

  const itemHeight = Math.max(44, layout.minTapTarget);
  const actionsHeight = rs.xs * 2 + items.length * itemHeight;
  const gap = rs.xs;
  const [actionsWidth, setActionsWidth] = useState(0);

  const syncOrigin = () => {
    rootRef.current?.measureInWindow((x, y) => {
      setOrigin((prev) =>
        prev.x === x && prev.y === y ? prev : { x, y },
      );
    });
  };

  if (!visible || !anchor || !message) return null;

  // Anchors are window coords; overlay is in-tree — subtract root origin.
  const localAnchor: DropdownAnchor = {
    x: anchor.x - origin.x,
    y: anchor.y - origin.y,
    width: anchor.width,
    height: anchor.height,
  };

  const minLeft = insets.left + rs.lg - origin.x;
  const alignLeft = (width: number) => {
    const resolved = width > 0 ? width : Math.max(112, s(120));
    const preferred = mine
      ? localAnchor.x + localAnchor.width - resolved
      : localAnchor.x;
    const maxLeft = Math.max(
      minLeft,
      windowWidth - origin.x - insets.right - rs.lg - resolved,
    );
    return clampNumber(preferred, minLeft, maxLeft);
  };

  const topMin = insets.top + rs.sm - origin.y;
  // Prefer measured tab/keyboard chrome over the home indicator alone so the
  // last bubble's Edit/Delete rows aren't painted under the dock.
  const bottomClearance = Math.max(bottomChrome, insets.bottom) + rs.sm;
  const bottomMax = windowHeight - origin.y - bottomClearance;
  const { reactionTop, actionsTop, openActionsBelow } =
    placeTravelChatMessageMenu({
      anchor: localAnchor,
      reactionHeight,
      actionsHeight,
      gap,
      topMin,
      bottomMax,
    });
  const actionsEnter = openActionsBelow ? FadeInDown : FadeInUp;

  const plateBorder = travelChatPlateBorder(theme);

  return (
    <View
      ref={rootRef}
      accessibilityViewIsModal
      pointerEvents="box-none"
      onLayout={syncOrigin}
      style={styles.root}>
      <Animated.View
        entering={FadeIn.duration(motion.fade).reduceMotion(
          ReduceMotion.System,
        )}
        exiting={FadeOut.duration(motion.fade).reduceMotion(
          ReduceMotion.System,
        )}
        style={StyleSheet.absoluteFill}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Dismiss message menu"
          onPress={onClose}
          style={[
            StyleSheet.absoluteFill,
            // Keep chat fully visible under frost — no opaque Modal scrim.
            {
              backgroundColor: dark
                ? 'rgba(4, 8, 14, 0.12)'
                : 'rgba(20, 28, 40, 0.06)',
            },
          ]}
        />
      </Animated.View>

      <Animated.View
        entering={FadeInUp.duration(motion.fade).reduceMotion(
          ReduceMotion.System,
        )}
        style={[
          styles.panelShell,
          shadows.overlay,
          {
            top: reactionTop,
            left: alignLeft(reactionWidth),
            width: reactionWidth,
            borderRadius: radii.pill,
          },
        ]}>
        <GlassPlate
          intensity={56}
          style={[styles.reactionPanel, { borderColor: plateBorder }]}>
          <View
            style={[
              styles.reactions,
              {
                gap: reactionGap,
                padding: reactionPad,
                zIndex: 1,
              },
            ]}>
            {TRAVEL_CHAT_REACTION_EMOJIS.map((emoji) => {
              const selected = message.reactions.some(
                (reaction) => reaction.emoji === emoji && reaction.mine,
              );
              return (
                <Pressable
                  key={emoji}
                  accessibilityRole="button"
                  accessibilityLabel={`React ${emoji}`}
                  testID={AgentUiIds.travel.chat.reaction(emoji)}
                  onPress={() => {
                    haptics.select();
                    onAction({ react: emoji });
                  }}
                  style={({ pressed }) => [
                    styles.reactionChip,
                    {
                      width: chip,
                      height: chip,
                      borderRadius: radii.pill,
                      borderColor: selected
                        ? theme.accentPrimary
                        : 'transparent',
                      opacity: pressed ? 0.75 : 1,
                    },
                  ]}>
                  <AppText
                    variant="body"
                    style={{
                      fontSize: Math.max(18, s(20)),
                      lineHeight: Math.max(22, s(24)),
                    }}>
                    {emoji}
                  </AppText>
                </Pressable>
              );
            })}
          </View>
        </GlassPlate>
      </Animated.View>

      <Animated.View
        entering={actionsEnter.duration(motion.fade).reduceMotion(
          ReduceMotion.System,
        )}
        style={[
          styles.panelShell,
          shadows.overlay,
          {
            top: actionsTop,
            left: alignLeft(actionsWidth),
            borderRadius: radii.xl,
          },
        ]}>
        <GlassPlate
          intensity={56}
          style={[styles.panel, styles.actionsPanel, { borderColor: plateBorder }]}
          onLayout={(event) => {
            const next = Math.ceil(event.nativeEvent.layout.width);
            if (next > 0 && next !== actionsWidth) setActionsWidth(next);
          }}>
          <View
            style={[
              styles.actions,
              {
                paddingVertical: rs.xs,
                paddingHorizontal: rs.xs,
                zIndex: 1,
              },
            ]}>
            {items.map((item) => (
              <Pressable
                key={item.id}
                accessibilityRole="button"
                accessibilityLabel={item.title}
                testID={
                  item.id === 'reply'
                    ? AgentUiIds.travel.chat.menuReply
                    : item.id === 'copy'
                      ? AgentUiIds.travel.chat.menuCopy
                      : item.id === 'edit'
                        ? AgentUiIds.travel.chat.menuEdit
                        : item.id === 'report'
                          ? AgentUiIds.travel.chat.menuReport
                          : item.id === 'block'
                            ? AgentUiIds.travel.chat.menuBlock
                            : AgentUiIds.travel.chat.menuDelete
                }
                onPress={() => {
                  haptics.tap();
                  onAction(item.id);
                }}
                style={({ pressed }) => [
                  styles.actionRow,
                  {
                    minHeight: itemHeight,
                    paddingHorizontal: rs.md,
                    paddingRight: rs.lg,
                    borderRadius: radii.lg,
                    opacity: pressed ? 0.72 : 1,
                  },
                ]}>
                <Symbol
                  name={item.icon}
                  size="sm"
                  color={
                    item.destructive ? theme.danger : theme.textPrimary
                  }
                />
                <AppText
                  variant="callout"
                  fit
                  color={item.destructive ? 'danger' : 'primary'}
                  style={[
                    styles.actionLabel,
                    {
                      fontSize: Math.max(16, s(17)),
                      lineHeight: Math.max(22, s(24)),
                    },
                  ]}>
                  {item.title}
                </AppText>
              </Pressable>
            ))}
          </View>
        </GlassPlate>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    zIndex: 40,
  },
  panelShell: {
    position: 'absolute',
  },
  reactionPanel: {
    borderRadius: radii.pill,
    borderCurve: 'continuous',
    overflow: 'hidden',
  },
  panel: {
    borderRadius: radii.xl,
    borderCurve: 'continuous',
    overflow: 'hidden',
  },
  actionsPanel: {
    alignSelf: 'flex-start',
  },
  reactions: {
    flexDirection: 'row',
    flexWrap: 'nowrap',
    alignItems: 'center',
    justifyContent: 'center',
  },
  reactionChip: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth * 2,
  },
  actions: {
    alignSelf: 'flex-start',
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'stretch',
    gap: spacing.sm,
  },
  actionLabel: {
    flexGrow: 0,
    flexShrink: 1,
    minWidth: 0,
  },
});
