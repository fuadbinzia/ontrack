import * as Clipboard from 'expo-clipboard';
import { useState, type Dispatch, type SetStateAction } from 'react';

import { appPrompt } from '@/components/primitives';
import {
  createTravelInviteUrl,
  createTravelOpenJoinUrl,
  decideTravelOpenJoin,
  resendTravelInvite,
  revokeTravelInvite,
  shareTravelOpenJoinLink,
  shareTravelPlan,
} from '@/features/travel/share';
import type { TravelRemoveConfirmPayload } from '@/features/travel/travel-remove-confirm-modal';
import {
  canonicalTravelTripId,
  grantTravelTripCohost,
  leaveTravelTrip,
  revokeTravelTripCohost,
  transferTravelTripHost,
  transferTravelTripHostByInvite,
} from '@/features/travel/trip-roster';
import type {
  TravelOpenJoinRequest,
  TravelParticipant,
  TravelPlan,
  TravelTripRosterPerson,
} from '@/features/travel/types';
import { publishTravelTripExpenses } from '@/services/travel/expense-collaboration';
import { useTravel } from '@/store/travel';
import { confirmDestructiveAction } from '@/utils/confirm-destructive';
import { newId } from '@/utils/id';

type UseTravelFriendsSheetActionsOptions = {
  plan: TravelPlan;
  tripId: string;
  isSoleHost: boolean;
  inviteName: string;
  inviteEmail: string;
  openJoinCode?: string;
  onClose: () => void;
  onSavePlan: (plan: TravelPlan) => void;
  setEditingInvite: Dispatch<SetStateAction<boolean>>;
  setInviteName: Dispatch<SetStateAction<string>>;
  setInviteEmail: Dispatch<SetStateAction<string>>;
  setInviteError: Dispatch<SetStateAction<string | undefined>>;
  setOpenJoinBusy: Dispatch<SetStateAction<boolean>>;
  setRoster: Dispatch<SetStateAction<TravelTripRosterPerson[]>>;
  setDecidingRequestId: Dispatch<SetStateAction<string | undefined>>;
  refreshJoinRequests: (canonicalTripId: string) => Promise<void>;
  refreshRoster: (
    canonicalTripId: string,
  ) => Promise<TravelTripRosterPerson[] | undefined>;
};

