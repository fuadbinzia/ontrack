import * as Linking from 'expo-linking';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import {
  AppText,
  Button,
  ErrorMessage,
  LoadingBlock,
  Screen,
  Symbol,
} from '@/components/primitives';
import { spacing } from '@/design-system';
import { useAuthSession } from '@/features/auth/auth-provider';
import { useRouteIsActive } from '@/hooks/use-app-activity';
import { travelCalendarDrafts } from '@/features/travel/calendar';
import {
  buildOpenJoinMemberPlan,
  findExistingOpenJoinPlan,
  mergeResolvedTravelOpenJoinPlan,
} from '@/features/travel/open-join-plan';
import {
  createInstalledTravelOpenJoinUrl,
  isOpenTravelJoinCode,
  loadTravelOpenJoinStatus,
  ONTRACK_APP_STORE_URL,
  previewTravelOpenJoin,
  requestTravelOpenJoin,
  resolveTravelOpenJoin,
} from '@/features/travel/share';
import { travelOverlineStyle } from '@/features/travel/travel-chrome';
import { TravelSurfaceCard } from '@/features/travel/travel-surface';
import { listTravelTripRoster } from '@/features/travel/trip-roster';
import type {
  TravelOpenJoinPreview,
  TravelOpenJoinStatus,
} from '@/features/travel/types';
import { pullTravelTripItinerary } from '@/services/travel/itinerary-collaboration';
import { useAddons } from '@/store/addons';
import { usePreferences } from '@/store/preferences';
import { useSchedule } from '@/store/schedule';
import { useTravel } from '@/store/travel';
import { formatDateLong } from '@/utils/date';

