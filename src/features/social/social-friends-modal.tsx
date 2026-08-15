import * as Clipboard from 'expo-clipboard';
import { useEffect, useState } from 'react';
import { Modal, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  AppText,
  appPrompt,
  Button,
  EmptyState,
  ErrorMessage,
  GlassIconWell,
  GlassPlate,
  GlassTonePill,
  IconButton,
  Input,
  LoadingBlock,
  ScreenAtmosphere,
  SheetScaffold,
  SheetGrabber,
  Symbol,
  useScreenAtmosphereChrome,
} from '@/components/primitives';
import { radii } from '@/design-system';
import { ProfileAvatar } from '@/features/account/profile-avatar';
import { socialChrome, socialShadow } from '@/features/social/social-chrome';
import { SocialPressable } from '@/features/social/social-pressable';
import { useResponsive } from '@/hooks/use-responsive';
import { useTheme } from '@/hooks/use-theme';
import type { FriendProfile, FriendRequestItem } from '@/services/friends';
import { AgentTestId, AgentUiIds } from '@/utils/agent-ui';

export type SocialFriendsModalMode = 'add' | 'all' | 'trip';

type SocialFriendsModalProps = {
  visible: boolean;
  mode: SocialFriendsModalMode;
  signedIn: boolean;
  friends: FriendProfile[];
  incoming: FriendRequestItem[];
  outgoing: FriendRequestItem[];
  loading: boolean;
  working?: string;
  error?: string;
  email: string;
  inviteUrl?: string;
  slugDraft: string;
  savedSlug?: string;
  onClose: () => void;
  onSignIn: () => void;
  onEmailChange: (value: string) => void;
  onSlugChange: (value: string) => void;
  onSendRequest: () => void;
  onSaveSlug: () => void;
  onShareInvite: () => void;
  onAccept: (request: FriendRequestItem) => void;
  onDecline: (request: FriendRequestItem) => void;
  onCancel: (request: FriendRequestItem) => void;
  onAddToTrip: (friend: FriendProfile) => void;
  onRemove: (friend: FriendProfile) => void;
};

