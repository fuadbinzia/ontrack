import type { AddonEnabledState } from '@/addons/types';
import {
  isTrackerRouteEnabled,
  TAB_META,
} from '@/components/navigation/bottom-nav-tab-meta';
import { MORE_TAB_ROUTE } from '@/components/navigation/tab-pins';
import { addDays } from '@/utils/date';
import { getDateTimeFormatter } from '@/utils/intl-cache';

import type { JournalBlock, JournalPage, JournalSectionLink } from './types';

const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;

export function isJournalDateKey(value: string | undefined): value is string {
  return typeof value === 'string' && DATE_KEY.test(value);
}

export function journalPageHref(dateKey: string): `/(tabs)/journal/${string}` {
  return `/(tabs)/journal/${dateKey}`;
}

export function shiftJournalDate(
  dateKey: string,
  delta: -1 | 1,
  today: string,
): string {
  const next = addDays(dateKey, delta);
  return next > today ? today : next;
}

export function canShiftJournalDate(
  dateKey: string,
  delta: -1 | 1,
  today: string,
): boolean {
  return shiftJournalDate(dateKey, delta, today) !== dateKey;
}

export function pageForDate(
  pages: readonly JournalPage[],
  dateKey: string,
): JournalPage | undefined {
  return pages.find((page) => page.dateKey === dateKey);
}

export function writtenJournalPages(
  pages: readonly JournalPage[],
): JournalPage[] {
  return pages
    .filter((page) => page.blocks.length > 0)
    .sort((a, b) => b.dateKey.localeCompare(a.dateKey));
}

export function earlierJournalPages(
  pages: readonly JournalPage[],
  today: string,
): JournalPage[] {
  return writtenJournalPages(pages).filter((page) => page.dateKey < today);
}

export function journalSectionLinks(
  enabledAddons: Record<string, boolean> | AddonEnabledState,
): JournalSectionLink[] {
  return Object.entries(TAB_META)
    .filter(([routeName]) => {
      if (routeName === MORE_TAB_ROUTE || routeName === 'journal') return false;
      return isTrackerRouteEnabled(routeName, enabledAddons);
    })
    .map(([section, meta]) => ({
      section,
      label: meta.label,
      href: String(meta.href),
    }));
}

export function journalEditDismissFor(reason: 'tap-out' | 'composer-focus'): {
  endBlockEdit: true;
  hideKeyboard: boolean;
} {
  return {
    endBlockEdit: true,
    hideKeyboard: reason === 'tap-out',
  };
}

export function commitJournalTextEdit(
  draft: string,
  original: string,
): string | undefined {
  const next = draft.trim();
  if (!next || next === original) return undefined;
  return next;
}

export type JournalTextEdit = {
  blockId: string;
  before: string;
  after: string;
};

export type JournalTextHistory = {
  undo: JournalTextEdit[];
  redo: JournalTextEdit[];
};

export const emptyJournalTextHistory = (): JournalTextHistory => ({
  undo: [],
  redo: [],
});

const TEXT_HISTORY_LIMIT = 50;

export function pushJournalTextEdit(
  history: JournalTextHistory,
  edit: JournalTextEdit,
): JournalTextHistory {
  return {
    undo: [...history.undo, edit].slice(-TEXT_HISTORY_LIMIT),
    redo: [],
  };
}

export function popJournalTextUndo(history: JournalTextHistory): {
  history: JournalTextHistory;
  edit?: JournalTextEdit;
} {
  if (!history.undo.length) return { history };
  const edit = history.undo[history.undo.length - 1];
  return {
    edit,
    history: {
      undo: history.undo.slice(0, -1),
      redo: [...history.redo, edit],
    },
  };
}

export function popJournalTextRedo(history: JournalTextHistory): {
  history: JournalTextHistory;
  edit?: JournalTextEdit;
} {
  if (!history.redo.length) return { history };
  const edit = history.redo[history.redo.length - 1];
  return {
    edit,
    history: {
      redo: history.redo.slice(0, -1),
      undo: [...history.undo, edit],
    },
  };
}

export function formatJournalClock(iso: string): string {
  try {
    const date = new Date(iso);
    if (Number.isNaN(date.valueOf())) return '';
    return getDateTimeFormatter(undefined, {
      hour: 'numeric',
      minute: '2-digit',
    }).format(date);
  } catch {
    return '';
  }
}

export function journalBlockTimeParts(block: {
  createdAt?: string;
  updatedAt?: string;
}): { created: string; updated: string | null } {
  const created = block.createdAt ? formatJournalClock(block.createdAt) : '';
  if (!created) return { created: '', updated: null };
  if (!block.updatedAt || block.updatedAt === block.createdAt) {
    return { created, updated: null };
  }
  const updated = formatJournalClock(block.updatedAt);
  return { created, updated: updated || null };
}

export function journalIndexTime(block: {
  createdAt?: string;
  updatedAt?: string;
}): string {
  const { created, updated } = journalBlockTimeParts(block);
  return updated ?? created;
}

export function normalizeJournalBlock(
  block: JournalBlock | (Omit<JournalBlock, 'createdAt' | 'updatedAt'> & {
    createdAt?: string;
    updatedAt?: string;
  }),
  fallback: string,
): JournalBlock {
  const createdAt =
    typeof block.createdAt === 'string' && block.createdAt ? block.createdAt : fallback;
  const updatedAt =
    typeof block.updatedAt === 'string' && block.updatedAt ? block.updatedAt : createdAt;
  return { ...block, createdAt, updatedAt } as JournalBlock;
}

export function normalizeJournalPages(pages: readonly JournalPage[]): JournalPage[] {
  return pages.map((page) => {
    const fallback = page.createdAt || page.updatedAt || new Date().toISOString();
    return {
      ...page,
      blocks: page.blocks.map((block) => normalizeJournalBlock(block, fallback)),
    };
  });
}

export function formatVoiceDuration(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

export function pagePreview(page: JournalPage): string {
  const text = page.blocks.find((block) => block.kind === 'text' && block.text.trim());
  if (text?.kind === 'text') return text.text.trim();
  const voice = page.blocks.find((block) => block.kind === 'voice');
  if (voice) return 'Voice note';
  const link = page.blocks.find((block) => block.kind === 'link');
  if (link?.kind === 'link') return link.label;
  return 'Empty page';
}
