import type { RealtimeChannel } from '@supabase/supabase-js';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';

import { ALL_ACCOUNTS_TEST_TRIP } from '@/constants/travel';
import {
  applyTravelChatPeerReadAt,
  chatNotificationsAreEnabled,
  enableTravelChatNotifications,
  getTravelChatDeviceId,
  isTravelChatAlertsBannerDismissed,
  loadTravelChatMessages,
  markTravelChatRead,
  mergeTravelChatMessages,
  subscribeToTravelChat,
  travelChatAccessCode,
  type OptimisticTravelChatMessage,
  type TravelChatMember,
} from '@/features/travel/chat';
import {
  listMyTravelChatAccess,
  matchTravelChatAccessCapability,
  planPatchFromTravelChatCapability,
  planPatchFromTravelChatRoster,
  resolveTravelChatAccessFromRoster,
  resolveTravelChatMembersFromRoster,
} from '@/features/travel/travel-chat-roster';
import { resolveTravelCoTravelerPeople } from '@/features/travel/travel-cotraveler-people';
import {
  canonicalTravelTripId,
  listTravelTripRoster,
} from '@/features/travel/trip-roster';
import type { TravelPlan, TravelTripRosterPerson } from '@/features/travel/types';
import { useTravel } from '@/store/travel';

