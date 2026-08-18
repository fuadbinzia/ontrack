import { create } from 'zustand';

import { newId } from '@/utils/id';

export type DockTranscriptRole = 'user' | 'agent' | 'system';

export interface DockTranscriptTurn {
  id: string;
  role: DockTranscriptRole;
  text: string;
}

interface DockSearchState {
  expanded: boolean;
  listenOnExpand: boolean;
  listening: boolean;
  listenStartedAt: number | null;
  micGeneration: number;
  stopGeneration: number;
  query: string;
  /** Measured expanded search field height; 0 until the field reports. */
  fieldHeight: number;
  transcript: DockTranscriptTurn[];
  expand: (options?: { listen?: boolean }) => void;
  collapse: () => void;
  requestMic: () => void;
  requestStop: () => void;
  setListening: (listening: boolean, startedAt?: number | null) => void;
  setQuery: (query: string) => void;
  setFieldHeight: (fieldHeight: number) => void;
  appendTranscript: (role: DockTranscriptRole, text: string) => void;
  clearTranscript: () => void;
  clearListenOnExpand: () => void;
  resetForTests: () => void;
}

const idleListen = {
  listening: false,
  listenStartedAt: null as number | null,
};

export const useDockSearch = create<DockSearchState>((set) => ({
  expanded: false,
  listenOnExpand: false,
  ...idleListen,
  micGeneration: 0,
  stopGeneration: 0,
  query: '',
  fieldHeight: 0,
  transcript: [],
  expand: (options) =>
    set({
      expanded: true,
      listenOnExpand: options?.listen === true,
    }),
  collapse: () =>
    set({
      expanded: false,
      listenOnExpand: false,
      query: '',
      fieldHeight: 0,
      ...idleListen,
    }),
  requestMic: () =>
    set((state) => ({
      expanded: true,
      listenOnExpand: true,
      micGeneration: state.micGeneration + 1,
    })),
  requestStop: () =>
    set((state) => ({
      stopGeneration: state.stopGeneration + 1,
    })),
  setListening: (listening, startedAt) =>
    set({
      listening,
      listenStartedAt: listening ? (startedAt ?? Date.now()) : null,
    }),
  setQuery: (query) => set({ query }),
  setFieldHeight: (fieldHeight) =>
    set((state) => (state.fieldHeight === fieldHeight ? state : { fieldHeight })),
  appendTranscript: (role, text) =>
    set((state) => ({
      transcript: [
        ...state.transcript,
        { id: newId('dock'), role, text },
      ].slice(-40),
    })),
  clearTranscript: () => set({ transcript: [] }),
  clearListenOnExpand: () => set({ listenOnExpand: false }),
  resetForTests: () =>
    set({
      expanded: false,
      listenOnExpand: false,
      ...idleListen,
      micGeneration: 0,
      stopGeneration: 0,
      query: '',
      fieldHeight: 0,
      transcript: [],
    }),
}));