export function SocialFriendsModal(props: SocialFriendsModalProps) {
  const theme = useTheme();
  const chrome = socialChrome(theme);
  const insets = useSafeAreaInsets();
  const { spacing, s } = useResponsive();
  const [inviteToolsVisible, setInviteToolsVisible] = useState(false);
  const title = props.mode === 'trip' ? 'Invite to a Trip' : 'Friends';
  useScreenAtmosphereChrome(props.visible);

  useEffect(() => {
    if (!props.visible) setInviteToolsVisible(false);
  }, [props.visible]);

  return (
    <Modal
      visible={props.visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={props.onClose}>
      <View
        style={[
          styles.root,
          {
            paddingTop: insets.top + spacing.sm,
            paddingBottom: insets.bottom + spacing.sm,
          },
        ]}>
        <ScreenAtmosphere />
        <View style={[styles.header, { paddingHorizontal: spacing.lg, gap: spacing.md }]}>
          <SheetGrabber
            testID={AgentUiIds.social.friends.close}
            accessibilityLabel="Close friends"
            onPress={props.onClose}
          />
          <View style={[styles.headerTitleRow, { gap: spacing.md }]}>
            <View style={styles.headerCopy}>
              <AppText variant="overline" style={{ color: chrome.primary }} fit>
                Your circle
              </AppText>
              <AppText variant="heading" bold fit>
                {title}
              </AppText>
            </View>
            {props.signedIn ? (
              <IconButton
                testID={AgentUiIds.social.friends.openInviteTools}
                icon="invite"
                color={chrome.primary}
                accessibilityLabel="Add Friends"
                onPress={() => setInviteToolsVisible(true)}
              />
            ) : null}
          </View>
        </View>

        {!props.signedIn ? (
          <View style={[styles.signedOut, { padding: spacing.xl }]}>
            <EmptyState
              icon="people"
              title="Sign in to connect"
              message="Your friend list syncs securely after you sign in with Google or Apple."
            />
            <Button
              testID={AgentUiIds.social.friends.signIn}
              onPress={props.onSignIn}>
              Sign In
            </Button>
          </View>
        ) : (
          <ScrollView
            automaticallyAdjustKeyboardInsets
            keyboardDismissMode="interactive"
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{
              paddingHorizontal: spacing.lg,
              paddingTop: spacing.lg,
              paddingBottom: spacing.xl,
              gap: spacing.lg,
            }}>
            {props.error ? <ErrorMessage message={props.error} /> : null}

            {props.mode === 'trip' ? (
              <GlassPlate
                accent="green"
                style={[
                  styles.tripHint,
                  { padding: spacing.md, gap: spacing.sm },
                ]}>
                <Symbol name="flight" size="md" color={chrome.primary} />
                <View style={styles.tripHintCopy}>
                  <AppText variant="callout" bold fit>
                    Choose someone to invite
                  </AppText>
                  <AppText variant="caption" color="secondary">
                    Tap “Add to Trip,” then pick one of your existing plans.
                  </AppText>
                </View>
              </GlassPlate>
            ) : null}

            <AgentTestId
              testID={AgentUiIds.social.friends.listSection}
              label="Friends list"
              style={{ gap: spacing.sm }}>
              <SocialModalSectionTitle title="Friends" count={props.friends.length} />
              {props.loading && props.friends.length === 0 ? (
                <LoadingBlock label="Loading friends…" />
              ) : props.friends.length === 0 ? (
                <GlassPlate style={styles.emptyFriends}>
                  <EmptyState
                    icon="people"
                    title="Your Circle Is Ready for a Plot Twist"
                    message="Bring in your first friend, then start planning something worth talking about."
                    actionLabel="Add Your First Friend"
                    actionTestID={AgentUiIds.social.friends.emptyAdd}
                    onAction={() => setInviteToolsVisible(true)}
                  />
                </GlassPlate>
              ) : (
                props.friends.map((friend) => (
                  <GlassPlate
                    key={friend.userId}
                    style={[
                      styles.friendRow,
                      {
                        minHeight: Math.max(74, s(80)),
                        paddingHorizontal: spacing.md,
                        gap: spacing.md,
                      },
                    ]}>
                    <ProfileAvatar
                      displayName={friend.displayName}
                      userId={friend.userId}
                      size={Math.max(42, s(46))}
                    />
                    <View style={styles.friendCopy}>
                      <SocialIdentityName>{friend.displayName}</SocialIdentityName>
                      <AppText variant="caption" color="secondary" fit>
                        Connected through onTrack
                      </AppText>
                    </View>
                    <Button
                      testID={AgentUiIds.social.friendAddToTrip(friend.userId)}
                      variant="secondary"
                      disabled={Boolean(props.working)}
                      onPress={() => props.onAddToTrip(friend)}
                      style={styles.tripButton}>
                      Add to Trip
                    </Button>
                    <IconButton
                      testID={AgentUiIds.social.friendRemove(friend.userId)}
                      icon="delete"
                      color={theme.danger}
                      background="transparent"
                      accessibilityLabel={`Remove ${friend.displayName}`}
                      disabled={Boolean(props.working)}
                      onPress={() => props.onRemove(friend)}
                    />
                  </GlassPlate>
                ))
              )}
            </AgentTestId>

            {props.incoming.length > 0 ? (
              <View style={{ gap: spacing.sm }}>
                <SocialModalSectionTitle title="Friend Requests" count={props.incoming.length} />
                {props.incoming.map((request) => (
                  <GlassPlate
                    key={request.id}
                    style={[
                      styles.requestCard,
                      {
                        padding: spacing.md,
                        gap: spacing.md,
                      },
                    ]}>
                    <View style={styles.requestCopy}>
                      <SocialIdentityName>{request.otherDisplayName}</SocialIdentityName>
                      <AppText variant="caption" color="secondary" fit>
                        Wants to connect
                      </AppText>
                    </View>
                    <View style={[styles.requestActions, { gap: spacing.sm }]}>
                      <Button
                        testID={AgentUiIds.social.requestAccept(request.id)}
                        disabled={Boolean(props.working)}
                        onPress={() => props.onAccept(request)}
                        style={styles.flexButton}>
                        Accept
                      </Button>
                      <Button
                        testID={AgentUiIds.social.requestDecline(request.id)}
                        variant="secondary"
                        disabled={Boolean(props.working)}
                        onPress={() => props.onDecline(request)}
                        style={styles.flexButton}>
                        Decline
                      </Button>
                    </View>
                  </GlassPlate>
                ))}
              </View>
            ) : null}

            {props.outgoing.length > 0 ? (
              <View style={{ gap: spacing.sm }}>
                <SocialModalSectionTitle title="Pending" count={props.outgoing.length} />
                {props.outgoing.map((request) => (
                  <GlassPlate
                    key={request.id}
                    style={[
                      styles.friendRow,
                      {
                        minHeight: Math.max(62, s(66)),
                        paddingHorizontal: spacing.md,
                        gap: spacing.md,
                      },
                    ]}>
                    <View style={styles.requestCopy}>
                      <SocialIdentityName>{request.otherDisplayName}</SocialIdentityName>
                      <AppText variant="caption" color="secondary" fit>
                        Request pending
                      </AppText>
                    </View>
                    <Button
                      testID={AgentUiIds.social.requestCancel(request.id)}
                      variant="ghost"
                      disabled={Boolean(props.working)}
                      onPress={() => props.onCancel(request)}>
                      Cancel
                    </Button>
                  </GlassPlate>
                ))}
              </View>
            ) : null}

          </ScrollView>
        )}

        <SocialInviteToolsSheet
          visible={inviteToolsVisible}
          friendsProps={props}
          onClose={() => setInviteToolsVisible(false)}
        />
      </View>
    </Modal>
  );
}

