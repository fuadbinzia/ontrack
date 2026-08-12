import { useCallback, useMemo, useRef } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';

import { AppText, GlassMetaChip, GlassPlate, Symbol } from '@/components/primitives';
import type { DropdownAnchor } from '@/components/primitives/dropdown-layout';
import { radii, spacing } from '@/design-system';
import {
    isTravelChatMessageMine,
    travelChatDeliveryStatus,
    travelChatMessagePreview,
    type OptimisticTravelChatMessage,
} from '@/features/travel/chat';
import { travelChatPalette, travelChatPlateBorder } from '@/features/travel/travel-chat-chrome';
import { useResponsive } from '@/hooks/use-responsive';
import { useTheme } from '@/hooks/use-theme';
import { AgentUiIds, useAgentUiTarget } from '@/utils/agent-ui';
import { haptics } from '@/utils/haptics';
import { getDateTimeFormatter } from '@/utils/intl-cache';

type TravelChatRowPalette = ReturnType<typeof travelChatPalette>;

export function TravelChatMessageRow({
  message,
  identity,
  palette,
  onLongPress,
  onToggleReaction,
}: {
  message: OptimisticTravelChatMessage;
  identity: { userId?: string | null; deviceId?: string | null };
  palette: TravelChatRowPalette;
  onLongPress: (
    message: OptimisticTravelChatMessage,
    anchor: DropdownAnchor,
  ) => void;
  onToggleReaction: (message: OptimisticTravelChatMessage, emoji: string) => void;
}) {
  const theme = useTheme();
  const { spacing: rs, s } = useResponsive();
  const bubbleRef = useRef<View>(null);
  const anchorRef = useRef<DropdownAnchor>({
    x: spacing.xl,
    y: 220,
    width: 220,
    height: 48,
  });
  const mine = isTravelChatMessageMine(message, identity);
  const deleted = Boolean(message.deletedAt);
  const delivery = mine ? travelChatDeliveryStatus(message) : undefined;
  const ink = palette.senderName;
  const bodyText = travelChatMessagePreview(message);

  const refreshAnchor = useCallback(() => {
    bubbleRef.current?.measureInWindow((x, y, width, height) => {
      if (width > 0 && height > 0) {
        anchorRef.current = { x, y, width, height };
      }
    });
  }, []);

  const openMenu = useCallback(() => {
    if (deleted) return;
    try {
      haptics.select();
    } catch {
      // Never block the menu if haptics fail.
    }
    let opened = false;
    const open = (anchor: DropdownAnchor) => {
      if (opened) return;
      opened = true;
      onLongPress(message, anchor);
    };
    const node = bubbleRef.current;
    if (!node || typeof node.measureInWindow !== 'function') {
      open(anchorRef.current);
      return;
    }
    node.measureInWindow((x, y, width, height) => {
      if (width > 0 && height > 0) {
        const next = { x, y, width, height };
        anchorRef.current = next;
        open(next);
        return;
      }
      open(anchorRef.current);
    });
    // Fabric can drop measure callbacks inside lists — still open.
    setTimeout(() => open(anchorRef.current), 48);
  }, [deleted, message, onLongPress]);

  const longPress = useMemo(
    () =>
      Gesture.LongPress()
        .enabled(!deleted)
        .minDuration(350)
        .maxDistance(16)
        .onStart(() => {
          runOnJS(openMenu)();
        }),
    [deleted, openMenu],
  );

  const agent = useAgentUiTarget(AgentUiIds.travel.chat.messageActions, {
    label: 'Message actions',
    onPress: deleted ? undefined : openMenu,
  });

  return (
    <View style={[styles.messageRow, mine ? styles.myMessageRow : undefined]}>
      {!mine ? (
        <AppText
          variant="caption"
          style={[
            styles.sender,
            {
              color: palette.senderName,
              fontSize: Math.max(12, s(13)),
            },
          ]}>
          {message.senderName}
        </AppText>
      ) : null}
      <GestureDetector gesture={longPress}>
        <View
          ref={(node) => {
            bubbleRef.current = node;
            agent.ref(node);
          }}
          collapsable={false}
          testID={AgentUiIds.travel.chat.messageActions}
          onLayout={(event) => {
            agent.onLayout?.(event);
            refreshAnchor();
          }}
          accessibilityRole="button"
          accessibilityLabel="Message actions"
          style={message.pending ? styles.pendingBubble : undefined}>
          <GlassPlate
            airy
            intensity={48}
            pointerEvents="none"
            tintColor={mine && !deleted ? theme.accentPrimary : undefined}
            style={[
              styles.bubble,
              {
                borderRadius: radii.pill,
                paddingHorizontal: Math.max(rs.lg, s(18)),
                paddingVertical: Math.max(rs.md, s(12)),
                gap: rs.xs,
                borderColor: travelChatPlateBorder(theme),
              },
            ]}>
            {message.replyToId && !deleted ? (
              <View
                style={[
                  styles.replyQuote,
                  {
                    borderLeftColor: theme.accentPrimary,
                    paddingLeft: rs.sm,
                    marginBottom: rs.xs,
                    zIndex: 1,
                  },
                ]}>
                <AppText variant="caption" color="accent" fit numberOfLines={1}>
                  {message.replySenderName ?? 'Reply'}
                </AppText>
                <AppText
                  variant="caption"
                  color="secondary"
                  numberOfLines={2}
                  style={{ zIndex: 1 }}>
                  {message.replyPreview ?? 'Message'}
                </AppText>
              </View>
            ) : null}
            {deleted ? (
              <AppText
                style={{
                  zIndex: 1,
                  color: theme.textTertiary,
                  fontStyle: 'italic',
                  fontSize: Math.max(15, s(16)),
                }}>
                Message deleted
              </AppText>
            ) : (
              <AppText
                style={{
                  zIndex: 1,
                  color: ink,
                  fontStyle: message.kind === 'voice' ? 'italic' : undefined,
                  fontSize: Math.max(16, s(17)),
                  lineHeight: Math.max(22, s(24)),
                }}>
                {bodyText}
              </AppText>
            )}
          </GlassPlate>
        </View>
      </GestureDetector>
      {!deleted && message.reactions.length > 0 ? (
        <View
          style={[
            styles.reactions,
            mine ? styles.reactionsMine : undefined,
            { gap: rs.xs, marginTop: rs.xs },
          ]}>
          {message.reactions.map((reaction) => (
            <Pressable
              key={reaction.emoji}
              accessibilityRole="button"
              accessibilityLabel={`${reaction.emoji} reaction`}
              testID={AgentUiIds.travel.chat.reaction(reaction.emoji)}
              onPress={() => onToggleReaction(message, reaction.emoji)}>
              <GlassMetaChip
                accessibilityLabel={`${reaction.emoji} ${reaction.count}`}
                style={
                  reaction.mine
                    ? { borderColor: theme.accentPrimary }
                    : undefined
                }>
                <AppText variant="caption" fit>
                  {`${reaction.emoji} ${reaction.count}`}
                </AppText>
              </GlassMetaChip>
            </Pressable>
          ))}
        </View>
      ) : null}
      <View
        style={[
          styles.metaRow,
          mine ? styles.metaRowMine : undefined,
          { gap: rs.xs, marginTop: rs.xs, paddingHorizontal: spacing.sm },
        ]}>
        <AppText
          variant="caption"
          style={{
            color: palette.timestamp,
            fontSize: Math.max(11, s(12)),
          }}>
          {message.pending
            ? 'Sending…'
            : [
                getDateTimeFormatter(undefined, {
                  hour: 'numeric',
                  minute: '2-digit',
                }).format(new Date(message.createdAt)),
                message.editedAt && !deleted ? 'Edited' : null,
              ]
                .filter(Boolean)
                .join(' · ')}
        </AppText>
        {mine && delivery && delivery !== 'pending' ? (
          <Symbol
            name="check"
            size={12}
            color={delivery === 'read' ? theme.accentPrimary : palette.timestamp}
          />
        ) : null}
        {mine && delivery === 'read' ? (
          <Symbol name="check" size={12} color={theme.accentPrimary} />
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  messageRow: { alignItems: 'flex-start', maxWidth: '84%' },
  myMessageRow: { alignSelf: 'flex-end', alignItems: 'flex-end' },
  sender: { paddingHorizontal: spacing.sm, paddingBottom: spacing.xs },
  bubble: {
    borderCurve: 'continuous',
  },
  pendingBubble: { opacity: 0.66 },
  replyQuote: {
    borderLeftWidth: 2,
    minWidth: 0,
  },
  reactions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    maxWidth: '100%',
  },
  reactionsMine: {
    justifyContent: 'flex-end',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  metaRowMine: {
    justifyContent: 'flex-end',
  },
});
