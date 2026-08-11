import { useSyncExternalStore } from 'react';

import type {
  RuntimeActivityCategory,
  RuntimeActivitySnapshot,
  RuntimeActivityStatus,
} from './types';

const activities = new Map<string, RuntimeActivitySnapshot>();
const listeners = new Set<() => void>();
let snapshot: RuntimeActivitySnapshot[] = [];

function publish() {
  snapshot = Array.from(activities.values()).sort((a, b) => {
    if (a.status === 'running' && b.status !== 'running') return -1;
    if (b.status === 'running' && a.status !== 'running') return 1;
    return b.updatedAt - a.updatedAt;
  });
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useRuntimeActivities(): RuntimeActivitySnapshot[] {
  return useSyncExternalStore(subscribe, () => snapshot, () => snapshot);
}

export function getRuntimeActivitiesSnapshot(): RuntimeActivitySnapshot[] {
  return snapshot;
}

export type RuntimeActivityDefinition = {
  id: string;
  label: string;
  category: RuntimeActivityCategory;
  detail?: string;
};

export function setRuntimeActivity(
  definition: RuntimeActivityDefinition,
  patch: Partial<Pick<RuntimeActivitySnapshot, 'status' | 'pending' | 'detail'>> = {},
): void {
  const now = Date.now();
  const current = activities.get(definition.id);
  const status = patch.status ?? current?.status ?? 'running';
  activities.set(definition.id, {
    id: definition.id,
    label: definition.label,
    category: definition.category,
    status,
    startedAt:
      status === 'running'
        ? current?.startedAt ?? now
        : current?.startedAt,
    updatedAt: now,
    operations: current?.operations ?? 0,
    errors: current?.errors ?? 0,
    pending: patch.pending ?? current?.pending ?? 0,
    receivedBytes: current?.receivedBytes ?? 0,
    sentBytes: current?.sentBytes ?? 0,
    detail: patch.detail ?? definition.detail ?? current?.detail,
  });
  publish();
}

export function removeRuntimeActivity(id: string): void {
  if (!activities.delete(id)) return;
  publish();
}

export function beginRuntimeOperation(
  definition: RuntimeActivityDefinition,
  options?: { sentBytes?: number; detail?: string },
): (result?: { error?: boolean; receivedBytes?: number }) => void {
  setRuntimeActivity(definition, { status: 'running', detail: options?.detail });
  const started = activities.get(definition.id)!;
  activities.set(definition.id, {
    ...started,
    operations: started.operations + 1,
    pending: started.pending + 1,
    sentBytes: started.sentBytes + (options?.sentBytes ?? 0),
  });
  publish();
  let finished = false;
  return (result) => {
    if (finished) return;
    finished = true;
    const current = activities.get(definition.id);
    if (!current) return;
    const pending = Math.max(0, current.pending - 1);
    activities.set(definition.id, {
      ...current,
      status: result?.error ? 'error' : pending > 0 ? 'running' : 'idle',
      pending,
      errors: current.errors + (result?.error ? 1 : 0),
      receivedBytes: current.receivedBytes + (result?.receivedBytes ?? 0),
      updatedAt: Date.now(),
    });
    publish();
  };
}

export function resetRuntimeActivitiesForTests(): void {
  activities.clear();
  publish();
}

export function runtimeActivityStatusLabel(status: RuntimeActivityStatus): string {
  return status === 'running' ? 'Active' : status[0]!.toUpperCase() + status.slice(1);
}