function SocialInviteToolsSheet({
  visible,
  friendsProps,
  onClose,
}: {
  visible: boolean;
  friendsProps: SocialFriendsModalProps;
  onClose: () => void;
}) {
  const theme = useTheme();
  const chrome = socialChrome(theme);
  const { spacing } = useResponsive();

  if (!visible) return null;

  return (
    <View style={styles.inviteToolsHost}>
      <SheetScaffold
        host="route"
        visible
        eyebrow="Grow Your Circle"
        title="Add Friends"
        subtitle="Send a request or share your personal link—whichever feels more you."
        onClose={onClose}
        closeAccessibilityLabel="Close Add Friends"
        closeTestID={AgentUiIds.social.friends.inviteToolsClose}
        surface="glass"
        contentContainerStyle={{ gap: spacing.lg }}>
        {friendsProps.error ? <ErrorMessage message={friendsProps.error} /> : null}

        <GlassPlate
          style={[
            styles.addCard,
            {
              padding: spacing.lg,
              gap: spacing.md,
              ...socialShadow(chrome.shadow, 'raised'),
            },
          ]}>
          <View style={styles.sectionTitleRow}>
            <GlassIconWell size={40} borderRadius={14} style={styles.sectionIcon}>
              <Symbol name="invite" size="sm" color={chrome.primary} />
            </GlassIconWell>
            <View style={styles.sectionTitleCopy}>
              <AppText variant="subheading" bold fit>
                Add by Email
              </AppText>
              <AppText variant="caption" color="secondary" fit>
                Send a direct friend request
              </AppText>
            </View>
          </View>
          <Input
            testID={AgentUiIds.social.friendEmail}
            accessibilityLabel="Friend account email"
            label="Account Email"
            value={friendsProps.email}
            onChangeText={friendsProps.onEmailChange}
            placeholder="friend@example.com"
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
          />
          <Button
            testID={AgentUiIds.social.friendSend}
            icon="send"
            size="lg"
            disabled={!friendsProps.email.trim() || Boolean(friendsProps.working)}
            loading={friendsProps.working === 'send'}
            onPress={friendsProps.onSendRequest}>
            Send Request
          </Button>
        </GlassPlate>

        <GlassPlate
          inverted
          tintColor={chrome.primaryDeep}
          style={[
            styles.inviteCard,
            {
              padding: spacing.lg,
              gap: spacing.lg,
              ...socialShadow(chrome.shadow, 'overlay'),
            },
          ]}>
          <View style={styles.sectionTitleRow}>
            <GlassIconWell size={44} borderRadius={15}>
              <Symbol name="link" size="sm" color="#F7FFFA" />
            </GlassIconWell>
            <View style={styles.inviteCopy}>
              <AppText variant="subheading" color="onAccent" bold fit>
                Your Invite Link
              </AppText>
              <AppText variant="caption" color="onAccent" style={styles.faded}>
                Pick a memorable link, then share it anywhere.
              </AppText>
            </View>
          </View>
          <View style={[styles.slugRow, { gap: spacing.sm }]}>
            <AppText variant="callout" color="onAccent" style={styles.slugPrefix}>
              /f/
            </AppText>
            <View style={styles.slugField}>
              <Input
                testID={AgentUiIds.social.inviteSlug}
                accessibilityLabel="Custom invite link name"
                value={friendsProps.slugDraft}
                onChangeText={friendsProps.onSlugChange}
                placeholder="yourname"
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="off"
              />
            </View>
          </View>
          <Button
            testID={AgentUiIds.social.inviteSave}
            variant="secondary"
            disabled={
              Boolean(friendsProps.working) ||
              friendsProps.slugDraft === (friendsProps.savedSlug ?? '')
            }
            loading={friendsProps.working === 'slug'}
            onPress={friendsProps.onSaveSlug}>
            Save Link Name
          </Button>
          {friendsProps.inviteUrl ? (
            <GlassPlate mist style={styles.inviteUrlPlate}>
              <SocialPressable
                testID={AgentUiIds.social.inviteCopy}
                accessibilityLabel="Copy invite link"
                onPress={() => {
                  void Clipboard.setStringAsync(friendsProps.inviteUrl ?? '');
                  appPrompt.alert('Copied', 'Invite link copied to the clipboard.');
                }}
                style={[styles.inviteUrl, { gap: spacing.sm }]}>
                <View style={styles.inviteUrlCopy}>
                  <AppText variant="overline" color="onAccent" style={styles.faded} fit>
                    Ready to Share
                  </AppText>
                  <AppText
                    variant="caption"
                    color="onAccent"
                    numberOfLines={1}
                    ellipsizeMode="middle"
                    style={styles.inviteUrlText}>
                    {friendsProps.inviteUrl}
                  </AppText>
                </View>
                <Symbol name="copy" size="sm" color="#F7FFFA" />
              </SocialPressable>
            </GlassPlate>
          ) : null}
          <Button
            testID={AgentUiIds.social.inviteShare}
            icon="share"
            size="lg"
            disabled={Boolean(friendsProps.working)}
            loading={friendsProps.working === 'link'}
            onPress={friendsProps.onShareInvite}>
            Share Invite Link
          </Button>
        </GlassPlate>
      </SheetScaffold>
    </View>
  );
}

