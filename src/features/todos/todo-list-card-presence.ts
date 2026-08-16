export type TodoListCardPresence = {
  clear: boolean;
  empty: boolean;
  label: string;
  sublabel: 'Open' | 'Clear';
  tone: 'accent' | 'success';
};

function finiteCount(value: number): number {
  if (!Number.isFinite(value) || value < 0) return 0;
  return Math.floor(value);
}

/** Open-count pulse for a checklist hub card. */
export function todoListCardPresence(
  open: number,
  total: number,
): TodoListCardPresence {
  const safeTotal = finiteCount(total);
  const safeOpen = Math.min(finiteCount(open), safeTotal);
  const empty = safeTotal === 0;
  const clear = !empty && safeOpen === 0;
  return {
    clear,
    empty,
    label: String(safeOpen),
    sublabel: clear ? 'Clear' : 'Open',
    tone: safeOpen ? 'accent' : 'success',
  };
}
