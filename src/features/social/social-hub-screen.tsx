import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { appPrompt, ErrorMessage, Screen } from '@/components/primitives';
import { promptReportContent } from '@/features/account/report-content';
import { useAuthSession } from '@/features/auth/auth-provider';
import { SocialActionModal } from '@/features/social/social-action-modal';
import { SocialActivityFeed } from '@/features/social/social-feed';
import { buildSocialFeedItems } from '@/features/social/social-feed-model';
import { SocialFriendsModal } from '@/features/social/social-friends-modal';
import {
    SocialFriendsCard,
    SocialHeader,
    SocialQuickActions,
    SocialUpcomingTogether,
} from '@/features/social/social-hub-sections';
import { socialTripMemberships } from '@/features/social/social-trip-membership';
import type {
    SocialFeedItem,
    SocialPlaceholder,
    SocialQuickActionId,
} from '@/features/social/social-types';
import type { TravelPlan } from '@/features/travel/types';
import { useRouteIsActive } from '@/hooks/use-app-activity';
import { useFriendsRealtime } from '@/hooks/use-friends-realtime';
import { useResponsive } from '@/hooks/use-responsive';
import {
    createFriendInviteUrl,
    getMyFriendInvite,
    setFriendInviteSlug,
    shareFriendInvite,
    type FriendProfile,
    type FriendRequestItem,
    type MyFriendInvite,
} from '@/services/friends';
import { blockUser } from '@/services/moderation';
import { useFriends } from '@/store/friends';
import { usePreferences } from '@/store/preferences';
import { useTravel } from '@/store/travel';
import { confirmDestructiveAction } from '@/utils/confirm-destructive';

