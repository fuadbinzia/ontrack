import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import {
  emptyJournalTextHistory,
  normalizeJournalPages,
  popJournalTextRedo,
  popJournalTextUndo,
  pushJournalTextEdit,
  type JournalTextHistory,
} from '@/features/journal/model';
import type { JournalBlock, JournalPage } from '@/features/journal/types';
import { deleteJournalVoice } from '@/features/journal/voice-persist';
import { createSensitivePersistStorage, STORAGE_KEYS } from '@/services/storage';
import { todayKey } from '@/utils/date';
import { newId } from '@/utils/id';

interface JournalState {
  version: 1;
  aiDisclosureAccepted: boolean;
  pages: JournalPage[];
  textHistory: Record<string, JournalTextHistory>;
  acceptAiDisclosure: () => void;
  ensurePage: (dateKey?: string) => string;
  addText: (dateKey: string, text: string) => string | undefined;
  addVoice: (dateKey: string, uri: string, durationMs: number) => string | undefined;
  addLink: (dateKey: string, section: string, label: string) => string | undefined;
  updateText: (dateKey: string, blockId: string, text: string) => string | undefined;
  undoText: (dateKey: string) => string | undefined;
  redoText: (dateKey: string) => string | undefined;
  removeBlock: (dateKey: string, blockId: string) => void;
  reset: () => void;
}

const initialState = () => ({
  version: 1 as const,
  aiDisclosureAccepted: false,
  pages: [] as JournalPage[],
  textHistory: {} as Record<string, JournalTextHistory>,
});

function writeText(
  pages: JournalPage[],
  dateKey: string,
  blockId: string,
  text: string,
): JournalPage[] {
  const now = stamp();
  return withPage(pages, dateKey, (entry) => ({
    ...entry,
    blocks: entry.blocks.map((item) =>
      item.id === blockId && item.kind === 'text'
        ? { ...item, text, updatedAt: now }
        : item,
    ),
    updatedAt: now,
  }));
}

function stamp(): string {
  return new Date().toISOString();
}

function withPage(
  pages: JournalPage[],
  dateKey: string,
  update: (page: JournalPage) => JournalPage,
): JournalPage[] {
  const existing = pages.find((page) => page.dateKey === dateKey);
  if (!existing) return pages;
  return pages.map((page) => (page.dateKey === dateKey ? update(page) : page));
}

function appendBlock(page: JournalPage, block: JournalBlock): JournalPage {
  return {
    ...page,
    blocks: [...page.blocks, block],
    updatedAt: stamp(),
  };
}

export const useJournal = create<JournalState>()(
  persist(
    (set, get) => ({
      ...initialState(),
      acceptAiDisclosure: () => set({ aiDisclosureAccepted: true }),
      ensurePage: (dateKey = todayKey()) => {
        const existing = get().pages.find((page) => page.dateKey === dateKey);
        if (existing) return existing.id;
        const now = stamp();
        const page: JournalPage = {
          id: newId('journal'),
          dateKey,
          blocks: [],
          createdAt: now,
          updatedAt: now,
        };
        set((state) => ({ pages: [...state.pages, page] }));
        return page.id;
      },
      addText: (dateKey, text) => {
        const trimmed = text.trim();
        if (!trimmed) return undefined;
        get().ensurePage(dateKey);
        const id = newId('jtext');
        const now = stamp();
        set((state) => ({
          pages: withPage(state.pages, dateKey, (page) =>
            appendBlock(page, {
              id,
              kind: 'text',
              text: trimmed,
              createdAt: now,
              updatedAt: now,
            }),
          ),
        }));
        return id;
      },
      addVoice: (dateKey, uri, durationMs) => {
        if (!uri.trim()) return undefined;
        get().ensurePage(dateKey);
        const id = newId('jvoice');
        const now = stamp();
        set((state) => ({
          pages: withPage(state.pages, dateKey, (page) =>
            appendBlock(page, {
              id,
              kind: 'voice',
              uri,
              durationMs: Math.max(0, Math.round(durationMs)),
              createdAt: now,
              updatedAt: now,
            }),
          ),
        }));
        return id;
      },
      addLink: (dateKey, section, label) => {
        const nextSection = section.trim();
        const nextLabel = label.trim();
        if (!nextSection || !nextLabel) return undefined;
        get().ensurePage(dateKey);
        const id = newId('jlink');
        const now = stamp();
        set((state) => ({
          pages: withPage(state.pages, dateKey, (page) =>
            appendBlock(page, {
              id,
              kind: 'link',
              section: nextSection,
              label: nextLabel,
              createdAt: now,
              updatedAt: now,
            }),
          ),
        }));
        return id;
      },
      updateText: (dateKey, blockId, text) => {
        const trimmed = text.trim();
        if (!trimmed) return undefined;
        const page = get().pages.find((entry) => entry.dateKey === dateKey);
        const block = page?.blocks.find((entry) => entry.id === blockId);
        if (!block || block.kind !== 'text' || block.text === trimmed) return undefined;
        const before = block.text;
        set((state) => ({
          pages: writeText(state.pages, dateKey, blockId, trimmed),
          textHistory: {
            ...state.textHistory,
            [dateKey]: pushJournalTextEdit(state.textHistory[dateKey] ?? emptyJournalTextHistory(), {
              blockId,
              before,
              after: trimmed,
            }),
          },
        }));
        return blockId;
      },
      undoText: (dateKey) => {
        const popped = popJournalTextUndo(
          get().textHistory[dateKey] ?? emptyJournalTextHistory(),
        );
        const edit = popped.edit;
        if (!edit) return undefined;
        set((state) => ({
          pages: writeText(state.pages, dateKey, edit.blockId, edit.before),
          textHistory: { ...state.textHistory, [dateKey]: popped.history },
        }));
        return edit.blockId;
      },
      redoText: (dateKey) => {
        const popped = popJournalTextRedo(
          get().textHistory[dateKey] ?? emptyJournalTextHistory(),
        );
        const edit = popped.edit;
        if (!edit) return undefined;
        set((state) => ({
          pages: writeText(state.pages, dateKey, edit.blockId, edit.after),
          textHistory: { ...state.textHistory, [dateKey]: popped.history },
        }));
        return edit.blockId;
      },
      removeBlock: (dateKey, blockId) => {
        const page = get().pages.find((entry) => entry.dateKey === dateKey);
        const block = page?.blocks.find((entry) => entry.id === blockId);
        if (block?.kind === 'voice') void deleteJournalVoice(block.uri);
        set((state) => ({
          pages: withPage(state.pages, dateKey, (entry) => ({
            ...entry,
            blocks: entry.blocks.filter((item) => item.id !== blockId),
            updatedAt: stamp(),
          })),
        }));
      },
      reset: () => set(initialState()),
    }),
    {
      name: STORAGE_KEYS.journal,
      storage: createSensitivePersistStorage(),
      merge: (persistedState, currentState) => {
        const persisted = persistedState as Partial<JournalState>;
        return {
          ...currentState,
          ...persisted,
          version: 1,
          pages: Array.isArray(persisted.pages)
            ? normalizeJournalPages(persisted.pages)
            : [],
          textHistory: currentState.textHistory,
          aiDisclosureAccepted: Boolean(persisted.aiDisclosureAccepted),
        };
      },
      partialize: (state) =>
        ({
          version: state.version,
          aiDisclosureAccepted: state.aiDisclosureAccepted,
          pages: state.pages,
        }) as JournalState,
    },
  ),
);
