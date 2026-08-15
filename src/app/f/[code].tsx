import { useLocalSearchParams, useRouter } from 'expo-router';
import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import {
  AppText,
  Button,
  ErrorMessage,
  GlassIconWell,
  GlassPlate,
  LoadingBlock,
  Screen,
  Symbol,
} from '@/components/primitives';
import { radii } from '@/design-system';
import { AuthBrandMark } from '@/features/auth/auth-brand-mark';
import { useAuthSession } from '@/features/auth/auth-provider';
import { useResponsive } from '@/hooks/use-responsive';
import { useTheme } from '@/hooks/use-theme';
import {
  acceptFriendInviteLink,
  resolveFriendInviteLink,
  type FriendInvitePreview,
} from '@/services/friends';
import { useFriends } from '@/store/friends';
import { AgentTestId, AgentUiIds } from '@/utils/agent-ui';

export default function FriendInviteRoute() {
  const router = useRouter();
  const { code } = useLocalSearchParams<{ code: string }>();
  const { user, isGuest } = useAuthSession();
  const refresh = useFriends((state) => state.refresh);
  const [preview, setPreview] = useState<FriendInvitePreview>();
  const [error, setError] = useState<string>();
  const [working, setWorking] = useState(false);
  const inviteCode = typeof code === 'string' ? decodeURIComponent(code).trim().toLowerCase() : '';

  useEffect(() => {
    if (!inviteCode || !user || isGuest) return;
    let active = true;
    void resolveFriendInviteLink(inviteCode)
      .then((value) => {
        if (active) setPreview(value);
      })
      .catch((caught: unknown) => {
        if (active) {
          setError(
            caught instanceof Error
              ? caught.message
              : 'This friend invite is unavailable.',
          );
        }
      });
    return () => {
      active = false;
    };
  }, [inviteCode, isGuest, user]);

  if (!user || isGuest) {
    return (
      <InviteShell
        title="A Friend Invited You"
        description="Connect in onTrack Social—your place to share plans, trips, and everyday moments.">
        <Button
          testID={AgentUiIds.social.friendInvite.signIn}
          icon="invite"
          size="lg"
          style={styles.fullWidth}
          onPress={() =>
            router.push({
              pathname: isGuest ? '/account' : '/welcome',
              params: { returnTo: `/f/${inviteCode}` },
            } as never)
          }>
          Continue to onTrack
        </Button>
        <AppText variant="caption" color="tertiary" align="center">
          Sign in securely. We’ll return you here to accept.
        </AppText>
      </InviteShell>
    );
  }

  if (error) {
    return (
      <InviteShell
        icon="link"
        title="Invite Unavailable"
        description="This onTrack link may have expired or already been used."
        showJourney={false}>
        <ErrorMessage message={error} align="center" />
        <Button
          testID={AgentUiIds.social.friendInvite.openSocial}
          icon="people"
          style={styles.fullWidth}
          onPress={() => router.replace('/(tabs)/social' as never)}>
          Open Social
        </Button>
      </InviteShell>
    );
  }

  if (!preview) {
    return (
      <InviteShell
        title="Opening Your Invite"
        description="Just a moment while we find your invitation.">
        <LoadingBlock compact />
      </InviteShell>
    );
  }

  return (
    <InviteShell
      sourceLabel={preview.displayName}
      title={`Say Hi to ${preview.displayName}`}
      description={`${preview.displayName} invited you to connect on onTrack.`}>
      <Button
        testID={AgentUiIds.social.friendInvite.accept}
        icon="invite"
        loading={working}
        size="lg"
        style={styles.fullWidth}
        onPress={() => {
          setWorking(true);
          void acceptFriendInviteLink(inviteCode)
            .then(async () => {
              await refresh();
              router.replace('/(tabs)/social' as never);
            })
            .catch((caught: unknown) => {
              setError(
                caught instanceof Error
                  ? caught.message
                  : 'This friend invite could not be accepted.',
              );
            })
            .finally(() => setWorking(false));
        }}>
        {`Add ${preview.displayName}`}
      </Button>
      <Button
        testID={AgentUiIds.social.friendInvite.notNow}
        variant="ghost"
        style={styles.fullWidth}
        onPress={() => router.replace('/(tabs)/social' as never)}>
        Not Now
      </Button>
    </InviteShell>
  );
}

