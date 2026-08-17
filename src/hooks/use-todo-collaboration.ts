import { useEffect, useMemo } from 'react';
import { AppState } from 'react-native';

import {
  removeRuntimeActivity,
  setRuntimeActivity,
} from '@/features/performance/runtime-activity';
import {
  flushChecklistMutations,
  loadAllSharedChecklists,
  loadChecklistSnapshot,
  subscribeToChecklist,
  ChecklistCollaborationError,
} from '@/services/todos/collaboration';
import { useChecklists } from '@/store/todos';

function isRevokedSharedListError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? '');
  // Match the RPC access denial only — not generic refresh/network failures.
  return /no longer have access to this list/i.test(message);
}

export function useChecklistCollaboration(enabled: boolean) {
  const lists = useChecklists((state) => state.lists);
  const sharedLists = useMemo(
    () => lists.filter((list) => list.mode === 'shared'),
    [lists],
  );
  const pendingCount = useChecklists((state) => state.pendingMutations.length);
  const sharedKey = useMemo(
    () =>
      sharedLists
        .map((list) => list.id)
        .sort()
        .join(','),
    [sharedLists],
  );

  useEffect(() => {
    if (!enabled) return;
    setRuntimeActivity(
      { id: 'sync.todos', label: 'Shared checklist sync', category: 'sync' },
      {
        status: 'running',
        pending: pendingCount,
        detail: `${sharedLists.length} shared lists`,
      },
    );
    return () => removeRuntimeActivity('sync.todos');
  }, [enabled, pendingCount, sharedLists.length]);

  useEffect(() => {
    if (!enabled) return;
    void loadAllSharedChecklists().catch(() => undefined);
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        void loadAllSharedChecklists().catch(() => undefined);
      }
    });
    return () => subscription.remove();
  }, [enabled]);

  useEffect(() => {
    if (!enabled || !pendingCount) return;
    void flushChecklistMutations().catch(() => undefined);
    // Soft prep/RPC failures leave pending length unchanged — retry while
    // mutations remain rather than waiting for AppState/realtime traffic.
    const timer = setInterval(() => {
      if (useChecklists.getState().pendingMutations.length === 0) return;
      void flushChecklistMutations().catch(() => undefined);
    }, 15_000);
    return () => clearInterval(timer);
  }, [enabled, pendingCount]);

  useEffect(() => {
    if (!enabled) return;
    const channels = sharedLists.flatMap((list) => {
      const channel = subscribeToChecklist(list, () => {
        void (async () => {
          const hasPending = () =>
            useChecklists
              .getState()
              .pendingMutations.some((mutation) => mutation.listId === list.id);
          if (hasPending()) {
            await flushChecklistMutations().catch(() => undefined);
            // Keep optimistic local state until pending mutations land; a
            // remote snapshot would otherwise wipe unsynced edits.
            if (hasPending()) return;
          }
          await loadChecklistSnapshot(list.id).catch((error: unknown) => {
            // Transient network/auth blips must not wipe the local shared list.
            if (
              error instanceof ChecklistCollaborationError &&
              isRevokedSharedListError(error)
            ) {
              useChecklists.getState().removeSharedList(list.id);
            }
          });
        })();
      });
      return channel ? [channel] : [];
    });
    return () => {
      channels.forEach((channel) => {
        void channel.unsubscribe();
      });
    };
    // sharedKey intentionally re-subscribes only when membership changes.
  }, [enabled, sharedKey]); // eslint-disable-line react-hooks/exhaustive-deps
}
