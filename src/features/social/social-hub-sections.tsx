import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import {
  AppText,
  GlassIconWell,
  GlassPlate,
  IconButton,
  LoadingBlock,
  Symbol,
} from '@/components/primitives';
import { radii } from '@/design-system';
import { ProfileAvatar } from '@/features/account/profile-avatar';
import { socialActionTones, socialChrome, socialShadow } from '@/features/social/social-chrome';
import { SocialPressable } from '@/features/social/social-pressable';
import {
  SOCIAL_QUICK_ACTIONS,
  type SocialQuickActionId,
} from '@/features/social/social-types';
import { useResponsive } from '@/hooks/use-responsive';
import { useTheme } from '@/hooks/use-theme';
import type { FriendProfile } from '@/services/friends';
import { AgentUiIds } from '@/utils/agent-ui';

export function SocialHeader({
  pendingCount,
  onAddFriend,
  onMessages,
}: {
  pendingCount: number;
  onAddFriend: () => void;
  onMessages: () => void;
}) {
  const theme = useTheme();
  const chrome = socialChrome(theme);
  const { spacing, s } = useResponsive();
  const buttonSize = Math.max(46, s(50));

  return (
    <View style={[styles.header, { gap: spacing.md }]}>
      <View style={[styles.headerCopy, { gap: spacing.xs }]}>
        <View style={styles.titleRow}>
          <AppText variant="display" style={{ color: chrome.ink }} fit>
            Social
          </AppText>
          <View
            accessibilityElementsHidden
            style={[
              styles.titleDot,
              {
                width: Math.max(9, s(10)),
                height: Math.max(9, s(10)),
                borderRadius: Math.max(5, s(5)),
                backgroundColor: chrome.primary,
              },
            ]}
          />
        </View>
        <AppText variant="body" style={{ color: chrome.secondaryInk }} fit>
          Connect. Share. Do more together.
        </AppText>
      </View>
      <View style={[styles.headerActions, { gap: spacing.sm }]}>
        <View style={[styles.iconShadow, socialShadow(chrome.shadow)]}>
          <IconButton
            testID={AgentUiIds.social.header.addFriend}
            icon="invite"
            size={buttonSize}
            iconSize="md"
            background={chrome.surface}
            borderColor={chrome.border}
            color={chrome.ink}
            accessibilityLabel={
              pendingCount > 0
                ? `Add friends, ${pendingCount} pending requests`
                : 'Add a friend'
            }
            onPress={onAddFriend}
          />
          {pendingCount > 0 ? (
            <View
              style={[
                styles.notificationBadge,
                { backgroundColor: chrome.primary, borderColor: chrome.background },
              ]}>
              <AppText variant="caption" color="onAccent" bold fit>
                {pendingCount > 9 ? '9+' : pendingCount}
              </AppText>
            </View>
          ) : null}
        </View>
        <View style={[styles.iconShadow, socialShadow(chrome.shadow)]}>
          <IconButton
            testID={AgentUiIds.social.header.messages}
            icon="chat"
            size={buttonSize}
            iconSize="md"
            background={chrome.surface}
            borderColor={chrome.border}
            color={chrome.ink}
            accessibilityLabel="Open messages"
            onPress={onMessages}
          />
        </View>
      </View>
    </View>
  );
}