function SocialIdentityName({ children }: { children: string }) {
  return (
    <AppText variant="callout" bold numberOfLines={1} ellipsizeMode="tail">
      {children}
    </AppText>
  );
}

function SocialModalSectionTitle({ title, count }: { title: string; count: number }) {
  const theme = useTheme();
  const chrome = socialChrome(theme);
  return (
    <View style={styles.modalSectionTitle}>
      <AppText variant="subheading" bold fit>
        {title}
      </AppText>
      <GlassTonePill
        label={String(count)}
        toneColor={chrome.primary}
        showDot={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  header: {
    alignSelf: 'stretch',
  },
  headerTitleRow: {
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerCopy: {
    flex: 1,
    alignSelf: 'stretch',
    minWidth: 0,
    gap: 2,
  },
  inviteToolsHost: {
    ...StyleSheet.absoluteFill,
    zIndex: 20,
  },
  signedOut: {
    flex: 1,
    justifyContent: 'center',
    gap: 20,
  },
  tripHint: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radii.lg,
    borderCurve: 'continuous',
  },
  tripHintCopy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  addCard: {
    borderRadius: radii.xl,
    borderCurve: 'continuous',
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  sectionIcon: {
    width: 40,
    height: 40,
    borderRadius: 14,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTitleCopy: {
    flex: 1,
    minWidth: 0,
    gap: 1,
  },
  inviteCard: {
    borderRadius: radii.xl,
    borderCurve: 'continuous',
  },
  inviteCopy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  faded: {
    opacity: 0.76,
  },
  slugRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  slugPrefix: {
    minWidth: 30,
  },
  slugField: {
    flex: 1,
    minWidth: 0,
  },
  inviteUrl: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  inviteUrlCopy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  inviteUrlPlate: {
    borderRadius: radii.lg,
    borderCurve: 'continuous',
    overflow: 'hidden',
  },
  inviteUrlText: {
    flexShrink: 1,
    minWidth: 0,
  },
  requestCard: {
    borderRadius: radii.lg,
    borderCurve: 'continuous',
  },
  requestCopy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  requestActions: {
    flexDirection: 'row',
  },
  flexButton: {
    flex: 1,
  },
  modalSectionTitle: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  friendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radii.lg,
    borderCurve: 'continuous',
  },
  friendCopy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  tripButton: {
    minHeight: 44,
    paddingHorizontal: 12,
  },
  emptyFriends: {
    minHeight: 180,
    borderRadius: radii.xl,
    borderCurve: 'continuous',
  },
});
