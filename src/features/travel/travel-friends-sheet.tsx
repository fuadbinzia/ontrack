import { useCallback, useMemo, useState } from 'react';

import { Button } from '@/components/primitives';
import { resolveSelfDisplayName } from '@/features/account/self-display-name';
import { useAuthSession } from '@/features/auth/auth-provider';
import {
    createTravelOpenJoinUrl,
    listTravelOpenJoinRequests,
} from '@/features/travel/share';
import {
    TravelJoinRequestsPanel,
    TravelOpenJoinCard,
    TravelPendingInviteLinks,
} from '@/features/travel/travel-friends-join-panels';
import {
    filterTravelFriendsVisibleParticipants,
    resolveTravelFriendsHostPerson,
    resolveTravelFriendsRosterMembers,
} from '@/features/travel/travel-friends-roster-model';
import { itinerarySheetChrome } from '@/features/travel/travel-itinerary-sheet-chrome';
import { TravelRemoveConfirmModal } from '@/features/travel/travel-remove-confirm-modal';
import { TravelSheetModal } from '@/features/travel/travel-sheet';
import { TripPeople } from '@/features/travel/trip-people';
import {
    canonicalTravelTripId,
    isTravelMemberPlan,
    listTravelTripRoster,
    resolveIsTravelSoleHost,
} from '@/features/travel/trip-roster';
import type {
    TravelOpenJoinRequest,
    TravelPlan,
    TravelTripRosterPerson,
} from '@/features/travel/types';
import { useTravelFriendsSheetActions } from '@/features/travel/use-travel-friends-sheet-actions';
import { useTravelFriendsSheetSync } from '@/features/travel/use-travel-friends-sheet-sync';
import { useResponsive } from '@/hooks/use-responsive';
import { useTheme } from '@/hooks/use-theme';
import { ensureFriendProfile } from '@/services/friends';
import { publishTravelTripExpenses } from '@/services/travel/expense-collaboration';
import { usePreferences } from '@/store/preferences';
import { useTravel } from '@/store/travel';
import { AgentUiIds } from '@/utils/agent-ui';

