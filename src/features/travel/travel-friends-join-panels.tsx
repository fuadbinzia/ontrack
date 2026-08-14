import { Pressable, StyleSheet, View } from 'react-native';

import { AppText, Button, GlassIconWell, Symbol } from '@/components/primitives';
import { radii, spacing } from '@/design-system';
import { createTravelInviteUrl } from '@/features/travel/share';
import { travelOverlineStyle } from '@/features/travel/travel-chrome';
import {
  travelInputFieldBackground,
  type ItinerarySheetChrome,
} from '@/features/travel/travel-itinerary-sheet-chrome';
import { displayJoinLink } from '@/features/travel/travel-join-link-display';
import { TravelSurfaceCard } from '@/features/travel/travel-surface';
import { useTheme } from '@/hooks/use-theme';
import type {
  TravelOpenJoinRequest,
  TravelParticipant,
} from '@/features/travel/types';
import { AgentTestId, AgentUiIds } from '@/utils/agent-ui';
import { haptics } from '@/utils/haptics';

export function TravelOpenJoinCard({
  tripTitle,
  openJoinUrl,
  openJoinCode,
  openJoinBusy,
  openJoinError,
  copiedOpenJoin,
  chrome,
  s,
  rs,
  onCopy,
  onShare,
}: {
  tripTitle: string;
  openJoinUrl?: string;
  openJoinCode?: string;
  openJoinBusy: boolean;
  openJoinError?: string;
  copiedOpenJoin: boolean;
  chrome: ItinerarySheetChrome;
  s: (n: number) => number;
  rs: { sm: number; md: number };
  onCopy: () => void;
  onShare: () => void;
}) {
  const theme = useTheme();
  return (
    <TravelSurfaceCard bodyStyle={styles.openJoinCard}>
      <View style={[styles.joinHeader, { gap: rs.sm }]}>
        <GlassIconWell
          size={Math.max(36, s(36))}
          borderRadius={radii.pill}
          style={styles.joinIcon}>
          <Symbol name="link" size="sm" color={chrome.icons.link.fg} />
        </GlassIconWell>
        <View style={styles.joinHeaderCopy}>
          <AppText variant="subheading" fit numberOfLines={1}>
            Join Link
          </AppText>
          <AppText variant="caption" color="secondary" fit numberOfLines={1}>
            Anyone can request to join.
          </AppText>
        </View>
      </View>

      {openJoinUrl ? (
        <View
          style={[
            styles.urlField,
            {
              backgroundColor: travelInputFieldBackground(theme),
              borderColor: chrome.fieldBorder,
              minHeight: Math.max(44, s(44)),
              paddingLeft: rs.md,
              gap: rs.sm,
            },
          ]}>
          <AppText
            variant="caption"
            color="secondary"
            fit
            numberOfLines={1}
            style={styles.urlText}
            selectable>
            {displayJoinLink(tripTitle, openJoinUrl)}
          </AppText>
        </View>
      ) : openJoinError ? (
        <AppText variant="caption" color="danger">
          {openJoinError}
        </AppText>
      ) : (
        <AppText variant="caption" color="secondary">
          {openJoinBusy ? 'Creating link…' : 'Sign in to create an open join link.'}
        </AppText>
      )}

      <View style={styles.linkActions}>
        <AgentTestId
          testID={AgentUiIds.travel.friends.copyJoinLink}
          label="Copy open join link"
          onPress={
            !openJoinCode || openJoinBusy
              ? undefined
              : () => {
                  haptics.tap();
                  onCopy();
                }
          }
          style={[
            styles.joinAction,
            {
              backgroundColor: travelInputFieldBackground(theme),
              borderColor: chrome.fieldBorder,
              minHeight: Math.max(44, s(48)),
              opacity: !openJoinCode || openJoinBusy ? 0.45 : 1,
            },
          ]}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Copy open join link"
            disabled={!openJoinCode || openJoinBusy}
            onPress={() => {
              haptics.tap();
              onCopy();
            }}
            style={({ pressed }) => [
              styles.joinActionInner,
              { opacity: pressed ? 0.72 : 1 },
            ]}>
            <Symbol name="link" size="sm" color={chrome.label} />
            <AppText variant="callout" fit numberOfLines={1}>
              {copiedOpenJoin ? 'Copied' : 'Copy Link'}
            </AppText>
          </Pressable>
        </AgentTestId>
        <AgentTestId
          testID={AgentUiIds.travel.friends.shareJoinLink}
          label="Share open join link"
          onPress={
            !openJoinCode || openJoinBusy
              ? undefined
              : () => {
                  haptics.tap();
                  onShare();
                }
          }
          style={[
            styles.joinAction,
            {
              backgroundColor: travelInputFieldBackground(theme),
              borderColor: chrome.fieldBorder,
              minHeight: Math.max(44, s(48)),
              opacity: !openJoinCode || openJoinBusy ? 0.45 : 1,
            },
          ]}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Share open join link"
            disabled={!openJoinCode || openJoinBusy}
            onPress={() => {
              haptics.tap();
              onShare();
            }}
            style={({ pressed }) => [
              styles.joinActionInner,
              { opacity: pressed ? 0.72 : 1 },
            ]}>
            <Symbol name="share" size="sm" color={chrome.label} />
            <AppText variant="callout" fit numberOfLines={1}>
              Share
            </AppText>
          </Pressable>
        </AgentTestId>
      </View>
    </TravelSurfaceCard>
  );
}