export function useTravelChatSession(input: {
  planId: string;
  plan: TravelPlan | undefined;
  userId?: string;
  senderName: string;
  savePlan: (plan: TravelPlan) => void;
}) {
  const { planId, plan, userId, senderName, savePlan } = input;
  const localAccessCode = plan ? travelChatAccessCode(plan) : undefined;
  const [roster, setRoster] = useState<TravelTripRosterPerson[]>([]);
  const [rosterAccessCode, setRosterAccessCode] = useState<string>();
  const [rosterReady, setRosterReady] = useState(false);
  const accessCode = localAccessCode ?? rosterAccessCode;
  const [deviceId, setDeviceId] = useState('');
  const [messages, setMessages] = useState<OptimisticTravelChatMessage[]>([]);
  const [peerTypingName, setPeerTypingName] = useState<string>();
  const [loading, setLoading] = useState(Boolean(localAccessCode));
  const [error, setError] = useState<string>();
  const [notificationsAvailable, setNotificationsAvailable] = useState(true);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  /** null = still loading persisted dismiss; avoid banner flash. */
  const [alertsBannerDismissed, setAlertsBannerDismissed] = useState<
    boolean | null
  >(null);

  const channelRef = useRef<RealtimeChannel | undefined>(undefined);
  const peerTypingClearRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const canonicalTripId = plan ? canonicalTravelTripId(plan) : undefined;

  const fallbackMembers = useMemo<TravelChatMember[]>(() => {
    if (!plan) return [];
    return resolveTravelCoTravelerPeople(plan, senderName).map((person) => ({
      id: person.id,
      name: person.name,
      isSelf: person.isSelf,
      userId: person.userId,
    }));
  }, [plan, senderName]);

  const members = useMemo(
    () =>
      resolveTravelChatMembersFromRoster({
        roster,
        selfUserId: userId,
        selfDisplayName: senderName,
        fallback: fallbackMembers,
      }),
    [fallbackMembers, roster, senderName, userId],
  );

  const memberSubtitle = useMemo(() => {
    if (!plan) return 'Plan Together · Stay Connected';
    if (plan.id === ALL_ACCOUNTS_TEST_TRIP.id) return 'Shared Test Chat · Plan Together';
    const count = Math.max(members.length, plan.participants.length + 1);
    return `${count} ${count === 1 ? 'Trip Member' : 'Trip Members'} · Plan Together`;
  }, [members.length, plan]);

  const refresh = useCallback(async () => {
    if (!accessCode) return;
    try {
      const next = await loadTravelChatMessages(accessCode);
      setMessages((current) => mergeTravelChatMessages(next, current));
      setError(undefined);
      const newest = next[next.length - 1];
      if (newest) {
        void markTravelChatRead(accessCode, newest.createdAt).catch(() => undefined);
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Messages could not be loaded.');
    }
  }, [accessCode]);

  useEffect(() => {
    if (!planId || !canonicalTripId) {
      setRoster([]);
      setRosterAccessCode(undefined);
      setRosterReady(true);
      return;
    }

    let active = true;
    setRosterReady(false);

    const recoverChat = async () => {
      const latest = useTravel.getState().plans.find((item) => item.id === planId);
      if (!latest || !active) return;

      let working = latest;
      let people: TravelTripRosterPerson[] = [];
      try {
        people = await listTravelTripRoster(canonicalTravelTripId(working));
      } catch {
        people = [];
      }
      if (!active) return;

      const capabilities = await listMyTravelChatAccess();
      if (!active) return;
      const matched = matchTravelChatAccessCapability(working, capabilities);
      let recovered =
        matched?.role === 'member'
          ? matched.accessCode
          : resolveTravelChatAccessFromRoster({
              plan: working,
              roster: people,
              selfUserId: userId,
            });

      if (matched && (matched.role === 'member' || !recovered)) {
        recovered = matched.accessCode;
        const remapped = planPatchFromTravelChatCapability({
          plan: working,
          capability: matched,
        });
        if (remapped) {
          working = remapped;
          savePlan(remapped);
        }
        if (matched.tripId !== canonicalTravelTripId(latest)) {
          try {
            people = await listTravelTripRoster(matched.tripId);
          } catch {
            // Keep prior roster (may be empty).
          }
        }
      }

      if (!recovered) {
        recovered = resolveTravelChatAccessFromRoster({
          plan: working,
          roster: people,
          selfUserId: userId,
        });
      }

      if (!active) return;
      setRoster(people);
      setRosterAccessCode(recovered);
      const patched = planPatchFromTravelChatRoster({
        plan: working,
        roster: people,
        selfUserId: userId,
        accessCode: recovered,
      });
      if (patched) savePlan(patched);
    };

    void recoverChat()
      .catch(() => {
        if (!active) return;
        setRoster([]);
        setRosterAccessCode(undefined);
      })
      .finally(() => {
        if (active) setRosterReady(true);
      });

    return () => {
      active = false;
    };
  }, [canonicalTripId, planId, savePlan, userId]);

  useEffect(() => {
    let active = true;
    void getTravelChatDeviceId().then((value) => {
      if (active) setDeviceId(value);
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!accessCode) {
      if (rosterReady) setLoading(false);
      return;
    }
    let active = true;
    setLoading(true);
    void refresh().then(() => {
      if (active) setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [accessCode, refresh, rosterReady]);

  useEffect(() => {
    if (!accessCode || !canonicalTripId) return;
    const channel = subscribeToTravelChat(canonicalTripId, {
      onChanged: (payload) => {
        if (payload.type === 'read' && payload.user_id !== userId) {
          const stamp =
            typeof payload.last_read_at === 'string'
              ? payload.last_read_at
              : undefined;
          if (stamp) {
            setMessages((current) => applyTravelChatPeerReadAt(current, stamp));
          }
          return;
        }
        void refresh();
      },
      onTyping: (payload) => {
        if (!payload.userId || payload.userId === userId) return;
        setPeerTypingName(payload.name?.trim() || 'Someone');
        if (peerTypingClearRef.current) clearTimeout(peerTypingClearRef.current);
        peerTypingClearRef.current = setTimeout(() => {
          setPeerTypingName(undefined);
        }, 2800);
      },
    });
    channelRef.current = channel;
    const onAppState = (state: string) => {
      if (state === 'active') void refresh();
    };
    const sub = AppState.addEventListener('change', onAppState);
    return () => {
      sub.remove();
      channelRef.current = undefined;
      if (channel) {
        void channel.unsubscribe();
      }
      if (peerTypingClearRef.current) clearTimeout(peerTypingClearRef.current);
    };
  }, [accessCode, canonicalTripId, refresh, userId]);

  useEffect(() => {
    let active = true;
    void isTravelChatAlertsBannerDismissed().then((dismissed) => {
      if (active) setAlertsBannerDismissed(dismissed);
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!accessCode || !deviceId) return;
    let active = true;
    void chatNotificationsAreEnabled()
      .then(async (enabled) => {
        if (!enabled) return false;
        await enableTravelChatNotifications(accessCode, deviceId);
        return true;
      })
      .then((enabled) => {
        if (active) setNotificationsEnabled(enabled);
      })
      .catch((reason: unknown) => {
        if (
          active &&
          reason instanceof Error &&
          reason.message.startsWith('Push alerts are unavailable')
        ) {
          setNotificationsAvailable(false);
        }
      });
    return () => {
      active = false;
    };
  }, [accessCode, deviceId]);

  return {
    accessCode,
    roster,
    rosterReady,
    deviceId,
    messages,
    setMessages,
    loading,
    error,
    setError,
    peerTypingName,
    members,
    memberSubtitle,
    refresh,
    channelRef,
    notificationsAvailable,
    notificationsEnabled,
    setNotificationsEnabled,
    setNotificationsAvailable,
    alertsBannerDismissed,
    setAlertsBannerDismissed,
  };
}