/** Social hub backed by the existing friend, profile, and travel stores. */
export function SocialHubScreen() {
  const router = useRouter();
  const { spacing } = useResponsive();
  const { user, isGuest } = useAuthSession();
  const selfName = usePreferences((state) => state.name).trim() || 'You';
  const friends = useFriends((state) => state.friends);
  const incoming = useFriends((state) => state.incoming);
  const outgoing = useFriends((state) => state.outgoing);
  const loading = useFriends((state) => state.loading);
  const error = useFriends((state) => state.error);
  const lastLoadedAt = useFriends((state) => state.lastLoadedAt);
  const hydrate = useFriends((state) => state.hydrate);
  const refreshFriends = useFriends((state) => state.refresh);
  const sendRequest = useFriends((state) => state.sendRequest);
  const acceptRequest = useFriends((state) => state.acceptRequest);
  const declineRequest = useFriends((state) => state.declineRequest);
  const cancelRequest = useFriends((state) => state.cancelRequest);
  const removeFriend = useFriends((state) => state.remove);
  const plans = useTravel((state) => state.plans);

  const [friendsModalVisible, setFriendsModalVisible] = useState(false);
  const [email, setEmail] = useState('');
  const [working, setWorking] = useState<string>();
  const [localError, setLocalError] = useState<string>();
  const [invite, setInvite] = useState<MyFriendInvite>();
  const [slugDraft, setSlugDraft] = useState('');
  const [placeholder, setPlaceholder] = useState<SocialPlaceholder>();
  const [placeholderPrimary, setPlaceholderPrimary] = useState<() => void>();

  const signedIn = Boolean(user) && !isGuest;
  const routeIsActive = useRouteIsActive();
  useFriendsRealtime(signedIn ? user?.id : undefined, routeIsActive);
  const shareBase =
    process.env.EXPO_PUBLIC_FRIEND_SHARE_BASE_URL ??
    process.env.EXPO_PUBLIC_TODO_SHARE_BASE_URL;
  const inviteUrl = invite
    ? createFriendInviteUrl(invite.sharePath, shareBase)
    : undefined;
  const feedItems = useMemo(
    () =>
      buildSocialFeedItems({
        friends,
        plans,
        self: {
          userId: user?.id ?? 'self',
          displayName: selfName,
        },
      }),
    [friends, plans, selfName, user?.id],
  );

  const run = useCallback(async (key: string, action: () => Promise<void>) => {
    setWorking(key);
    setLocalError(undefined);
    try {
      await action();
    } catch (caught) {
      setLocalError(
        caught instanceof Error ? caught.message : 'Something went wrong.',
      );
    } finally {
      setWorking(undefined);
    }
  }, []);

  const loadInvite = useCallback(async () => {
    const next = await getMyFriendInvite();
    setInvite(next);
    setSlugDraft(next.slug ?? '');
  }, []);

  useEffect(() => {
    if (!signedIn) return;
    if (!lastLoadedAt && !loading) {
      void hydrate({ email: user?.email ?? undefined });
    }
    if (!invite) void loadInvite().catch(() => undefined);
  }, [
    hydrate,
    invite,
    lastLoadedAt,
    loadInvite,
    loading,
    signedIn,
    user?.email,
  ]);

  const refreshSocial = useCallback(async () => {
    if (!signedIn) return;
    await Promise.all([refreshFriends(), loadInvite()]);
  }, [loadInvite, refreshFriends, signedIn]);

  const openFriends = useCallback(() => {
    setFriendsModalVisible(true);
  }, []);

  const showPlaceholder = useCallback(
    (content: SocialPlaceholder, primary?: () => void) => {
      setPlaceholder(content);
      setPlaceholderPrimary(() => primary);
    },
    [],
  );

  const closePlaceholder = useCallback(() => {
    setPlaceholder(undefined);
    setPlaceholderPrimary(undefined);
  }, []);

  const openPlan = useCallback(
    (plan: TravelPlan) => {
      router.navigate({
        pathname: '/(tabs)/travel',
        params: { tripId: plan.id },
      } as never);
    },
    [router],
  );

  const goToSignIn = useCallback(() => {
    setFriendsModalVisible(false);
    router.push({
      pathname: '/account',
      params: { returnTo: '/(tabs)/social' },
    } as never);
  }, [router]);

  const openFriendProfile = useCallback(
    (friend: FriendProfile) => {
      const memberships = socialTripMemberships(friend, plans);
      const sharedTrips = memberships.filter(
        (membership) => membership.status === 'member',
      );
      const pendingTrips = memberships.filter(
        (membership) => membership.status === 'invited',
      );
      const firstShared = sharedTrips[0]?.plan;
      const firstPending = pendingTrips[0]?.plan;
      const sharedTripNames = sharedTrips
        .map(({ plan }) => plan.title)
        .join(', ');
      const pendingTripNames = pendingTrips
        .map(({ plan }) => plan.title)
        .join(', ');

      if (firstShared) {
        const sharedCount = sharedTrips.length;
        showPlaceholder(
          {
            id: `friend-${friend.userId}`,
            title: friend.displayName,
            message: 'You’re connected through onTrack and already traveling together.',
            icon: 'people',
            statusTitle: `${sharedCount} shared ${sharedCount === 1 ? 'trip' : 'trips'}`,
            statusMessage: sharedTripNames,
            primaryLabel:
              sharedCount === 1
                ? `Open ${firstShared.title}`
                : 'View Shared Trips',
          },
          () => {
            closePlaceholder();
            if (sharedCount === 1) openPlan(firstShared);
            else router.push('/(tabs)/travel' as never);
          },
        );
        return;
      }

      if (firstPending) {
        showPlaceholder(
          {
            id: `friend-${friend.userId}`,
            title: friend.displayName,
            message: 'You’re connected through onTrack.',
            icon: 'people',
            statusTitle: 'Trip invitation pending',
            statusMessage: pendingTripNames,
            primaryLabel: `Open ${firstPending.title}`,
          },
          () => {
            closePlaceholder();
            openPlan(firstPending);
          },
        );
        return;
      }

      showPlaceholder(
        {
          id: `friend-${friend.userId}`,
          title: friend.displayName,
          message: 'Connected through onTrack. Shared plans and invitations stay attached to this friendship.',
          icon: 'people',
          primaryLabel: 'Open Travel',
          statusTitle: 'Connected',
          statusMessage:
            'Open a trip to manage its friends and travelers.',
        },
        () => {
          closePlaceholder();
          router.push('/(tabs)/travel' as never);
        },
      );
    },
    [
      closePlaceholder,
      openPlan,
      plans,
      router,
      showPlaceholder,
    ],
  );

  const openMessages = useCallback(() => {
    const chatPlan = plans.find(
      (plan) => plan.participants.length > 0 || Boolean(plan.chatAccessCode),
    );
    if (chatPlan) {
      router.push({
        pathname: '/travel/[id]/chat',
        params: { id: chatPlan.id },
      } as never);
      return;
    }
    showPlaceholder(
      {
        id: 'messages',
        title: 'Messages',
        message:
          'No conversations yet. Invite friends to a trip to open your first shared group chat.',
        icon: 'chat',
        primaryLabel: 'Open Travel',
      },
      () => {
        closePlaceholder();
        router.push('/(tabs)/travel' as never);
      },
    );
  }, [closePlaceholder, plans, router, showPlaceholder]);

  const handleQuickAction = useCallback(
    (action: SocialQuickActionId) => {
      const routes: Partial<Record<SocialQuickActionId, string>> = {
        challenge: '/(tabs)/games',
        'share-calendar': '/(tabs)/calendar',
        'share-todos': '/(tabs)/to-do',
        'share-workout': '/(tabs)/workouts',
      };
      const route = routes[action];
      if (route) {
        router.push(route as never);
        return;
      }
      if (action === 'invite-trip') {
        router.push('/(tabs)/travel' as never);
        return;
      }
      if (action === 'chat') {
        openMessages();
        return;
      }
      if (action === 'share-photos') {
        const plan = plans[0];
        if (plan) {
          router.push({
            pathname: '/travel/[id]',
            params: { id: plan.id },
          } as never);
        } else {
          router.push('/(tabs)/travel' as never);
        }
        return;
      }

      const placeholders: Record<
        'share-story' | 'poll' | 'create-group',
        SocialPlaceholder
      > = {
        'share-story': {
          id: 'story',
          title: 'Share a Story',
          message:
            'No story is live right now. Story creation is ready for temporary photos and moments from your circle.',
          icon: 'plus-circle',
        },
        poll: {
          id: 'poll',
          title: 'Poll / Vote',
          message:
            'No polls are waiting for your vote. New group polls will appear here and in the activity feed.',
          icon: 'insights',
        },
        'create-group': {
          id: 'group',
          title: 'Create a Group',
          message:
            'You have no standalone groups yet. Shared trip groups and their chats already work through Travel.',
          icon: 'people',
          primaryLabel: 'Open Travel',
        },
      };
      const content = placeholders[action as keyof typeof placeholders];
      showPlaceholder(
        content,
        action === 'create-group'
          ? () => {
              closePlaceholder();
              router.push('/(tabs)/travel' as never);
            }
          : undefined,
      );
    },
    [
      closePlaceholder,
      openFriends,
      openMessages,
      plans,
      router,
      showPlaceholder,
    ],
  );

  const openFeedItem = useCallback(
    (item: SocialFeedItem) => {
      if (item.kind === 'trip' || item.kind === 'photos') {
        router.push({
          pathname: '/travel/[id]',
          params: { id: item.tripId },
        } as never);
        return;
      }
      if (item.kind === 'connection') {
        const friend = friends.find(
          (entry) => entry.userId === item.actor.userId,
        );
        if (friend) openFriendProfile(friend);
        return;
      }
      showPlaceholder({
        id: `feed-${item.id}`,
        title:
          item.kind === 'workout'
            ? item.workoutTitle
            : item.kind === 'story'
              ? 'Story'
              : 'Poll',
        message:
          'This shared update is ready to open once its social service is connected.',
        icon:
          item.kind === 'workout'
            ? 'gym'
            : item.kind === 'story'
              ? 'photo'
              : 'insights',
      });
    },
    [friends, openFriendProfile, router, showPlaceholder],
  );

  const remove = useCallback(
    (friend: FriendProfile) => {
      void confirmDestructiveAction({
        title: 'Remove Friend?',
        message: `${friend.displayName} will be removed from your friends list. Shared trips and lists stay as they are.`,
        actionLabel: 'Remove',
        onConfirm: () =>
          void run(`remove-${friend.userId}`, () =>
            removeFriend(friend.userId),
          ),
      });
    },
    [removeFriend, run],
  );

  const block = useCallback(
    (friend: FriendProfile) => {
      void confirmDestructiveAction({
        title: 'Block This Person?',
        message: `${friend.displayName} will be removed from your friends list and you will stop seeing their messages.`,
        actionLabel: 'Block',
        onConfirm: () =>
          void run(`block-${friend.userId}`, () => blockUser(friend.userId)),
      });
    },
    [run],
  );

  const report = useCallback((friend: FriendProfile) => {
    promptReportContent({
      kind: 'user',
      targetUserId: friend.userId,
      contentId: friend.userId,
    });
  }, []);

  const accept = useCallback(
    (request: FriendRequestItem) => {
      void run(`accept-${request.id}`, () => acceptRequest(request.id));
    },
    [acceptRequest, run],
  );
  const decline = useCallback(
    (request: FriendRequestItem) => {
      void run(`decline-${request.id}`, () => declineRequest(request.id));
    },
    [declineRequest, run],
  );
  const cancel = useCallback(
    (request: FriendRequestItem) => {
      void run(`cancel-${request.id}`, () => cancelRequest(request.id));
    },
    [cancelRequest, run],
  );

  return (
    <>
      <Screen
        refresh={signedIn}
        onRefresh={refreshSocial}
        contentStyle={{ gap: spacing.xl }}
      >
        <SocialHeader
          pendingCount={incoming.length}
          onAddFriend={openFriends}
          onMessages={openMessages}
        />

        {localError || error ? (
          <ErrorMessage message={localError ?? error ?? ''} />
        ) : null}

        <SocialFriendsCard
          friends={friends}
          loading={loading}
          onAddFriend={openFriends}
          onSeeAll={openFriends}
          onOpenFriend={openFriendProfile}
        />

        <SocialQuickActions onAction={handleQuickAction} />

        <SocialUpcomingTogether
          plans={plans}
          friends={friends}
          selfName={selfName}
          onSeeAll={() => router.push('/(tabs)/travel' as never)}
          onOpenPlan={openPlan}
        />

        <SocialActivityFeed items={feedItems} onOpenItem={openFeedItem} />
      </Screen>

      <SocialFriendsModal
        visible={friendsModalVisible}
        signedIn={signedIn}
        friends={friends}
        incoming={incoming}
        outgoing={outgoing}
        loading={loading}
        working={working}
        error={localError ?? error}
        email={email}
        inviteUrl={inviteUrl}
        slugDraft={slugDraft}
        savedSlug={invite?.slug}
        onClose={() => setFriendsModalVisible(false)}
        onSignIn={goToSignIn}
        onEmailChange={setEmail}
        onSlugChange={(value) =>
          setSlugDraft(value.toLowerCase().replace(/[^a-z0-9-]/g, ''))
        }
        onSendRequest={() =>
          void run('send', async () => {
            await sendRequest(email);
            setEmail('');
            appPrompt.alert(
              'Request Sent',
              'They will see it in Social when they sign in.',
            );
          })
        }
        onSaveSlug={() =>
          void run('slug', async () => {
            const saved = await setFriendInviteSlug(slugDraft || null);
            await loadInvite();
            appPrompt.alert(
              saved ? 'Link Updated' : 'Custom Link Cleared',
              saved
                ? `Friends can use /f/${saved}`
                : 'Sharing will use a private invite code until you set a name again.',
            );
          })
        }
        onShareInvite={() =>
          void run('link', async () => {
            const next = await getMyFriendInvite();
            setInvite(next);
            setSlugDraft(next.slug ?? '');
            await shareFriendInvite(next.sharePath);
          })
        }
        onAccept={accept}
        onDecline={decline}
        onCancel={cancel}
        onRemove={remove}
        onBlock={block}
        onReport={report}
      />

      <SocialActionModal
        content={placeholder}
        onClose={closePlaceholder}
        onPrimary={placeholderPrimary}
      />
    </>
  );
}
