import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import { createPersistStorage, STORAGE_KEYS } from '@/services/storage';
import { newUuid } from '@/utils/id';

export interface SavedEzPassStatement {
  id: string;
  name: string;
  uris: string[];
  importedAt: string;
}

type FinanceEzPassStatementsState = {
  statements: SavedEzPassStatement[];
  saveStatement: (input: Omit<SavedEzPassStatement, 'id' | 'importedAt'>) => void;
  reset: () => void;
};

function normalizedStatements(value: unknown): SavedEzPassStatement[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    if (!entry || typeof entry !== 'object') return [];
    const raw = entry as Partial<SavedEzPassStatement>;
    if (
      typeof raw.id !== 'string' ||
      typeof raw.name !== 'string' ||
      typeof raw.importedAt !== 'string' ||
      !Array.isArray(raw.uris)
    ) return [];
    const uris = raw.uris.filter((uri): uri is string => typeof uri === 'string' && uri.length > 0);
    return uris.length ? [{ id: raw.id, name: raw.name, importedAt: raw.importedAt, uris }] : [];
  }).slice(0, 20);
}

export const useFinanceEzPassStatements = create<FinanceEzPassStatementsState>()(
  persist(
    (set) => ({
      statements: [],
      saveStatement: (input) => set((state) => ({
        statements: [{
          ...input,
          id: newUuid(),
          importedAt: new Date().toISOString(),
        }, ...state.statements].slice(0, 20),
      })),
      reset: () => set({ statements: [] }),
    }),
    {
      name: STORAGE_KEYS.financeEzPassStatements,
      storage: createPersistStorage(),
      merge: (persistedState, currentState) => ({
        ...currentState,
        statements: normalizedStatements(
          (persistedState as Partial<FinanceEzPassStatementsState> | undefined)?.statements,
        ),
      }),
    },
  ),
);