export function TravelFriendsSheet({
  plan,
  visible,
  onClose,
  onSavePlan,
}: {
  plan: TravelPlan;
  visible: boolean;
  onClose: () => void;
  onSavePlan: (plan: TravelPlan) => void;
}) {
  const { user } = useAuthSession();
  const theme = useTheme();
  const chrome = itinerarySheetChrome(theme);
  const { s, spacing: rs } = useResponsive();
  const preferencesName = usePreferences((state) => state.name);
  const setPreferencesName = usePreferences((state) => state.setName);
  const [editingInvite, setEditingInvite] = useState(false);
  const [inviteName, setInviteName] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteError, setInviteError] = useState<string>();
  const [openJoinCode, setOpenJoinCode] = useState<string | undefined>(plan.openJoinCode);
  const [openJoinBusy, setOpenJoinBusy] = useState(false);
  const [openJoinError, setOpenJoinError] = useState<string>();
  const [joinRequests, setJoinRequests] = useState<TravelOpenJoinRequest[]>([]);
  const [decidingRequestId, setDecidingRequestId] = useState<string>();
  const [roster, setRoster] = useState<TravelTripRosterPerson[]>([]);
  const tripId = canonicalTravelTripId(plan);
  const memberPlan = isTravelMemberPlan(plan);
  const myRosterRole = user?.id
    ? roster.find((person) => person.userId === user.id)?.role
    : undefined;
  // Sole host owns transfer / co-host grants. Cohosts share invite + friend manage.
  const isSoleHost = resolveIsTravelSoleHost({ myRosterRole, memberPlan });
  const canManage = isSoleHost || myRosterRole === 'cohost';

  const hostFromRoster = roster.find((person) => person.role === 'host');
  const rosterMembers = useMemo(
    () =>
      resolveTravelFriendsRosterMembers({
        roster,
        plan,
        selfUserId: user?.id,
      }),
    [roster, plan, user?.id],
  );
  const hostFallbackName = resolveSelfDisplayName({
    preferencesName,
    user,
    fallback: 'Host',
  });
  const hostPerson = resolveTravelFriendsHostPerson({
    hostFromRoster,
    isSoleHost,
    memberPlan,
    hostFallbackName,
    hostDisplayName: plan.hostDisplayName,
    selfUserId: user?.id,
    selfEmail: user?.email,
  });
  const visibleParticipants = useMemo(
    () =>
      filterTravelFriendsVisibleParticipants({
        participants: plan.participants,
        hostPerson,
        hostFromRoster,
        roster,
        memberPlan,
      }),
    [hostFromRoster, hostPerson, memberPlan, plan.participants, roster],
  );

  const renameSelf = (nextName: string) => {
    setPreferencesName(nextName);
    void ensureFriendProfile({ displayName: nextName }).catch(() => undefined);
    if (user?.id) {
      setRoster((people) =>
        people.map((person) =>
          person.userId === user.id
            ? { ...person, displayName: nextName }
            : person,
        ),
      );
    }
  };

  const refreshJoinRequests = useCallback(async (canonicalTripId: string) => {
    try {
      const requests = await listTravelOpenJoinRequests(canonicalTripId);
      setJoinRequests(requests);
    } catch {
      // Host may be offline / unsigned; leave the last known list.
    }
  }, []);

  const refreshRoster = useCallback(async (canonicalTripId: string) => {
    try {
      const people = await listTravelTripRoster(canonicalTripId);
      setRoster(people);
      return people;
    } catch {
      return undefined;
    }
  }, []);

  const {
    sharingInvite,
    managingParticipantId,
    transferringUserId,
    copiedCode,
    copiedOpenJoin,
    removeConfirm,
    setCopiedOpenJoin,
    setRemoveConfirm,
    setManagingParticipantId,
    setTransferringUserId,
    setCopiedCode,
    inviteFriend,
    resendInvite,
    confirmRemoveParticipant,
    confirmRemoveRosterMember,
    transferHost,
    transferHostByParticipant,
    makeCohost,
    removeCohost,
    copyInviteLink,
    copyOpenJoinLink,
    shareOpenJoin,
    decideRequest,
    leaveTrip,
    leavingTrip,
  } = useTravelFriendsSheetActions({
    plan,
    tripId,
    isSoleHost,
    inviteName,
    inviteEmail,
    openJoinCode,
    onClose,
    onSavePlan,
    setEditingInvite,
    setInviteName,
    setInviteEmail,
    setInviteError,
    setOpenJoinBusy,
    setRoster,
    setDecidingRequestId,
    refreshJoinRequests,
    refreshRoster,
  });

  useTravelFriendsSheetSync({
    visible,
    plan,
    onSavePlan,
    selfUserId: user?.id,
    canManage,
    openJoinCode,
    setOpenJoinCode,
    setOpenJoinBusy,
    setOpenJoinError,
    setCopiedOpenJoin,
    setEditingInvite,
    setInviteName,
    setInviteEmail,
    setInviteError,
    setManagingParticipantId,
    setTransferringUserId,
    setCopiedCode,
    setDecidingRequestId,
    refreshJoinRequests,
    refreshRoster,
  });

  const pending = plan.participants.filter((person) => !person.acceptedAt);
  const openJoinUrl = openJoinCode
    ? createTravelOpenJoinUrl(
        openJoinCode,
        process.env.EXPO_PUBLIC_TRAVEL_SHARE_BASE_URL,
      )
    : undefined;

  return (
    <>
    <TravelSheetModal
      visible={visible}
      eyebrow="Co-Travelers"
        title={plan.title}
        subtitle={
          canManage
            ? 'Plan together. Share the adventure.'
            : 'Plan together. Trip friends.'
        }
        lockHeight
        closeAccessibilityLabel="Close Co-Travelers"
        closeTestID={AgentUiIds.travel.friends.close}
        onClose={onClose}>
            <TripPeople
              host={hostPerson}
              participants={visibleParticipants}
              rosterMembers={rosterMembers}
              selfUserId={user?.id}
              canManage={canManage}
              editing={editingInvite}
              name={inviteName}
              email={inviteEmail}
              error={inviteError}
              inviting={sharingInvite}
              showHeader={false}
              showInviteButton={false}
              onNameChange={setInviteName}
              onEmailChange={setInviteEmail}
              onBeginInvite={() => {
                setInviteError(undefined);
                setEditingInvite(true);
              }}
              onCancelInvite={() => {
                setInviteError(undefined);
                setEditingInvite(false);
              }}
              onInvite={() => void inviteFriend()}
              managingParticipantId={managingParticipantId}
              transferringUserId={transferringUserId}
              onResend={(participant) => void resendInvite(participant)}
              onRemove={confirmRemoveParticipant}
              onRemoveRosterMember={confirmRemoveRosterMember}
              canPromoteHost={isSoleHost}
              onMakeHost={(member) => transferHost(member, false)}
              onMakeHostParticipant={(participant) =>
                transferHostByParticipant(participant, false)
              }
              onMakeCohost={makeCohost}
              onRemoveCohost={removeCohost}
              onRenameHost={
                isSoleHost
                  ? (nextName) => {
                      renameSelf(nextName);
                      const current =
                        useTravel.getState().plans.find((item) => item.id === plan.id) ??
                        plan;
                      onSavePlan({
                        ...current,
                        hostDisplayName: nextName,
                        updatedAt: new Date().toISOString(),
                      });
                      if (!isTravelMemberPlan(current)) {
                        void publishTravelTripExpenses({
                          ...current,
                          hostDisplayName: nextName,
                        }).catch(() => undefined);
                      }
                    }
                  : undefined
              }
              onRenameSelf={renameSelf}
              onRenameParticipant={
                canManage
                  ? (participant, nextName) => {
                      const current =
                        useTravel
                          .getState()
                          .plans.find((item) => item.id === plan.id) ?? plan;
                      onSavePlan({
                        ...current,
                        participants: current.participants.map((person) =>
                          person.id === participant.id
                            ? { ...person, name: nextName }
                            : person,
                        ),
                        updatedAt: new Date().toISOString(),
                      });
                    }
                  : undefined
              }
              onRenameRosterMember={
                canManage
                  ? (member, nextName) => {
                      if (user?.id && member.userId === user.id) {
                        renameSelf(nextName);
                        return;
                      }
                      const current =
                        useTravel
                          .getState()
                          .plans.find((item) => item.id === plan.id) ?? plan;
                      const matched = current.participants.find(
                        (person) =>
                          person.inviteCode === member.inviteCode ||
                          (person.email &&
                            member.email &&
                            person.email.toLowerCase() ===
                              member.email.toLowerCase()),
                      );
                      if (matched) {
                        onSavePlan({
                          ...current,
                          participants: current.participants.map((person) =>
                            person.id === matched.id
                              ? { ...person, name: nextName }
                              : person,
                          ),
                          updatedAt: new Date().toISOString(),
                        });
                      }
                      setRoster((people) =>
                        people.map((person) =>
                          person.userId === member.userId
                            ? { ...person, displayName: nextName }
                            : person,
                        ),
                      );
                    }
                  : undefined
              }
            />

            {!isSoleHost ? (
              <Button
                testID={AgentUiIds.travel.friends.leaveTrip}
                variant="secondary"
                disabled={leavingTrip}
                onPress={leaveTrip}>
                {leavingTrip ? 'Leaving…' : 'Leave Trip'}
              </Button>
            ) : null}

            {canManage ? (
              <TravelOpenJoinCard
                tripTitle={plan.title}
                openJoinUrl={openJoinUrl}
                openJoinCode={openJoinCode}
                openJoinBusy={openJoinBusy}
                openJoinError={openJoinError}
                copiedOpenJoin={copiedOpenJoin}
                chrome={chrome}
                s={s}
                rs={rs}
                onCopy={() => void copyOpenJoinLink()}
                onShare={() => void shareOpenJoin()}
              />
            ) : null}

            {canManage ? (
              <TravelJoinRequestsPanel
                joinRequests={joinRequests}
                decidingRequestId={decidingRequestId}
                onDecide={(request, approve) => void decideRequest(request, approve)}
              />
            ) : null}

            {canManage ? (
              <TravelPendingInviteLinks
                pending={pending}
                copiedCode={copiedCode}
                managingParticipantId={managingParticipantId}
                onCopy={(participant) => void copyInviteLink(participant)}
                onShare={(participant) => void resendInvite(participant)}
              />
            ) : null}
    </TravelSheetModal>
    <TravelRemoveConfirmModal
      payload={removeConfirm}
      onCancel={() => setRemoveConfirm(null)}
    />
    </>
  );
}
