import { useEffect, useRef, type Dispatch, type SetStateAction } from 'react';

import {
  ensureTravelOpenJoinLink,
  loadTravelInviteStatuses,
} from '@/features/travel/share';
import {
  canonicalTravelTripId,
  isTravelMemberPlan,
} from '@/features/travel/trip-roster';
import type {
  TravelPlan,
  TravelTripRosterPerson,
} from '@/features/travel/types';
import { TRAVEL_EXPENSE_HOST_ID } from '@/features/travel/types';
import { useRouteIsActive } from '@/hooks/use-app-activity';
import {
  publishTravelTripExpenses,
  travelExpenseMemberId,
} from '@/services/travel/expense-collaboration';
import { useTravel } from '@/store/travel';
import { newId } from '@/utils/id';

type SetOptStr = Dispatch<SetStateAction<string | undefined>>;

/**
 * When the Co-Travelers sheet opens: sync roster into plan, poll invites /
 * join requests, and ensure an open-join code for hosts.
 */
export function useTravelFriendsSheetSync({
  visible,
  plan,
  onSavePlan,
  selfUserId,
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
}: {
  visible: boolean;
  plan: TravelPlan;
  onSavePlan: (plan: TravelPlan) => void;
  selfUserId?: string;
  canManage: boolean;
  openJoinCode?: string;
  setOpenJoinCode: SetOptStr;
  setOpenJoinBusy: Dispatch<SetStateAction<boolean>>;
  setOpenJoinError: SetOptStr;
  setCopiedOpenJoin: Dispatch<SetStateAction<boolean>>;
  setEditingInvite: Dispatch<SetStateAction<boolean>>;
  setInviteName: Dispatch<SetStateAction<string>>;
  setInviteEmail: Dispatch<SetStateAction<string>>;
  setInviteError: SetOptStr;
  setManagingParticipantId: SetOptStr;
  setTransferringUserId: SetOptStr;
  setCopiedCode: SetOptStr;
  setDecidingRequestId: SetOptStr;
  refreshJoinRequests: (tripId: string) => Promise<void>;
  refreshRoster: (
    tripId: string,
  ) => Promise<TravelTripRosterPerson[] | null | undefined>;
}) {
  const routeIsActive = useRouteIsActive();
  const ensuredOpenJoinForPlanRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (!visible || !routeIsActive) return;
    if (plan.openJoinCode && plan.openJoinCode !== openJoinCode) {
      setOpenJoinCode(plan.openJoinCode);
    }
  }, [
    visible,
    routeIsActive,
    plan.openJoinCode,
    openJoinCode,
    setOpenJoinCode,
  ]);

  useEffect(() => {
    if (!visible || !routeIsActive) {
      setEditingInvite(false);
      setInviteName('');
      setInviteEmail('');
      setInviteError(undefined);
      setManagingParticipantId(undefined);
      setTransferringUserId(undefined);
      setCopiedCode(undefined);
      setOpenJoinError(undefined);
      setCopiedOpenJoin(false);
      setDecidingRequestId(undefined);
      ensuredOpenJoinForPlanRef.current = undefined;
      return;
    }

    let active = true;
    const latest =
      useTravel.getState().plans.find((item) => item.id === plan.id) ?? plan;
    const canonicalId = canonicalTravelTripId(latest);
    const isMember = isTravelMemberPlan(latest);
    const savePlan = (next: TravelPlan) => onSavePlan(next);

    const syncRosterIntoPlan = (people: TravelTripRosterPerson[]) => {
      const current =
        useTravel.getState().plans.find((item) => item.id === plan.id) ??
        latest;
      const host = people.find((person) => person.role === 'host');
      let next = current;
      let changed = false;

      // New host after transfer: clear member markers so expense publish stops
      // remapping `self` as a member. Keep hostTripId as the server trip id.
      if (
        selfUserId &&
        host?.userId === selfUserId &&
        isTravelMemberPlan(current)
      ) {
        const formerHost = people.find(
          (person) =>
            person.role !== 'host' &&
            person.userId !== selfUserId &&
            current.hostDisplayName &&
            person.displayName === current.hostDisplayName,
        );
        const formerHostMemberId = formerHost?.userId
          ? travelExpenseMemberId(formerHost.userId)
          : undefined;
        next = {
          ...next,
          chatAccessCode: undefined,
          hostDisplayName: undefined,
          hostTripId: canonicalId,
          expenses: next.expenses.map((expense) => ({
            ...expense,
            paidById:
              expense.paidById === TRAVEL_EXPENSE_HOST_ID && formerHostMemberId
                ? formerHostMemberId
                : expense.paidById,
            splitWithIds: expense.splitWithIds.map((id) =>
              id === TRAVEL_EXPENSE_HOST_ID && formerHostMemberId
                ? formerHostMemberId
                : id,
            ),
          })),
          sharedExpensePeople: (next.sharedExpensePeople ?? []).map((person) =>
            person.id === TRAVEL_EXPENSE_HOST_ID && formerHostMemberId
              ? { ...person, id: formerHostMemberId }
              : person,
          ),
        };
        changed = true;
      } else if (
        host?.displayName &&
        current.hostDisplayName !== host.displayName &&
        (isTravelMemberPlan(current) || current.hostDisplayName)
      ) {
        next = {
          ...next,
          hostDisplayName: host.displayName,
        };
        changed = true;
      }

      // Keep local invite labels in sync with roster names so trip-card
      // initials match Co-Travelers (e.g. "Jordan Lee" vs truncated "Jordan").
      let participants = next.participants.map((person) => {
        const match = people.find(
          (member) =>
            (member.role === 'member' || member.role === 'cohost') &&
            (member.inviteCode === person.inviteCode ||
              (member.email &&
                person.email &&
                member.email.toLowerCase() === person.email.toLowerCase())),
        );
        if (!match?.displayName || match.displayName === person.name)
          return person;
        changed = true;
        return { ...person, name: match.displayName };
      });

      // Host plans: rebuild missing accepted friends from the server roster so
      // trip-card + Co-Travelers stay mutual after invite-status races.
      if (!isTravelMemberPlan(next)) {
        const now = new Date().toISOString();
        for (const member of people) {
          if (member.role !== 'member' && member.role !== 'cohost') continue;
          if (!member.inviteCode) continue;
          const exists = participants.some(
            (person) =>
              person.inviteCode === member.inviteCode ||
              (member.email &&
                person.email &&
                person.email.toLowerCase() === member.email.toLowerCase()),
          );
          if (exists) continue;
          changed = true;
          participants = [
            ...participants,
            {
              id: newId('trip-person'),
              name: member.displayName,
              ...(member.email ? { email: member.email } : {}),
              inviteCode: member.inviteCode,
              invitedAt: member.acceptedAt ?? now,
              acceptedAt: member.acceptedAt ?? now,
            },
          ];
        }
      }

      if (changed) {
        savePlan({
          ...next,
          participants,
          updatedAt: new Date().toISOString(),
        });
      }
    };

    const reconcileInviteStatuses = (people: TravelTripRosterPerson[]) => {
      if (isMember) return;
      const inviteCodes = (
        useTravel.getState().plans.find((item) => item.id === plan.id) ?? latest
      ).participants.map((person) => person.inviteCode);
      if (inviteCodes.length === 0) return;

      void loadTravelInviteStatuses(inviteCodes)
        .then((statuses) => {
          // Empty `{}` is meaningful: every accepted invite may have been revoked.
          if (!active) return;
          const current =
            useTravel.getState().plans.find((item) => item.id === plan.id) ??
            latest;
          const rosterCodes = new Set(
            people
              .map((person) => person.inviteCode)
              .filter((value): value is string => Boolean(value)),
          );
          const rosterEmails = new Set(
            people
              .map((person) => person.email?.trim().toLowerCase())
              .filter((value): value is string => Boolean(value)),
          );
          let changed = false;
          const participants = current.participants.flatMap((person) => {
            const acceptedAt = statuses[person.inviteCode];
            if (acceptedAt) {
              if (person.acceptedAt === acceptedAt) return [person];
              changed = true;
              return [{ ...person, acceptedAt }];
            }
            // Statuses only include live accepted invites. Drop friends who left
            // or were revoked — but never drop someone still on the server roster.
            if (person.acceptedAt) {
              const email = person.email?.trim().toLowerCase();
              if (
                rosterCodes.has(person.inviteCode) ||
                (email && rosterEmails.has(email))
              ) {
                return [person];
              }
              changed = true;
              return [];
            }
            return [person];
          });
          if (changed) {
            savePlan({
              ...current,
              participants,
              updatedAt: new Date().toISOString(),
            });
          }
        })
        .catch(() => undefined);
    };

    const refreshFriends = () =>
      void refreshRoster(canonicalId).then((people) => {
        if (!active || !people) return;
        syncRosterIntoPlan(people);
        reconcileInviteStatuses(people);
      });

    refreshFriends();

    if (canManage) {
      const alreadyHaveCode = Boolean(latest.openJoinCode);
      const alreadyEnsured = ensuredOpenJoinForPlanRef.current === plan.id;
      if (!alreadyHaveCode && !alreadyEnsured) {
        ensuredOpenJoinForPlanRef.current = plan.id;
        setOpenJoinBusy(true);
        void ensureTravelOpenJoinLink(latest)
          .then((code) => {
            if (!active) return;
            setOpenJoinCode(code);
            setOpenJoinError(undefined);
            const current =
              useTravel.getState().plans.find((item) => item.id === plan.id) ??
              latest;
            if (current.openJoinCode !== code) {
              const next = {
                ...current,
                openJoinCode: code,
                updatedAt: new Date().toISOString(),
              };
              savePlan(next);
              void publishTravelTripExpenses(next).catch(() => undefined);
            }
            return refreshJoinRequests(canonicalId);
          })
          .catch((reason: unknown) => {
            if (!active) return;
            ensuredOpenJoinForPlanRef.current = undefined;
            setOpenJoinError(
              reason instanceof Error
                ? reason.message
                : 'The open join link could not be created.',
            );
          })
          .finally(() => {
            if (active) setOpenJoinBusy(false);
          });
      } else if (alreadyHaveCode) {
        setOpenJoinCode(latest.openJoinCode);
        void refreshJoinRequests(canonicalId);
      }
    }

    const poll = setInterval(() => {
      if (!active) return;
      refreshFriends();
      if (canManage) void refreshJoinRequests(canonicalId);
    }, 5000);

    return () => {
      active = false;
      clearInterval(poll);
    };
  }, [
    visible,
    routeIsActive,
    plan,
    onSavePlan,
    selfUserId,
    canManage,
    refreshJoinRequests,
    refreshRoster,
    setCopiedCode,
    setCopiedOpenJoin,
    setDecidingRequestId,
    setEditingInvite,
    setInviteEmail,
    setInviteError,
    setInviteName,
    setManagingParticipantId,
    setOpenJoinBusy,
    setOpenJoinCode,
    setOpenJoinError,
    setTransferringUserId,
  ]);
}