function InviteShell({
  title,
  description,
  icon = 'invite',
  sourceLabel = 'A Friend',
  showJourney = true,
  children,
}: {
  title: string;
  description: string;
  icon?: 'invite' | 'link';
  sourceLabel?: string;
  showJourney?: boolean;
  children: ReactNode;
}) {
  const theme = useTheme();
  const { layout, s, spacing } = useResponsive();

  return (
    <Screen
      bottomInset="safe"
      refresh={false}
      contentStyle={{
        ...styles.screenContent,
        paddingVertical: spacing.xxl,
      }}>
      <View
        style={[
          styles.composition,
          {
            maxWidth: Math.min(layout.maxContentWidth, s(520)),
            gap: spacing.lg,
          },
        ]}>
        <View style={[styles.brandRow, { gap: spacing.md }]}>
          <AuthBrandMark size={Math.max(42, s(46))} />
          <View style={[styles.brandCopy, { gap: spacing.xxs }]}>
            <AppText
              variant="overline"
              color="accent"
              style={{ letterSpacing: s(3.4) }}
              fit>
              onTrack
            </AppText>
            <AppText variant="caption" color="secondary">
              Life, organized. Better together.
            </AppText>
          </View>
        </View>

        <AgentTestId testID={AgentUiIds.social.friendInvite.section.card}>
          <GlassPlate
            accent="green"
            style={[
              styles.inviteCard,
              {
                gap: spacing.lg,
                paddingHorizontal: spacing.xl,
                paddingVertical: spacing.xxl,
                borderRadius: Math.max(radii.xl, s(radii.xl)),
              },
            ]}>
            <GlassIconWell
              size={Math.max(72, s(80))}
              borderRadius={Math.max(radii.xl, s(radii.xl))}>
              <Symbol name={icon} size="xl" color={theme.success} />
            </GlassIconWell>

            <View style={[styles.copy, { gap: spacing.sm }]}>
              <AppText variant="overline" color="accent" align="center" fit>
                Friend Invite
              </AppText>
              <AppText variant="display" align="center" fit numberOfLines={2}>
                {title}
              </AppText>
              <AppText variant="body" color="secondary" align="center">
                {description}
              </AppText>
            </View>

            {showJourney ? (
              <GlassPlate
                mist
                style={[
                  styles.journey,
                  {
                    gap: spacing.sm,
                    paddingHorizontal: spacing.md,
                    paddingVertical: spacing.md,
                    borderRadius: Math.max(radii.md, s(radii.md)),
                  },
                ]}>
                <View style={[styles.journeyStop, { gap: spacing.xs }]}>
                  <Symbol name="invite" size="sm" color={theme.success} />
                  <View style={styles.journeyCopy}>
                    <AppText variant="caption" color="tertiary" fit>
                      From
                    </AppText>
                    <AppText variant="callout" fit>
                      {sourceLabel}
                    </AppText>
                  </View>
                </View>
                <Symbol name="chevron-right" size="sm" color={theme.textTertiary} />
                <View style={[styles.journeyStop, styles.journeyDestination, { gap: spacing.xs }]}>
                  <View style={[styles.journeyCopy, styles.journeyDestinationCopy]}>
                    <AppText variant="caption" color="tertiary" align="right" fit>
                      To
                    </AppText>
                    <AppText variant="callout" align="right" fit>
                      Your Social Circle
                    </AppText>
                  </View>
                  <Symbol name="people" size="sm" color={theme.success} />
                </View>
              </GlassPlate>
            ) : null}

            <View style={[styles.actions, { gap: spacing.sm }]}>{children}</View>
          </GlassPlate>
        </AgentTestId>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screenContent: {
    justifyContent: 'center',
  },
  composition: {
    width: '100%',
    alignSelf: 'center',
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
  },
  brandCopy: {
    flexShrink: 1,
    minWidth: 0,
  },
  inviteCard: {
    width: '100%',
    alignItems: 'center',
    borderCurve: 'continuous',
  },
  copy: {
    width: '100%',
    alignItems: 'center',
  },
  journey: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderCurve: 'continuous',
  },
  journeyStop: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    minWidth: 0,
  },
  journeyDestination: {
    justifyContent: 'flex-end',
  },
  journeyCopy: {
    flexShrink: 1,
    minWidth: 0,
  },
  journeyDestinationCopy: {
    alignItems: 'flex-end',
  },
  actions: {
    width: '100%',
    alignItems: 'center',
  },
  fullWidth: {
    alignSelf: 'stretch',
  },
});