export function SocialFriendsCard({
  friends,
  loading,
  onAddFriend,
  onSeeAll,
  onOpenFriend,
}: {
  friends: FriendProfile[];
  loading: boolean;
  onAddFriend: () => void;
  onSeeAll: () => void;
  onOpenFriend: (friend: FriendProfile) => void;
}) {
  const theme = useTheme();
  const chrome = socialChrome(theme);
  const { spacing, s } = useResponsive();
  const avatarSize = Math.max(54, s(58));

  return (
    <GlassPlate
      style={[
        styles.friendsCard,
        {
          paddingVertical: spacing.lg,
          ...socialShadow(chrome.shadow, 'overlay'),
        },
      ]}>
      <View
        style={[
          styles.friendsSummary,
          {
            width: Math.max(76, s(82)),
            paddingLeft: spacing.lg,
            paddingRight: spacing.sm,
          },
        ]}>
        <AppText variant="callout" bold fit>
          Friends
        </AppText>
        <AppText variant="metric" style={{ color: chrome.primary }} fit>
          {friends.length}
        </AppText>
        <SocialPressable
          testID={AgentUiIds.social.friends.seeAll}
          accessibilityLabel="See all friends"
          onPress={onSeeAll}
          style={styles.textAction}>
          <AppText variant="caption" style={{ color: chrome.primary }} fit>
            See all
          </AppText>
          <Symbol name="chevron-right" size={12} color={chrome.primary} />
        </SocialPressable>
      </View>

      {loading && friends.length === 0 ? (
        <View style={styles.friendsLoading}>
          <LoadingBlock label="Loading friends…" compact />
        </View>
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{
            paddingRight: spacing.lg,
            gap: spacing.sm,
          }}>
          <SocialPressable
            testID={AgentUiIds.social.friends.add}
            accessibilityLabel="Add a friend"
            onPress={onAddFriend}
            style={[styles.friendItem, { width: Math.max(64, s(68)), gap: spacing.xs }]}>
            <View
              style={[
                styles.addFriendCircle,
                {
                  width: avatarSize,
                  height: avatarSize,
                  borderRadius: avatarSize / 2,
                  backgroundColor: chrome.mint,
                },
              ]}>
              <Symbol name="add" size="md" color={chrome.primary} />
            </View>
            <AppText variant="caption" fit>
              Add
            </AppText>
          </SocialPressable>

          {friends.map((friend) => (
            <SocialPressable
              key={friend.userId}
              testID={AgentUiIds.social.friends.friend(friend.userId)}
              accessibilityLabel={`Open ${friend.displayName}`}
              onPress={() => onOpenFriend(friend)}
              style={[styles.friendItem, { width: Math.max(64, s(68)), gap: spacing.xs }]}>
              <View
                style={[
                  styles.friendAvatarRing,
                  {
                    width: avatarSize + 6,
                    height: avatarSize + 6,
                    borderRadius: (avatarSize + 6) / 2,
                    borderColor: chrome.primary,
                  },
                ]}>
                <ProfileAvatar
                  displayName={friend.displayName}
                  userId={friend.userId}
                  size={avatarSize}
                />
                <View
                  accessibilityLabel="Connected"
                  style={[
                    styles.presence,
                    {
                      backgroundColor: chrome.primary,
                      borderColor: chrome.surface,
                    },
                  ]}
                />
              </View>
              <AppText variant="caption" fit>
                {friend.displayName.split(' ')[0]}
              </AppText>
            </SocialPressable>
          ))}

          {friends.length === 0 ? (
            <View style={[styles.noFriendsCopy, { paddingHorizontal: spacing.sm }]}>
              <AppText variant="caption" color="secondary">
                Your people will stay right here.
              </AppText>
            </View>
          ) : null}
        </ScrollView>
      )}
    </GlassPlate>
  );
}

const QUICK_ACTION_COLUMNS = 5;

