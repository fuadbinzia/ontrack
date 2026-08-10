import { StyleSheet, View } from 'react-native';

import { EmptyState, LoadingBlock } from '@/components/primitives';
import type { TravelChatMember } from '@/features/travel/chat';
import {
  TravelChatLandscape,
  TravelChatMemberStack,
} from '@/features/travel/travel-chat-chrome';
import { TravelSheetHeader } from '@/features/travel/travel-sheet';
import type { TravelPlan } from '@/features/travel/types';
import { useResponsive } from '@/hooks/use-responsive';
import { AgentUiIds } from '@/utils/agent-ui';

type TravelChatAccessGateProps =
  | {
      variant: 'missing-plan';
      onClose: () => void;
    }
  | {
      variant: 'missing-access';
      plan: TravelPlan;
      members: TravelChatMember[];
      memberSubtitle: string;
      rosterReady: boolean;
      userId?: string;
      roster: Array<{ userId?: string }>;
      palette: { mountainColor: string };
      onClose: () => void;
    };

export function TravelChatAccessGate(props: TravelChatAccessGateProps) {
  const { layout: responsiveLayout, spacing: rs } = useResponsive();

  if (props.variant === 'missing-plan') {
    return (
      <View
        style={[
          styles.fill,
          { paddingHorizontal: responsiveLayout.screenPadding },
        ]}>
        <TravelSheetHeader
          eyebrow="Group Chat"
          title="Travel"
          subtitle="Plan Together · Stay Connected"
          closeAccessibilityLabel="Close Group Chat"
          closeTestID={AgentUiIds.travel.chat.close}
          paddingTop={rs.sm}
          onClose={props.onClose}
        />
        <EmptyState icon="chat" title="Trip Not Found" message="This trip is no longer available." />
      </View>
    );
  }

  const waitingOnRoster = !props.rosterReady;
  const signedInElsewhere =
    props.rosterReady &&
    Boolean(props.userId) &&
    props.roster.length > 0 &&
    !props.roster.some((person) => person.userId === props.userId);

  return (
    <View style={styles.fill}>
      <TravelChatLandscape color={props.palette.mountainColor} />
      <View style={{ paddingHorizontal: responsiveLayout.screenPadding, zIndex: 1 }}>
        <TravelSheetHeader
          eyebrow="Group Chat"
          title={props.plan.title}
          subtitle={props.memberSubtitle}
          closeAccessibilityLabel="Close Group Chat"
          closeTestID={AgentUiIds.travel.chat.close}
          paddingTop={rs.sm}
          onClose={props.onClose}
        />
        <TravelChatMemberStack members={props.members} />
      </View>
      <View style={[styles.center, { zIndex: 1 }]}>
        {waitingOnRoster ? (
          <LoadingBlock label="Opening shared chat…" />
        ) : (
          <EmptyState
            icon="people"
            title={
              signedInElsewhere
                ? 'Sign In With the Account That Joined'
                : 'Couldn’t Open Shared Chat'
            }
            message={
              signedInElsewhere
                ? 'This trip is linked to a different onTrack account on this device. Sign in with the account that accepted the invite, or open the join link again.'
                : 'Force-quit onTrack and reopen to install the latest update, then open Group Chat again. If it still fails, open the host’s join link while signed in.'
            }
          />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
