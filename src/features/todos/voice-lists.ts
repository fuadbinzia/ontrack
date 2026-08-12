import { canEditTodoContent, useTodos } from '@/store/todos';
import type { TodoList, TodoListKind, TodoPersistedState } from '@/store/todos';
import OnTrackVoiceLists from '../../../modules/ontrack-voice-lists';
import type {
  VoiceKindHint,
  VoiceListSnapshot,
  VoiceListSnapshotItem,
  VoicePendingOp,
} from '../../../modules/ontrack-voice-lists';

const INBOX_NAME = 'Inbox';
const GROCERIES_NAME = 'Groceries';
const GENERIC_NAME_RE =
  /^(my\s+)?((grocery|groceries|shopping|supermarket|to-?do|todo|checklist|task|tasks)(\s+list)?|list)$/i;
const GROCERY_RE = /\b(grocer(?:y|ies)|shopping|supermarket)\b/i;
const CHECKLIST_RE = /\b(to-?do|todo|checklist|task|tasks)\b/i;

export function inferVoiceKindHint(text?: string): VoiceKindHint | undefined {
  if (!text) return undefined;
  if (GROCERY_RE.test(text)) return 'grocery';
  if (CHECKLIST_RE.test(text)) return 'checklist';
  return undefined;
}

export function voiceListNameQuery(text?: string): string | undefined {
  const trimmed = text?.trim();
  if (!trimmed || GENERIC_NAME_RE.test(trimmed)) return undefined;
  return trimmed;
}

export function matchVoiceList(
  lists: VoiceListSnapshotItem[],
  hint?: string,
  kindHint?: VoiceKindHint,
): VoiceListSnapshotItem | undefined {
  const editable = lists.filter((list) => list.canEdit);
  const pool = editable.length > 0 ? editable : lists;
  if (pool.length === 0) return undefined;

  const kind = kindHint ?? inferVoiceKindHint(hint);
  const byKind = kind ? pool.filter((list) => list.kind === kind) : pool;
  if (kind && byKind.length === 0) return undefined;
  const candidates = byKind.length > 0 ? byKind : pool;
  const nameQuery = voiceListNameQuery(hint)?.toLowerCase();

  if (nameQuery) {
    const exact =
      candidates.find((list) => list.name.toLowerCase() === nameQuery) ??
      pool.find((list) => list.name.toLowerCase() === nameQuery);
    if (exact) return exact;
    const partial =
      candidates.find((list) => list.name.toLowerCase().includes(nameQuery)) ??
      pool.find((list) => list.name.toLowerCase().includes(nameQuery));
    if (partial) return partial;
  }

  return [...candidates].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
}

export function buildVoiceSnapshot(state: TodoPersistedState): VoiceListSnapshot {
  const lists: VoiceListSnapshotItem[] = state.lists.map((list) => ({
    id: list.id,
    name: list.name,
    kind: list.kind,
    canEdit: canEditTodoContent(list),
    updatedAt: list.updatedAt,
    openTitles: state.tasks
      .filter((task) => task.listId === list.id && !task.completed)
      .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
      .map((task) => task.title),
  }));
  return { lists };
}

function toSnapshotItems(state: TodoPersistedState): VoiceListSnapshotItem[] {
  return buildVoiceSnapshot(state).lists;
}

function ensureVoiceList(op: VoicePendingOp): TodoList | undefined {
  const state = useTodos.getState();
  const match = matchVoiceList(toSnapshotItems(state), op.listName, op.kindHint);
  if (match?.canEdit) {
    return state.lists.find((list) => list.id === match.id);
  }

  const kind: TodoListKind = op.kindHint === 'grocery' ? 'grocery' : 'checklist';
  const name =
    voiceListNameQuery(op.listName) ??
    (kind === 'grocery' ? GROCERIES_NAME : INBOX_NAME);
  return useTodos.getState().createList(name, kind);
}

export function applyVoicePendingToStore(ops: VoicePendingOp[]): number {
  let applied = 0;
  for (const op of ops) {
    const title = op.title.trim();
    if (!title) continue;
    const list = op.listId
      ? useTodos.getState().lists.find((item) => item.id === op.listId)
      : undefined;
    const target =
      (list && canEditTodoContent(list) ? list : undefined) ?? ensureVoiceList(op);
    if (!target) continue;
    if (useTodos.getState().addTask(target.id, title)) applied += 1;
  }
  return applied;
}

export async function applyVoicePendingOps(): Promise<number> {
  if (!OnTrackVoiceLists) return 0;
  const ops = await OnTrackVoiceLists.takePendingAsync();
  return applyVoicePendingToStore(ops);
}

export async function publishVoiceSnapshot(): Promise<void> {
  if (!OnTrackVoiceLists) return;
  const snapshot = buildVoiceSnapshot(useTodos.getState());
  await OnTrackVoiceLists.publishSnapshotAsync(JSON.stringify(snapshot));
}

export function subscribeVoicePending(listener: () => void): () => void {
  if (!OnTrackVoiceLists) return () => undefined;
  const subscription = OnTrackVoiceLists.addListener('onPending', listener);
  return () => subscription.remove();
}
