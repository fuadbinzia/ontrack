import * as Linking from 'expo-linking';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText, Button, ErrorMessage, Screen, Symbol } from '@/components/primitives';
import { spacing } from '@/design-system';
import { useAuthSession } from '@/features/auth/auth-provider';
import { travelCalendarDrafts } from '@/features/travel/calendar';
import {
  acceptTravelInvite,
  createInstalledTravelInviteUrl,
  decodeTravelInvite,
  findMatchingTravelPlan,
  isShortTravelInvite,
  ONTRACK_APP_STORE_URL,
  resolveTravelInvite,
  travelInviteLocalId,
  travelPlanIdentityKey,
} from '@/features/travel/share';
import { travelOverlineStyle } from '@/features/travel/travel-chrome';
import { TravelSkyBackdrop, TravelSurfaceCard } from '@/features/travel/travel-surface';
import { markInviteSnapshotItinerary } from '@/features/travel/itinerary-visibility';
import { pullTravelTripItinerary } from '@/services/travel/itinerary-collaboration';
import { useAddons } from '@/store/addons';
import { usePreferences } from '@/store/preferences';
import { useSchedule } from '@/store/schedule';
import { useTravel } from '@/store/travel';

export function TravelInviteLanding({ invite }: { invite?: string }) {
  const router = useRouter();
  const { user, continueWithProvider, workingProvider } = useAuthSession();
  const hasOnboarded = usePreferences((state) => state.hasOnboarded);
  const savePlan = useTravel((state) => state.savePlan);
  const replaceTravelActivities = useSchedule((state) => state.replaceTravelActivities);
  const setAddonEnabled = useAddons((state) => state.setEnabled);
  const handledInvite = useRef<string | undefined>(undefined);
  const isShortInvite = Boolean(invite && isShortTravelInvite(invite));
  const localDecoded =
    invite && !isShortInvite ? decodeTravelInvite(invite) : undefined;
  const [remoteResult, setRemoteResult] = useState<{
    invite: string;
    plan?: Awaited<ReturnType<typeof resolveTravelInvite>>;
    error?: string;
  }>();
  const currentRemoteResult = remoteResult?.invite === invite ? remoteResult : undefined;
  const remoteDecoded = currentRemoteResult?.plan;
  const inviteError = currentRemoteResult?.error;
  const decoded = remoteDecoded ?? localDecoded;
  const isWeb = process.env.EXPO_OS === 'web';
  const resolving = !isWeb && Boolean(user) && isShortInvite && !decoded && !inviteError;
  const nativeError =
    !invite
      ? 'This invitation looks incomplete. Ask the host for a fresh link.'
      : inviteError ??
        (!resolving && !decoded
          ? 'This invitation expired. Ask the host for a fresh link.'
          : undefined);

  useEffect(() => {
    // The hosted page does not share the installed app's authenticated
    // session. Keep the invite private there and hand the capability to the
    // installed app, where it can be resolved for the signed-in recipient.
    if (isWeb || !user || !invite || !isShortInvite) return;

    let active = true;
    void resolveTravelInvite(invite)
      .then((plan) => {
        if (!active) return;
        setRemoteResult(
          plan
            ? { invite, plan }
            : {
                invite,
                error:
                  'This invitation is unavailable for the signed-in account, or it has expired.',
              },
        );
      })
      .catch((error: unknown) => {
        if (!active) return;
        setRemoteResult({
          invite,
          error:
            error instanceof Error
              ? error.message
              : 'This invitation could not be opened.',
        });
      });
    return () => {
      active = false;
    };
  }, [invite, isShortInvite, isWeb, user]);

  useEffect(() => {
    if (isWeb) return;
    if (!invite || !decoded) return;
    if (handledInvite.current === invite) return;
    let active = true;
    void (async () => {
      // Encoded (v1–v3) invites are capability URLs — no server accept step.
      if (isShortInvite) {
        const accepted = await acceptTravelInvite(invite);
        if (!active) return;
        if (!accepted) {
          setRemoteResult({
            invite,
            error: 'This invitation is no longer available.',
          });
          return;
        }
      }

      const plans = useTravel.getState().plans;
      // Read the latest store only after acceptance. This avoids canceling the
      // one-shot import when an unrelated plan changes while the RPC is pending.
      const existingPlan = isShortInvite
        ? (() => {
            const code = invite.slice(2);
            return (
              plans.find((plan) => plan.chatAccessCode === code) ??
              plans.find((plan) => plan.id === travelInviteLocalId(code))
            );
          })()
        : findMatchingTravelPlan(plans, decoded);

      if (existingPlan) {
        if (isShortInvite) {
          const code = invite.slice(2);
          const hostTripId = decoded.hostTripId?.trim();
          // Never convert a local host plan (has open-join) into a member copy of
          // another trip — that strips host privileges on the wrong roster.
          const looksLikeHostPlan =
            Boolean(existingPlan.openJoinCode) && !existingPlan.chatAccessCode;
          const pointsAtOtherTrip =
            Boolean(hostTripId) && hostTripId !== existingPlan.id;
          if (looksLikeHostPlan && pointsAtOtherTrip) {
            const now = new Date().toISOString();
            const memberCopy = {
              ...decoded,
              id: travelInviteLocalId(code),
              chatAccessCode: code,
              itinerary: markInviteSnapshotItinerary(
                decoded.itinerary,
                'host',
              ),
              createdAt: now,
              updatedAt: now,
            };
            savePlan(memberCopy);
            void pullTravelTripItinerary(memberCopy).catch(() => undefined);
            replaceTravelActivities(
              memberCopy.id,
              travelCalendarDrafts(memberCopy),
            );
            setAddonEnabled('travel', true);
            handledInvite.current = invite;
            router.replace(
              hasOnboarded
                ? (`/travel/${memberCopy.id}` as never)
                : ({
                    pathname: '/welcome',
                    params: { returnTo: '/travel' },
                  } as never),
            );
            return;
          }
          const synced = {
            ...existingPlan,
            chatAccessCode: code,
            ...(hostTripId ? { hostTripId } : {}),
            updatedAt: new Date().toISOString(),
          };
          savePlan(synced);
          void pullTravelTripItinerary(synced).catch(() => undefined);
        }
        setAddonEnabled('travel', true);
        handledInvite.current = invite;
        router.replace(
          hasOnboarded
            ? (`/travel/${existingPlan.id}` as never)
            : ({ pathname: '/welcome', params: { returnTo: '/travel' } } as never),
        );
        return;
      }

      const now = new Date().toISOString();
      const plan = {
        ...decoded,
        id:
          isShortInvite && invite
            ? travelInviteLocalId(invite.slice(2))
            : `trip-invite-${travelPlanIdentityKey(decoded)}`,
        chatAccessCode: isShortInvite ? invite.slice(2) : undefined,
        itinerary: markInviteSnapshotItinerary(decoded.itinerary, 'host'),
        createdAt: now,
        updatedAt: now,
      };
      savePlan(plan);
      void pullTravelTripItinerary(plan).catch(() => undefined);
      replaceTravelActivities(plan.id, travelCalendarDrafts(plan));
      setAddonEnabled('travel', true);
      handledInvite.current = invite;
      router.replace(
        hasOnboarded
          ? (`/travel/${plan.id}` as never)
          : ({ pathname: '/welcome', params: { returnTo: '/travel' } } as never),
      );
    })().catch((error: unknown) => {
      if (!active) return;
      setRemoteResult({
        invite,
        error:
          error instanceof Error
            ? error.message
            : 'This invitation could not be accepted.',
      });
    });
    return () => {
      active = false;
    };
  }, [
    decoded,
    hasOnboarded,
    invite,
    isWeb,
    isShortInvite,
    replaceTravelActivities,
    router,
    savePlan,
    setAddonEnabled,
  ]);

  if (!isWeb) {
    if (invite && isShortInvite && !user) {
      const returnTo = `/i/${invite.slice(2)}`;
      return (
        <View style={styles.shell}>
          <TravelSkyBackdrop />
          <Screen style={styles.transparent} contentStyle={styles.center}>
          <Symbol name="airplane" size={44} />
          <AppText variant="display" align="center">You’re Invited</AppText>
          <AppText variant="body" color="secondary" align="center">
            Sign in with the email address that was invited. Your trip invitation will still be
            here when you return.
          </AppText>
          <Button
            disabled={Boolean(workingProvider)}
            onPress={() => void continueWithProvider('apple', returnTo)}>
            {workingProvider === 'apple' ? 'Opening Apple…' : 'Continue with Apple'}
          </Button>
          <Button
            variant="secondary"
            disabled={Boolean(workingProvider)}
            onPress={() => void continueWithProvider('google', returnTo)}>
            {workingProvider === 'google' ? 'Opening Google…' : 'Continue with Google'}
          </Button>
          </Screen>
        </View>
      );
    }

    return (
      <View style={styles.shell}>
        <TravelSkyBackdrop />
        <Screen style={styles.transparent} contentStyle={styles.center}>
          <Symbol name="airplane" size={44} />
          {nativeError ? (
            <ErrorMessage message={nativeError} variant="heading" align="center" />
          ) : (
            <AppText variant="heading" align="center">
              Opening Your Trip…
            </AppText>
          )}
          {nativeError ? (
            <Button onPress={() => router.replace('/' as never)}>Go to onTrack</Button>
          ) : null}
        </Screen>
      </View>
    );
  }

  const customSchemeUrl = createInstalledTravelInviteUrl(invite);

  return (
    <View style={styles.shell}>
      <TravelSkyBackdrop />
      <Screen style={styles.transparent} contentStyle={styles.webPage} bottomInset={false}>
      <View style={styles.brand}>
        <AppText variant="overline" color="accent" style={travelOverlineStyle}>
          onTrack Travel
        </AppText>
        <AppText variant="display">You’re Invited</AppText>
        <AppText variant="body" color="secondary">
          Open the trip in onTrack to add its dates and full itinerary to your calendar.
        </AppText>
      </View>

      <TravelSurfaceCard>
        {isShortInvite ? (
          <AppText variant="body" color="secondary">
            This is a private trip invitation. Open it in onTrack and sign in with the invited
            email address to view the details.
          </AppText>
        ) : (
          <ErrorMessage
            message="This invitation looks incomplete. Ask the host for a fresh link."
            variant="body"
          />
        )}
      </TravelSurfaceCard>

      {isShortInvite ? (
        <View style={styles.buttons}>
          <Button
            icon="open-external"
            onPress={() => void Linking.openURL(customSchemeUrl)}>
            Open in onTrack
          </Button>
          <Button
            variant="secondary"
            icon="download"
            onPress={() => void Linking.openURL(ONTRACK_APP_STORE_URL)}>
            Download from the App Store
          </Button>
        </View>
      ) : null}
      <AppText variant="caption" color="secondary" align="center">
        New here? Install onTrack, return to this invitation, then tap Open in onTrack. The invite
        stays in this link.
      </AppText>
      </Screen>
    </View>
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
});
