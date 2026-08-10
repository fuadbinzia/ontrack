import * as Clipboard from 'expo-clipboard';
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
  IconButton,
  Input,
  LoadingBlock,
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
import { AgentUiIds } from '@/utils/agent-ui';

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
  const title = props.mode === 'trip' ? 'Invite to a Trip' : props.mode === 'all' ? 'Your Friends' : 'Add Friends';
  useScreenAtmosphereChrome(props.visible);

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
        <View style={[styles.header, { paddingHorizontal: spacing.lg, gap: spacing.md }]}>
          <SheetGrabber
            testID={AgentUiIds.social.friends.close}
            accessibilityLabel="Close friends"
            onPress={props.onClose}
          />
          <View style={styles.headerCopy}>
            <AppText variant="overline" style={{ color: chrome.primary }} fit>
              Your circle
            </AppText>
            <AppText variant="heading" bold fit>
              {title}
            </AppText>
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
              onPress={props.onSignIn}
              style={{ backgroundColor: chrome.primary }}>
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
              <View
                style={[
                  styles.tripHint,
                  { backgroundColor: chrome.mint, padding: spacing.md, gap: spacing.sm },
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
              </View>
            ) : null}

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
                    Add by email
                  </AppText>
                  <AppText variant="caption" color="secondary" fit>
                    Send a direct friend request
                  </AppText>
                </View>
              </View>
              <Input
                testID={AgentUiIds.social.friendEmail}
                accessibilityLabel="Friend account email"
                label="Account email"
                value={props.email}
                onChangeText={props.onEmailChange}
                placeholder="friend@example.com"
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />
              <Button
                testID={AgentUiIds.social.friendSend}
                icon="send"
                disabled={!props.email.trim() || Boolean(props.working)}
                loading={props.working === 'send'}
                onPress={props.onSendRequest}
                style={{ backgroundColor: chrome.primary }}>
                Send Request
              </Button>
            </GlassPlate>

            <View
              style={[
                styles.inviteCard,
                {
                  backgroundColor: chrome.primaryDeep,
                  padding: spacing.lg,
                  gap: spacing.md,
                },
              ]}>
              <View style={styles.sectionTitleRow}>
                <View style={styles.inviteCopy}>
                  <AppText variant="subheading" color="onAccent" bold fit>
                    Your invite link
                  </AppText>
                  <AppText variant="caption" color="onAccent" style={styles.faded}>
                    Pick a memorable link, then share it anywhere.
                  </AppText>
                </View>
                <Symbol name="link" size="md" color="#F7FFFA" />
              </View>
              <View style={[styles.slugRow, { gap: spacing.sm }]}>
                <AppText variant="callout" color="onAccent" fit style={styles.slugPrefix}>
                  /f/
                </AppText>
                <View style={styles.slugField}>
                  <Input
                    testID={AgentUiIds.social.inviteSlug}
                    accessibilityLabel="Custom invite link name"
                    value={props.slugDraft}
                    onChangeText={props.onSlugChange}
                    placeholder="yourname"
                    placeholderTextColor="rgba(247,255,250,0.56)"
                    fieldBackground="rgba(247,255,250,0.14)"
                    autoCapitalize="none"
                    autoCorrect={false}
                    autoComplete="off"
                  />
                </View>
              </View>
              <Button
                testID={AgentUiIds.social.inviteSave}
                variant="secondary"
                disabled={Boolean(props.working) || props.slugDraft === (props.savedSlug ?? '')}
                loading={props.working === 'slug'}
                onPress={props.onSaveSlug}
                style={{ backgroundColor: '#F4FBF6' }}>
                Save Link Name
              </Button>
              {props.inviteUrl ? (
                <SocialPressable
                  testID={AgentUiIds.social.inviteCopy}
                  accessibilityLabel="Copy invite link"
                  onPress={() => {
                    void Clipboard.setStringAsync(props.inviteUrl ?? '');
                    appPrompt.alert('Copied', 'Invite link copied to the clipboard.');
                  }}
                  style={styles.inviteUrl}>
                  <AppText variant="caption" color="onAccent" numberOfLines={2}>
                    {props.inviteUrl}
                  </AppText>
                  <Symbol name="copy" size="sm" color="#F7FFFA" />
                </SocialPressable>
              ) : null}
              <Button
                testID={AgentUiIds.social.inviteShare}
                icon="share"
                disabled={Boolean(props.working)}
                loading={props.working === 'link'}
                onPress={props.onShareInvite}
                style={{ backgroundColor: chrome.primary }}>
                Share Invite Link
              </Button>
            </View>

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
                      <AppText variant="callout" bold fit>
                        {request.otherDisplayName}
                      </AppText>
                      <AppText variant="caption" color="secondary" fit>
                        {request.otherEmail || 'Wants to connect'}
                      </AppText>
                    </View>
                    <View style={[styles.requestActions, { gap: spacing.sm }]}>
                      <Button
                        testID={AgentUiIds.social.requestAccept(request.id)}
                        disabled={Boolean(props.working)}
                        onPress={() => props.onAccept(request)}
                        style={{ flex: 1, backgroundColor: chrome.primary }}>
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
                      <AppText variant="callout" bold fit>
                        {request.otherDisplayName}
                      </AppText>
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

            <View style={{ gap: spacing.sm }}>
              <SocialModalSectionTitle title="Friends" count={props.friends.length} />
              {props.loading && props.friends.length === 0 ? (
                <LoadingBlock label="Loading friends…" />
              ) : props.friends.length === 0 ? (
                <GlassPlate
                  style={[
                    styles.emptyFriends,
                  ]}>
                  <EmptyState
                    icon="people"
                    title="No friends yet"
                    message="Send a request or share your personal invite link above."
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
                      <AppText variant="callout" bold fit>
                        {friend.displayName}
                      </AppText>
                      <AppText variant="caption" color="secondary" fit>
                        {friend.email}
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
            </View>
          </ScrollView>
        )}
      </View>
    </Modal>
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
      <View style={[styles.countPill, { backgroundColor: chrome.mint }]}>
        <AppText variant="caption" bold fit style={{ color: chrome.primary }}>
          {count}
        </AppText>
      </View>
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
  headerCopy: {
    alignSelf: 'stretch',
    minWidth: 0,
    gap: 2,
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
    alignItems: 'flex-end',
  },
  slugPrefix: {
    paddingBottom: 14,
  },
  slugField: {
    flex: 1,
    minWidth: 0,
  },
  inviteUrl: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
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
  countPill: {
    minWidth: 32,
    height: 28,
    paddingHorizontal: 8,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
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