export function SocialQuickActions({
  onAction,
}: {
  onAction: (action: SocialQuickActionId) => void;
}) {
  const theme = useTheme();
  const chrome = socialChrome(theme);
  const { spacing, width, layout, s } = useResponsive();
  const gap = spacing.xs;
  const [gridWidth, setGridWidth] = useState(0);
  // Prefer measured row width so tiles fill the content area edge-to-edge.
  const rowWidth = gridWidth > 0 ? gridWidth : width - layout.screenPadding * 2;
  const tileWidth = Math.max(
    52,
    Math.floor((rowWidth - gap * (QUICK_ACTION_COLUMNS - 1)) / QUICK_ACTION_COLUMNS),
  );
  const labelPadX = Math.max(2, spacing.xs - 1);
  // Shared size for every tile — sized so the longest single word still fits.
  const labelFontSize = Math.max(10, Math.min(11.5, Math.floor((tileWidth - labelPadX * 2) / 5.6)));
  const labelLineHeight = Math.round(labelFontSize * 1.28);
  const labelBlockHeight = labelLineHeight * 2;

  return (
    <View style={{ gap: spacing.md }}>
      <AppText variant="heading" style={{ color: chrome.ink }} bold fit>
        Quick Actions
      </AppText>
      <View
        style={[styles.quickGrid, { rowGap: gap }]}
        onLayout={(event) => {
          const next = event.nativeEvent.layout.width;
          setGridWidth((prev) => (Math.abs(prev - next) < 0.5 ? prev : next));
        }}>
        {SOCIAL_QUICK_ACTIONS.map((action) => {
          const tone = socialActionTones[action.tone];
          const a11yLabel = action.label.replace(/\n/g, ' ');
          return (
            <SocialPressable
              key={action.id}
              testID={AgentUiIds.social.quickAction(action.id)}
              accessibilityLabel={a11yLabel}
              onPress={() => onAction(action.id)}
              style={[
                styles.quickTileWrap,
                {
                  width: tileWidth,
                  minHeight: Math.max(88, s(96)),
                },
              ]}>
              <GlassPlate
                style={[
                  styles.quickTile,
                  {
                    paddingHorizontal: labelPadX,
                    paddingVertical: spacing.sm,
                    gap: spacing.xs,
                    ...socialShadow(chrome.shadow),
                  },
                ]}>
              <View
                style={[
                  styles.quickIcon,
                  {
                    width: Math.max(36, s(40)),
                    height: Math.max(36, s(40)),
                    borderRadius: Math.max(12, s(14)),
                    backgroundColor: tone.background,
                  },
                ]}>
                <Symbol name={action.icon} size="md" color={tone.foreground} />
              </View>
              <View style={[styles.quickLabelSlot, { height: labelBlockHeight }]}>
                <AppText
                  variant="caption"
                  align="center"
                  numberOfLines={2}
                  maxFontSizeMultiplier={1.1}
                  style={[
                    styles.quickLabel,
                    {
                      color: chrome.ink,
                      fontSize: labelFontSize,
                      lineHeight: labelLineHeight,
                    },
                  ]}>
                  {action.label}
                </AppText>
              </View>
              </GlassPlate>
            </SocialPressable>
          );
        })}
      </View>
    </View>
  );
}

export { SocialUpcomingTogether } from './social-upcoming-together';

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerCopy: {
    flex: 1,
    minWidth: 0,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  titleDot: {
    marginTop: 8,
  },
  headerActions: {
    flexDirection: 'row',
  },
  iconShadow: {
    borderRadius: radii.pill,
  },
  notificationBadge: {
    position: 'absolute',
    right: -3,
    top: -3,
    minWidth: 20,
    height: 20,
    paddingHorizontal: 4,
    borderRadius: 10,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  friendsCard: {
    minHeight: 132,
    borderRadius: radii.xl,
    borderCurve: 'continuous',
    flexDirection: 'row',
    overflow: 'hidden',
  },
  friendsSummary: {
    justifyContent: 'center',
    gap: 2,
  },
  textAction: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  friendsLoading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  friendItem: {
    minHeight: 102,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addFriendCircle: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  friendAvatarRing: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
  },
  presence: {
    position: 'absolute',
    right: -1,
    bottom: 2,
    width: 13,
    height: 13,
    borderRadius: 7,
    borderWidth: 2,
  },
  noFriendsCopy: {
    width: 150,
    justifyContent: 'center',
  },
  quickGrid: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  quickTileWrap: {
    flexGrow: 0,
  },
  quickTile: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.lg,
    borderCurve: 'continuous',
  },
  quickIcon: {
    alignItems: 'center',
    justifyContent: 'center',
    borderCurve: 'continuous',
  },
  quickLabelSlot: {
    alignSelf: 'stretch',
    width: '100%',
    justifyContent: 'center',
  },
  quickLabel: {
    width: '100%',
  }
});