export function TravelOpenJoinLanding({ code }: { code?: string }) {
  const router = useRouter();
  const routeIsActive = useRouteIsActive();
  const { user, continueWithProvider, workingProvider } = useAuthSession();
  const hasOnboarded = usePreferences((state) => state.hasOnboarded);
  const savePlan = useTravel((state) => state.savePlan);
  const replaceTravelActivities = useSchedule(
    (state) => state.replaceTravelActivities,
  );
  const setAddonEnabled = useAddons((state) => state.setEnabled);
  const isWeb = process.env.EXPO_OS === 'web';
  const validCode = Boolean(code && isOpenTravelJoinCode(code));
  const [preview, setPreview] = useState<TravelOpenJoinPreview>();
  const [previewError, setPreviewError] = useState<string>();
  const [status, setStatus] = useState<TravelOpenJoinStatus>();
  const [grantedInviteCode, setGrantedInviteCode] = useState<string>();
  const [actionError, setActionError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [loadingPreview, setLoadingPreview] = useState(validCode);
  const openedApproved = useRef(false);
  const previewMessage =
    !validCode || !code
      ? 'This join link looks incomplete. Ask the host for a fresh link.'
      : previewError;

  const openApprovedTrip = useCallback(async () => {
    if (!code || openedApproved.current) return;
    openedApproved.current = true;
    setBusy(true);
    setActionError(undefined);
    try {
      const resolved = await resolveTravelOpenJoin(code);
      const status = resolved.status === 'host' ? 'host' : 'approved';
      const chatCode = resolved.grantedInviteCode ?? grantedInviteCode;
      if (status === 'approved' && !chatCode) {
        throw new Error(
          'Your join was approved, but the trip invite is missing. Ask the host to share the link again.',
        );
      }

      let hostDisplayName: string | undefined;
      if (status === 'approved') {
        try {
          const roster = await listTravelTripRoster(resolved.tripId);
          hostDisplayName = roster.find(
            (person) => person.role === 'host',
          )?.displayName;
        } catch {
          // Roster is best-effort; chat access + hostTripId still unlock the trip.
        }
      }

      // Prefer the store after the network round-trip so edits made while
      // resolving are not restored from a stale closure snapshot.
      const latestPlans = useTravel.getState().plans;
      const existing = findExistingOpenJoinPlan(latestPlans, {
        status,
        tripId: resolved.tripId,
        openJoinCode: code,
        chatAccessCode: chatCode,
      });
      const now = new Date().toISOString();

      if (existing) {
        const merged = mergeResolvedTravelOpenJoinPlan(existing, {
          status,
          tripId: resolved.tripId,
          chatAccessCode: chatCode,
          hostDisplayName,
          updatedAt: now,
        });
        savePlan(merged);
        void pullTravelTripItinerary(merged).catch(() => undefined);
        setAddonEnabled('travel', true);
        router.replace(
          hasOnboarded
            ? (`/travel/${merged.id}` as never)
            : ({
                pathname: '/welcome',
                params: { returnTo: '/travel' },
              } as never),
        );
        return;
      }

      if (status === 'host') {
        // Host opened their own link with no local plan match — send them home.
        setAddonEnabled('travel', true);
        router.replace(
          hasOnboarded
            ? (`/travel/${resolved.tripId}` as never)
            : ({
                pathname: '/welcome',
                params: { returnTo: '/travel' },
              } as never),
        );
        return;
      }

      const plan = buildOpenJoinMemberPlan({
        resolvedPlan: resolved.plan,
        tripId: resolved.tripId,
        chatAccessCode: chatCode!,
        hostDisplayName,
        now,
      });
      savePlan(plan);
      void pullTravelTripItinerary(plan).catch(() => undefined);
      replaceTravelActivities(plan.id, travelCalendarDrafts(plan));
      setAddonEnabled('travel', true);
      router.replace(
        hasOnboarded
          ? (`/travel/${plan.id}` as never)
          : ({
              pathname: '/welcome',
              params: { returnTo: '/travel' },
            } as never),
      );
    } catch (error) {
      openedApproved.current = false;
      setActionError(
        error instanceof Error
          ? error.message
          : 'The trip host has not approved your join request yet.',
      );
    } finally {
      setBusy(false);
    }
  }, [
    code,
    grantedInviteCode,
    hasOnboarded,
    replaceTravelActivities,
    router,
    savePlan,
    setAddonEnabled,
  ]);

  useEffect(() => {
    if (!validCode || !code) return;
    let active = true;
    void previewTravelOpenJoin(code)
      .then((result) => {
        if (!active) return;
        if (!result) {
          setPreview(undefined);
          setPreviewError('This join link expired. Ask the host for a fresh one.');
          return;
        }
        setPreview(result);
        setPreviewError(undefined);
      })
      .catch(() => {
        if (!active) return;
        setPreviewError('This join link could not be opened.');
      })
      .finally(() => {
        if (active) setLoadingPreview(false);
      });
    return () => {
      active = false;
    };
  }, [code, validCode]);

  useEffect(() => {
    if (isWeb || !user || !validCode) return;
    let active = true;
    void loadTravelOpenJoinStatus(code!)
      .then((result) => {
        if (!active) return;
        if (!result) {
          setStatus(undefined);
          return;
        }
        setStatus(result.status);
        setGrantedInviteCode(result.grantedInviteCode);
        if (result.status === 'approved' || result.status === 'host') {
          void openApprovedTrip();
        }
      })
      .catch((error: unknown) => {
        if (!active) return;
        setActionError(
          error instanceof Error
            ? error.message
            : 'Join status could not be loaded.',
        );
      });
    return () => {
      active = false;
    };
  }, [code, isWeb, openApprovedTrip, user, validCode]);

  useEffect(() => {
    if (!routeIsActive || isWeb || !user || status !== 'pending' || !code)
      return;
    const timer = setInterval(() => {
      void loadTravelOpenJoinStatus(code)
        .then((result) => {
          if (!result) return;
          setStatus(result.status);
          setGrantedInviteCode(result.grantedInviteCode);
          if (result.status === 'approved' || result.status === 'host') {
            void openApprovedTrip();
          }
        })
        .catch(() => undefined);
    }, 4000);
    return () => clearInterval(timer);
  }, [code, isWeb, openApprovedTrip, routeIsActive, status, user]);

  const sendJoinRequest = async () => {
    if (!code || !validCode) return;
    setBusy(true);
    setActionError(undefined);
    try {
      const result = await requestTravelOpenJoin(code);
      setStatus(result.status);
      setGrantedInviteCode(result.grantedInviteCode);
      if (result.status === 'approved' || result.status === 'host') {
        await openApprovedTrip();
      }
    } catch (error) {
      setActionError(
        error instanceof Error
          ? error.message
          : 'Your join request could not be sent.',
      );
    } finally {
      setBusy(false);
    }
  };

  if (isWeb) {
    const customSchemeUrl = code
      ? createInstalledTravelOpenJoinUrl(code)
      : 'ontrack:///travel';
    return (
      <Screen contentStyle={styles.webPage} bottomInset={false}>
        <View style={styles.brand}>
          <AppText
            variant="overline"
            color="accent"
            style={travelOverlineStyle}
          >
            onTrack Travel
          </AppText>
          <AppText variant="display">Join This Trip ✈️</AppText>
          <AppText variant="body" color="secondary">
            Anyone with this link can request to join. The trip host approves
            each new friend.
          </AppText>
        </View>

        <TravelSurfaceCard>
          {loadingPreview ? (
            <LoadingBlock label="Loading trip…" />
          ) : previewMessage ? (
            <ErrorMessage message={previewMessage} variant="body" />
          ) : preview ? (
            <>
              <AppText variant="title">{preview.title}</AppText>
              <AppText variant="body" color="secondary">
                {preview.destination}
              </AppText>
              <AppText variant="callout" color="secondary">
                {formatDateLong(preview.startDate)} –{' '}
                {formatDateLong(preview.endDate)}
              </AppText>
              <AppText variant="caption" color="tertiary">
                Open in onTrack to request access. If you don’t have the app
                yet, download it first.
              </AppText>
            </>
          ) : (
            <ErrorMessage
              message={
                previewMessage ?? 'This join link looks incomplete. Ask the host for a fresh link.'
              }
              variant="body"
            />
          )}
        </TravelSurfaceCard>

        {validCode && !previewMessage ? (
          <View style={styles.buttons}>
            <Button
              icon="open-external"
              onPress={() => void Linking.openURL(customSchemeUrl)}
            >
              Open in onTrack
            </Button>
            <Button
              variant="secondary"
              icon="download"
              onPress={() => void Linking.openURL(ONTRACK_APP_STORE_URL)}
            >
              Download from the App Store
            </Button>
          </View>
        ) : null}
        <AppText variant="caption" color="secondary" align="center">
          New here? Install onTrack, return to this link, then tap Open in
          onTrack. The host still needs to approve your request.
        </AppText>
      </Screen>
    );
  }

  if (!validCode || previewMessage) {
    return (
      <Screen contentStyle={styles.center}>
        <Symbol name="airplane" size={44} />
        <ErrorMessage
          message={previewMessage ?? 'This join link looks incomplete. Ask the host for a fresh link.'}
          variant="heading"
          align="center"
        />
        <Button onPress={() => router.replace('/' as never)}>
          Go to onTrack
        </Button>
      </Screen>
    );
  }

  if (!user) {
    const returnTo = code ? `/j/${code}` : '/travel';
    return (
      <Screen contentStyle={styles.center}>
        <Symbol name="airplane" size={44} />
        <AppText variant="display" align="center">
          Join This Trip ✈️
        </AppText>
        {preview ? (
          <AppText variant="body" color="secondary" align="center">
            {preview.title} · {preview.destination}
          </AppText>
        ) : null}
        <AppText variant="body" color="secondary" align="center">
          Sign in to request to join. The trip host will approve new friends
          before you can open the itinerary.
        </AppText>
        <Button
          disabled={Boolean(workingProvider)}
          onPress={() => void continueWithProvider('apple', returnTo)}
        >
          {workingProvider === 'apple'
            ? 'Opening Apple…'
            : 'Continue with Apple'}
        </Button>
        <Button
          variant="secondary"
          disabled={Boolean(workingProvider)}
          onPress={() => void continueWithProvider('google', returnTo)}
        >
          {workingProvider === 'google'
            ? 'Opening Google…'
            : 'Continue with Google'}
        </Button>
      </Screen>
    );
  }

  if (loadingPreview && !preview) {
    return (
      <Screen contentStyle={styles.center}>
        <LoadingBlock label="Loading trip…" />
      </Screen>
    );
  }

  if (status === 'approved' || status === 'host') {
    return (
      <Screen contentStyle={styles.center}>
        <Symbol name="airplane" size={44} />
        <AppText variant="heading" align="center">
          Opening your trip…
        </AppText>
        {actionError ? (
          <ErrorMessage message={actionError} align="center" />
        ) : null}
      </Screen>
    );
  }

  return (
    <Screen contentStyle={styles.center}>
      <Symbol name="airplane" size={44} />
      <AppText variant="display" align="center">
        Join This Trip ✈️
      </AppText>
      {preview ? (
        <View style={styles.previewBlock}>
          <AppText variant="title" align="center">
            {preview.title}
          </AppText>
          <AppText variant="body" color="secondary" align="center">
            {preview.destination}
          </AppText>
          <AppText variant="callout" color="secondary" align="center">
            {formatDateLong(preview.startDate)} –{' '}
            {formatDateLong(preview.endDate)}
          </AppText>
        </View>
      ) : null}

      {status === 'pending' ? (
        <>
          <AppText variant="body" color="secondary" align="center">
            Request sent. Waiting for the trip host to approve you.
          </AppText>
          <Button
            variant="secondary"
            disabled={busy}
            onPress={() => {
              if (!code || !user || !validCode) return;
              void loadTravelOpenJoinStatus(code)
                .then((result) => {
                  if (!result) return;
                  setStatus(result.status);
                  setGrantedInviteCode(result.grantedInviteCode);
                  if (
                    result.status === 'approved' ||
                    result.status === 'host'
                  ) {
                    void openApprovedTrip();
                  }
                })
                .catch((error: unknown) => {
                  setActionError(
                    error instanceof Error
                      ? error.message
                      : 'Join status could not be loaded.',
                  );
                });
            }}
          >
            Check Again
          </Button>
        </>
      ) : status === 'rejected' ? (
        <>
          <ErrorMessage
            message="The trip host declined this join request."
            variant="body"
            align="center"
          />
          <Button onPress={() => router.replace('/' as never)}>
            Go to onTrack
          </Button>
        </>
      ) : (
        <>
          <AppText variant="body" color="secondary" align="center">
            Request to join. The host approves each new friend before the
            itinerary opens.
          </AppText>
          <Button disabled={busy} onPress={() => void sendJoinRequest()}>
            {busy ? 'Sending…' : 'Request to Join'}
          </Button>
        </>
      )}
      {actionError ? (
        <ErrorMessage message={actionError} align="center" />
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  shell: { flex: 1 },
  transparent: { backgroundColor: 'transparent' },
  center: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.lg,
  },
  webPage: {
    width: '100%',
    maxWidth: 620,
    alignSelf: 'center',
    justifyContent: 'center',
    minHeight: '100%',
    gap: spacing.xl,
    paddingVertical: spacing.xxxl,
  },
  brand: { gap: spacing.sm },
  inviteCard: { gap: spacing.sm },
  buttons: { gap: spacing.md },
  previewBlock: { gap: spacing.xs, alignItems: 'center' },
});