export function useTravelFriendsSheetActions({
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
}: UseTravelFriendsSheetActionsOptions) {
  const removePlan = useTravel((state) => state.removePlan);
  const [sharingInvite, setSharingInvite] = useState(false);
  const [managingParticipantId, setManagingParticipantId] = useState<string>();
  const [transferringUserId, setTransferringUserId] = useState<string>();
  const [leavingTrip, setLeavingTrip] = useState(false);
  const [copiedCode, setCopiedCode] = useState<string>();
  const [copiedOpenJoin, setCopiedOpenJoin] = useState(false);
  const [removeConfirm, setRemoveConfirm] =
    useState<TravelRemoveConfirmPayload | null>(null);

  const inviteFriend = async () => {
    setInviteError(undefined);
    const name = inviteName.trim();
    const email = inviteEmail.trim().toLowerCase();
    if (!name) return setInviteError('Add your friend’s name.');
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return setInviteError(
        'Enter the email address your friend uses to sign in to onTrack.',
      );
    }
    setSharingInvite(true);
    try {
      const code = await shareTravelPlan(plan, { name, email });
      if (!code) return;
      const now = new Date().toISOString();
      const next: TravelPlan = {
        ...plan,
        participants: [
          ...plan.participants,
          {
            id: newId('trip-person'),
            name,
            email,
            inviteCode: code,
            invitedAt: now,
          },
        ],
        updatedAt: now,
      };
      onSavePlan(next);
      void publishTravelTripExpenses(next).catch(() => undefined);
      setInviteName('');
      setInviteEmail('');
      setEditingInvite(false);
      void refreshRoster(tripId);
    } catch (shareError) {
      setInviteError(
        shareError instanceof Error
          ? shareError.message
          : 'The invitation could not be created. Please try again.',
      );
    } finally {
      setSharingInvite(false);
    }
  };

  const resendInvite = async (participant: TravelParticipant) => {
    setManagingParticipantId(participant.id);
    try {
      await resendTravelInvite(
        plan,
        { name: participant.name, email: participant.email ?? '' },
        participant.inviteCode,
      );
    } catch (reason) {
      appPrompt.alert(
        'Couldn’t Resend Invitation',
        reason instanceof Error
          ? reason.message
          : 'The invitation could not be shared. Please try again.',
      );
    } finally {
      setManagingParticipantId(undefined);
    }
  };

  const removeParticipant = async (participant: TravelParticipant) => {
    setManagingParticipantId(participant.id);
    try {
      await revokeTravelInvite(participant.inviteCode);
      onSavePlan({
        ...plan,
        participants: plan.participants.filter(
          (person) => person.id !== participant.id,
        ),
        updatedAt: new Date().toISOString(),
      });
      void refreshRoster(tripId);
    } catch (reason) {
      appPrompt.alert(
        participant.acceptedAt ? 'Couldn’t Remove Friend' : 'Couldn’t Remove Invitation',
        reason instanceof Error
          ? reason.message
          : 'This person could not be removed. Please try again.',
      );
    } finally {
      setManagingParticipantId(undefined);
    }
  };

  const confirmRemoveParticipant = (participant: TravelParticipant) => {
    const accepted = Boolean(participant.acceptedAt);
    setRemoveConfirm({
      title: accepted ? 'Remove Friend?' : 'Remove Invitation?',
      message: accepted
        ? `${participant.name} will be removed from this trip and their invite link will stop working.`
        : `${participant.name}’s invite link will stop working.`,
      actionLabel: accepted ? 'Remove Friend' : 'Remove Invite',
      onConfirm: () => void removeParticipant(participant),
    });
  };

  const confirmRemoveRosterMember = (member: TravelTripRosterPerson) => {
    const matched = plan.participants.find(
      (person) =>
        person.inviteCode === member.inviteCode ||
        (person.email &&
          member.email &&
          person.email.toLowerCase() === member.email.toLowerCase()),
    );
    if (matched) {
      confirmRemoveParticipant(matched);
      return;
    }
    if (!member.inviteCode) {
      appPrompt.alert(
        'Couldn’t Remove Friend',
        'This person can’t be removed from here. Ask them to leave the trip, or remove their invite from another device.',
      );
      return;
    }
    setRemoveConfirm({
      title: 'Remove Friend?',
      message: `${member.displayName} will be removed from this trip and their invite link will stop working.`,
      actionLabel: 'Remove Friend',
      onConfirm: () => {
        void (async () => {
          setTransferringUserId(member.userId);
          try {
            await revokeTravelInvite(member.inviteCode!);
            setRoster((people) =>
              people.filter((person) => person.userId !== member.userId),
            );
            void refreshRoster(tripId);
          } catch (reason) {
            appPrompt.alert(
              'Couldn’t Remove Friend',
              reason instanceof Error
                ? reason.message
                : 'This person could not be removed. Please try again.',
            );
          } finally {
            setTransferringUserId(undefined);
          }
        })();
      },
    });
  };

  const applyFormerHostLocalState = (
    result: Awaited<ReturnType<typeof transferTravelTripHost>>,
  ) => {
    const current =
      useTravel.getState().plans.find((item) => item.id === plan.id) ?? plan;
    onSavePlan({
      ...current,
      chatAccessCode: result.formerHostInviteCode,
      hostTripId: canonicalTravelTripId(current),
      hostDisplayName: result.newHostDisplayName,
      openJoinCode: undefined,
      updatedAt: new Date().toISOString(),
    });
  };

  const transferHost = (member: TravelTripRosterPerson, leaveAfter: boolean) => {
    if (!isSoleHost) return;
    confirmDestructiveAction({
      title: leaveAfter ? 'Transfer & leave?' : 'Make host?',
      message: leaveAfter
        ? `${member.displayName} becomes the host and you leave this trip.`
        : `${member.displayName} becomes the host. You stay as a trip friend.`,
      actionLabel: leaveAfter ? 'Transfer & leave' : 'Make host',
      onConfirm: () => {
        void (async () => {
          setTransferringUserId(member.userId);
          try {
            const result = await transferTravelTripHost(tripId, member.userId);
            applyFormerHostLocalState(result);
            if (leaveAfter) {
              try {
                await leaveTravelTrip(tripId);
                removePlan(plan.id);
                onClose();
                return;
              } catch (leaveReason) {
                await refreshRoster(tripId);
                appPrompt.alert(
                  'Host Transferred',
                  leaveReason instanceof Error
                    ? `${member.displayName} is now the host, but you couldn’t leave yet: ${leaveReason.message}`
                    : `${member.displayName} is now the host, but you couldn’t leave yet. Try Leave Trip again.`,
                );
                return;
              }
            }
            await refreshRoster(tripId);
            appPrompt.alert(
              'Host Transferred',
              `${member.displayName} is now the host. You can leave whenever you’re ready.`,
            );
          } catch (reason) {
            appPrompt.alert(
              'Couldn’t Transfer Host',
              reason instanceof Error
                ? reason.message
                : 'Host status could not be transferred.',
            );
          } finally {
            setTransferringUserId(undefined);
          }
        })();
      },
    });
  };

  const transferHostByParticipant = (
    participant: TravelParticipant,
    leaveAfter: boolean,
  ) => {
    if (!isSoleHost) return;
    confirmDestructiveAction({
      title: leaveAfter ? 'Transfer & leave?' : 'Make host?',
      message: leaveAfter
        ? `${participant.name} becomes the host and you leave this trip.`
        : `${participant.name} becomes the host. You stay as a trip friend.`,
      actionLabel: leaveAfter ? 'Transfer & leave' : 'Make host',
      onConfirm: () => {
        void (async () => {
          setTransferringUserId(participant.id);
          try {
            const result = await transferTravelTripHostByInvite(
              tripId,
              participant.inviteCode,
            );
            applyFormerHostLocalState(result);
            if (leaveAfter) {
              try {
                await leaveTravelTrip(tripId);
                removePlan(plan.id);
                onClose();
                return;
              } catch (leaveReason) {
                await refreshRoster(tripId);
                appPrompt.alert(
                  'Host Transferred',
                  leaveReason instanceof Error
                    ? `${participant.name} is now the host, but you couldn’t leave yet: ${leaveReason.message}`
                    : `${participant.name} is now the host, but you couldn’t leave yet. Try Leave Trip again.`,
                );
                return;
              }
            }
            await refreshRoster(tripId);
            appPrompt.alert(
              'Host Transferred',
              `${participant.name} is now the host. You can leave whenever you’re ready.`,
            );
          } catch (reason) {
            appPrompt.alert(
              'Couldn’t Transfer Host',
              reason instanceof Error
                ? reason.message
                : 'Host status could not be transferred. Apply the latest travel migration, then try again.',
            );
          } finally {
            setTransferringUserId(undefined);
          }
        })();
      },
    });
  };

  const makeCohost = (member: TravelTripRosterPerson) => {
    if (!isSoleHost) return;
    void (async () => {
      setTransferringUserId(member.userId);
      try {
        await grantTravelTripCohost(tripId, member.userId);
        setRoster((people) =>
          people.map((person) =>
            person.userId === member.userId
              ? { ...person, role: 'cohost' }
              : person,
          ),
        );
        await refreshRoster(tripId);
      } catch (reason) {
        appPrompt.alert(
          'Couldn’t Make Co-host',
          reason instanceof Error
            ? reason.message
            : 'Co-host status could not be granted.',
        );
      } finally {
        setTransferringUserId(undefined);
      }
    })();
  };

  const removeCohost = (member: TravelTripRosterPerson) => {
    if (!isSoleHost) return;
    setRemoveConfirm({
      title: 'Remove Co-host?',
      message: `${member.displayName} will stay on the trip as a friend, but won’t manage invites.`,
      actionLabel: 'Remove Co-host',
      onConfirm: () => {
        void (async () => {
          setTransferringUserId(member.userId);
          try {
            await revokeTravelTripCohost(tripId, member.userId);
            setRoster((people) =>
              people.map((person) =>
                person.userId === member.userId
                  ? { ...person, role: 'member' }
                  : person,
              ),
            );
            await refreshRoster(tripId);
          } catch (reason) {
            appPrompt.alert(
              'Couldn’t Remove Co-host',
              reason instanceof Error
                ? reason.message
                : 'Co-host status could not be removed.',
            );
          } finally {
            setTransferringUserId(undefined);
          }
        })();
      },
    });
  };

  const copyInviteLink = async (participant: TravelParticipant) => {
    const url = createTravelInviteUrl(
      participant.inviteCode,
      process.env.EXPO_PUBLIC_TRAVEL_SHARE_BASE_URL,
    );
    await Clipboard.setStringAsync(url);
    setCopiedCode(participant.inviteCode);
  };

  const copyOpenJoinLink = async () => {
    if (!openJoinCode) return;
    const url = createTravelOpenJoinUrl(
      openJoinCode,
      process.env.EXPO_PUBLIC_TRAVEL_SHARE_BASE_URL,
    );
    await Clipboard.setStringAsync(url);
    setCopiedOpenJoin(true);
  };

  const shareOpenJoin = async () => {
    if (!openJoinCode) return;
    setOpenJoinBusy(true);
    try {
      await shareTravelOpenJoinLink(plan, openJoinCode);
    } catch (reason) {
      appPrompt.alert(
        'Couldn’t Share Join Link',
        reason instanceof Error
          ? reason.message
          : 'The open join link could not be shared.',
      );
    } finally {
      setOpenJoinBusy(false);
    }
  };

  const decideRequest = async (request: TravelOpenJoinRequest, approve: boolean) => {
    setDecidingRequestId(request.id);
    try {
      const result = await decideTravelOpenJoin(request.id, approve);
      if (approve && result.grantedInviteCode && result.requesterName) {
        const now = new Date().toISOString();
        const current =
          useTravel.getState().plans.find((item) => item.id === plan.id) ?? plan;
        const already = current.participants.some(
          (person) =>
            person.inviteCode === result.grantedInviteCode ||
            (result.requesterUserId && person.userId === result.requesterUserId),
        );
        if (!already) {
          const nextPlan = {
            ...current,
            participants: [
              ...current.participants,
              {
                id: newId('trip-person'),
                userId: result.requesterUserId,
                name: result.requesterName,
                inviteCode: result.grantedInviteCode,
                invitedAt: now,
                acceptedAt: now,
              },
            ],
            updatedAt: now,
          };
          onSavePlan(nextPlan);
          // Push the expanded roster so shared expenses include the new member.
          void publishTravelTripExpenses(nextPlan).catch(() => undefined);
        }
      }
      await refreshJoinRequests(tripId);
      await refreshRoster(tripId);
    } catch (reason) {
      appPrompt.alert(
        approve ? 'Couldn’t Approve Friend' : 'Couldn’t Decline Request',
        reason instanceof Error
          ? reason.message
          : 'The join request could not be updated.',
      );
    } finally {
      setDecidingRequestId(undefined);
    }
  };

  const leaveTrip = () => {
    if (isSoleHost) {
      appPrompt.alert(
        'Transfer host first',
        'Make someone else the host before you leave this trip.',
      );
      return;
    }
    confirmDestructiveAction({
      title: 'Leave this trip?',
      message:
        'You’ll lose access to the shared itinerary, chat, and expenses on this device.',
      actionLabel: 'Leave trip',
      onConfirm: () => {
        void (async () => {
          setLeavingTrip(true);
          try {
            await leaveTravelTrip(tripId);
            removePlan(plan.id);
            onClose();
          } catch (reason) {
            appPrompt.alert(
              'Couldn’t Leave Trip',
              reason instanceof Error
                ? reason.message
                : 'You are still on this trip. Check your connection and try again.',
            );
          } finally {
            setLeavingTrip(false);
          }
        })();
      },
    });
  };

  return {
    sharingInvite,
    managingParticipantId,
    transferringUserId,
    leavingTrip,
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
    leaveTrip,
    copyInviteLink,
    copyOpenJoinLink,
    shareOpenJoin,
    decideRequest,
  };
}
