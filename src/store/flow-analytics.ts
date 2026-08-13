import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import {
  collapseFlowPath,
  type FlowAnalyticsEvent,
  type FlowLifecycle,
} from '@/services/analytics/flow-model';
import { createPersistStorage, STORAGE_KEYS } from '@/services/storage';
import { newId, newUuid } from '@/utils/id';

const MAX_PENDING_EVENTS = 200;
const SESSION_IDLE_MS = 90_000;

type ActiveFlowSession = {
  id: string;
  currentRoute: string;
  path: string[];
  lastEventAt: number;
};

type FlowAnalyticsState = {
  pending: FlowAnalyticsEvent[];
  session?: ActiveFlowSession;
  visitRoute: (route: string, at?: number) => void;
  recordOutcome: (outcomeId: string, lifecycle: 'complete' | 'fail', at?: number) => void;
  recordPageLoad: (route: string, fromRoute: string | undefined, durationMs: number, at?: number) => void;
  recordActionDuration: (outcomeId: string, durationMs: number, at?: number) => void;
  heartbeat: (at?: number) => void;
  endSession: (at?: number) => void;
  acknowledge: (ids: readonly string[]) => void;
  reset: () => void;
};

function event(
  sessionId: string,
  route: string,
  lifecycle: FlowLifecycle,
  at: number,
  extra: Pick<FlowAnalyticsEvent, 'fromRoute' | 'outcomeId' | 'path' | 'metric' | 'durationMs'> = {},
): FlowAnalyticsEvent {
  return {
    id: newUuid(),
    sessionId,
    route,
    lifecycle,
    occurredAt: new Date(at).toISOString(),
    ...extra,
  };
}

function append(pending: FlowAnalyticsEvent[], additions: FlowAnalyticsEvent[]) {
  return [...pending, ...additions].slice(-MAX_PENDING_EVENTS);
}

function freshSession(route: string, at: number): ActiveFlowSession {
  return { id: newId('flow-session'), currentRoute: route, path: [route], lastEventAt: at };
}

export const useFlowAnalytics = create<FlowAnalyticsState>()(
  persist(
    (set, get) => ({
      pending: [],
      visitRoute: (route, at = Date.now()) => set((state) => {
        const previous = state.session;
        const expired = !previous || at - previous.lastEventAt > SESSION_IDLE_MS;
        const session = expired ? freshSession(route, at) : previous;
        const additions = [event(session.id, route, 'visit', at)];
        if (!expired && session.currentRoute !== route) {
          additions.push(event(session.id, route, 'complete', at, { fromRoute: session.currentRoute }));
        }
        return {
          pending: append(state.pending, additions),
          session: {
            ...session,
            currentRoute: route,
            path: collapseFlowPath([...session.path, route]),
            lastEventAt: at,
          },
        };
      }),
      recordOutcome: (outcomeId, lifecycle, at = Date.now()) => set((state) => {
        const session = state.session;
        if (!session) return state;
        return {
          pending: append(state.pending, [
            event(session.id, session.currentRoute, lifecycle, at, { outcomeId }),
          ]),
          session: { ...session, lastEventAt: at },
        };
      }),
      recordPageLoad: (route, fromRoute, durationMs, at = Date.now()) => set((state) => {
        const session = state.session;
        if (!session || !Number.isFinite(durationMs)) return state;
        return {
          pending: append(state.pending, [event(session.id, route, 'measure', at, {
            fromRoute,
            metric: 'page-load',
            durationMs: Math.max(0, Math.min(120_000, Math.round(durationMs / 10) * 10)),
          })]),
          session: { ...session, lastEventAt: at },
        };
      }),
      recordActionDuration: (outcomeId, durationMs, at = Date.now()) => set((state) => {
        const session = state.session;
        if (!session || !Number.isFinite(durationMs)) return state;
        return {
          pending: append(state.pending, [event(session.id, session.currentRoute, 'measure', at, {
            outcomeId,
            metric: 'action',
            durationMs: Math.max(0, Math.min(120_000, Math.round(durationMs / 10) * 10)),
          })]),
          session: { ...session, lastEventAt: at },
        };
      }),
      heartbeat: (at = Date.now()) => set((state) => {
        const session = state.session;
        if (!session) return state;
        return {
          pending: append(state.pending, [event(session.id, session.currentRoute, 'heartbeat', at, {
            fromRoute: session.path.at(-2),
          })]),
          session: { ...session, lastEventAt: at },
        };
      }),
      endSession: (at = Date.now()) => set((state) => {
        const session = state.session;
        if (!session) return state;
        return {
          pending: append(state.pending, [event(session.id, session.currentRoute, 'session-end', at, {
            path: collapseFlowPath(session.path),
          })]),
          session: undefined,
        };
      }),
      acknowledge: (ids) => {
        const accepted = new Set(ids);
        set((state) => ({ pending: state.pending.filter((item) => !accepted.has(item.id)) }));
      },
      reset: () => set({ pending: [], session: undefined }),
    }),
    {
      name: STORAGE_KEYS.flowAnalytics,
      storage: createPersistStorage(),
      partialize: (state) => ({ pending: state.pending }),
    },
  ),
);

export function recordFlowOutcome(outcomeId: string, lifecycle: 'complete' | 'fail') {
  useFlowAnalytics.getState().recordOutcome(outcomeId, lifecycle);
}

/** Times an enumerated product action without accepting labels, errors, or content. */
export function beginFlowAction(outcomeId: string, startedAt = performance.now()) {
  let finished = false;
  return (lifecycle: 'complete' | 'fail') => {
    if (finished) return;
    finished = true;
    const store = useFlowAnalytics.getState();
    store.recordOutcome(outcomeId, lifecycle);
    store.recordActionDuration(outcomeId, performance.now() - startedAt);
  };
}