export function TravelJoinRequestsPanel({
  joinRequests,
  decidingRequestId,
  onDecide,
}: {
  joinRequests: TravelOpenJoinRequest[];
  decidingRequestId?: string;
  onDecide: (request: TravelOpenJoinRequest, approve: boolean) => void;
}) {
  if (joinRequests.length === 0) return null;
  return (
    <View style={styles.linksSection}>
      <AppText variant="overline" color="tertiary" style={travelOverlineStyle} fit>
        Waiting for Approval
      </AppText>
      {joinRequests.map((request) => {
        const deciding = decidingRequestId === request.id;
        return (
          <TravelSurfaceCard key={request.id} bodyStyle={styles.linkCard}>
            <AppText variant="subheading" fit>
              {request.requesterName}
            </AppText>
            <AppText variant="caption" color="secondary">
              Requested to join this trip
            </AppText>
            <View style={styles.linkActions}>
              <Button
                style={styles.linkAction}
                disabled={deciding}
                accessibilityLabel={`Approve ${request.requesterName}`}
                onPress={() => onDecide(request, true)}>
                {deciding ? 'Working…' : 'Approve'}
              </Button>
              <Button
                variant="secondary"
                style={styles.linkAction}
                disabled={deciding}
                accessibilityLabel={`Decline ${request.requesterName}`}
                onPress={() => onDecide(request, false)}>
                Decline
              </Button>
            </View>
          </TravelSurfaceCard>
        );
      })}
    </View>
  );
}

export function TravelPendingInviteLinks({
  pending,
  copiedCode,
  managingParticipantId,
  onCopy,
  onShare,
}: {
  pending: TravelParticipant[];
  copiedCode?: string;
  managingParticipantId?: string;
  onCopy: (participant: TravelParticipant) => void;
  onShare: (participant: TravelParticipant) => void;
}) {
  if (pending.length === 0) return null;
  return (
    <View style={styles.linksSection}>
      <AppText variant="overline" color="tertiary" style={travelOverlineStyle} fit>
        Private Invite Links
      </AppText>
      {pending.map((participant) => {
        const url = createTravelInviteUrl(
          participant.inviteCode,
          process.env.EXPO_PUBLIC_TRAVEL_SHARE_BASE_URL,
        );
        const copied = copiedCode === participant.inviteCode;
        return (
          <TravelSurfaceCard key={participant.id} bodyStyle={styles.linkCard}>
            <AppText variant="subheading" fit>
              {participant.name}
            </AppText>
            <AppText variant="caption" color="secondary" selectable>
              {url}
            </AppText>
            <View style={styles.linkActions}>
              <Button
                variant="secondary"
                style={styles.linkAction}
                accessibilityLabel={`Copy invite link for ${participant.name}`}
                onPress={() => onCopy(participant)}>
                {copied ? 'Copied' : 'Copy Link'}
              </Button>
              <Button
                variant="secondary"
                style={styles.linkAction}
                disabled={managingParticipantId === participant.id}
                accessibilityLabel={`Share invite link for ${participant.name}`}
                onPress={() => onShare(participant)}>
                Share
              </Button>
            </View>
          </TravelSurfaceCard>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  openJoinCard: { gap: spacing.md },
  joinHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  joinIcon: {
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  joinHeaderCopy: {
    flex: 1,
    minWidth: 0,
    flexShrink: 1,
    gap: 2,
  },
  urlField: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radii.lg,
    overflow: 'hidden',
  },
  urlText: {
    flex: 1,
    minWidth: 0,
    flexShrink: 1,
  },
  linksSection: { gap: spacing.sm },
  linkCard: { gap: spacing.sm },
  linkActions: { flexDirection: 'row', gap: spacing.sm },
  linkAction: { flex: 1, minWidth: 0 },
  joinAction: {
    flex: 1,
    minWidth: 0,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radii.lg,
    overflow: 'hidden',
  },
  joinActionInner: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    minHeight: 44,
  },
});
