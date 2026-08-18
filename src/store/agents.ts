import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import { defaultAgentEntitlements, getAgent } from '@/agents/registry';
import type {
  AgentCapabilityId,
  AgentConversation,
  AgentConversations,
  AgentEntitlementState,
  AgentId,
  AgentInstallations,
  AgentMessage,
} from '@/agents/types';
import { createPersistStorage, STORAGE_KEYS } from '@/services/storage';

interface AgentState {
  installations: AgentInstallations;
  conversations: AgentConversations;
  entitlements: AgentEntitlementState;
  updatedAt: string;
  installAgent: (id: AgentId) => void;
  ensureAgentReady: (id: AgentId, capabilities: readonly AgentCapabilityId[]) => void;
  removeAgent: (id: AgentId) => void;
  setAgentEnabled: (id: AgentId, enabled: boolean) => void;
  setCapabilityGranted: (id: AgentId, capability: AgentCapabilityId, granted: boolean) => void;
  saveConversation: (conversation: AgentConversation) => void;
  appendMessage: (conversationId: string, message: AgentMessage) => void;
  removeConversation: (conversationId: string) => void;
  replaceAgentData: (
    installations: AgentInstallations,
    conversations: AgentConversations,
    updatedAt?: string,
  ) => void;
  replaceEntitlements: (entitlements: AgentEntitlementState) => void;
  reset: () => void;
}

function timestamp() {
  return new Date().toISOString();
}

export const useAgents = create<AgentState>()(
  persist(
    (set) => ({
      installations: {},
      conversations: {},
      entitlements: defaultAgentEntitlements(),
      updatedAt: timestamp(),
      installAgent: (id) =>
        set((state) => {
          const definition = getAgent(id);
          if (!definition || !state.entitlements[id]?.active || state.installations[id]) return state;
          const now = timestamp();
          return {
            installations: {
              ...state.installations,
              [id]: {
                agentId: id,
                version: definition.version,
                enabled: false,
                grantedCapabilities: [],
                installedAt: now,
                updatedAt: now,
              },
            },
            updatedAt: now,
          };
        }),
      ensureAgentReady: (id, capabilities) =>
        set((state) => {
          const definition = getAgent(id);
          if (!definition || !state.entitlements[id]?.active) return state;
          const declared = new Set([
            ...definition.requiredCapabilities,
            ...(definition.optionalCapabilities ?? []),
          ]);
          const granted = [
            ...new Set(
              capabilities.filter((capability) => declared.has(capability)),
            ),
          ];
          const missingRequired = definition.requiredCapabilities.some(
            (capability) => !granted.includes(capability),
          );
          if (missingRequired) return state;
          const now = timestamp();
          const existing = state.installations[id];
          return {
            installations: {
              ...state.installations,
              [id]: {
                agentId: id,
                version: definition.version,
                enabled: true,
                grantedCapabilities: granted,
                installedAt: existing?.installedAt ?? now,
                updatedAt: now,
              },
            },
            updatedAt: now,
          };
        }),
      removeAgent: (id) =>
        set((state) => {
          if (!state.installations[id]) return state;
          const installations = { ...state.installations };
          delete installations[id];
          const conversations = Object.fromEntries(
            Object.entries(state.conversations).filter(([, item]) => item.agentId !== id),
          );
          return { installations, conversations, updatedAt: timestamp() };
        }),
      setAgentEnabled: (id, enabled) =>
        set((state) => {
          const definition = getAgent(id);
          const installation = state.installations[id];
          if (!definition || !installation || !state.entitlements[id]?.active) return state;
          if (
            enabled &&
            definition.requiredCapabilities.some(
              (capability) => !installation.grantedCapabilities.includes(capability),
            )
          ) {
            return state;
          }
          const now = timestamp();
          return {
            installations: {
              ...state.installations,
              [id]: { ...installation, enabled, updatedAt: now },
            },
            updatedAt: now,
          };
        }),
      setCapabilityGranted: (id, capability, granted) =>
        set((state) => {
          const definition = getAgent(id);
          const installation = state.installations[id];
          const declared = definition
            ? [...definition.requiredCapabilities, ...(definition.optionalCapabilities ?? [])]
            : [];
          if (!definition || !installation || !declared.includes(capability)) return state;
          const capabilities = new Set(installation.grantedCapabilities);
          if (granted) capabilities.add(capability);
          else capabilities.delete(capability);
          const now = timestamp();
          return {
            installations: {
              ...state.installations,
              [id]: {
                ...installation,
                enabled: granted ? installation.enabled : false,
                grantedCapabilities: [...capabilities],
                updatedAt: now,
              },
            },
            updatedAt: now,
          };
        }),
      saveConversation: (conversation) =>
        set((state) => ({
          conversations: { ...state.conversations, [conversation.id]: conversation },
          updatedAt: timestamp(),
        })),
      appendMessage: (conversationId, message) =>
        set((state) => {
          const conversation = state.conversations[conversationId];
          if (!conversation) return state;
          const now = timestamp();
          return {
            conversations: {
              ...state.conversations,
              [conversationId]: {
                ...conversation,
                messages: [...conversation.messages, message],
                updatedAt: now,
              },
            },
            updatedAt: now,
          };
        }),
      removeConversation: (conversationId) =>
        set((state) => {
          if (!state.conversations[conversationId]) return state;
          const conversations = { ...state.conversations };
          delete conversations[conversationId];
          return { conversations, updatedAt: timestamp() };
        }),
      replaceAgentData: (installations, conversations, updatedAt = timestamp()) =>
        set({ installations, conversations, updatedAt }),
      replaceEntitlements: (entitlements) =>
        set((state) => ({
          entitlements,
          installations: Object.fromEntries(
            Object.entries(state.installations).map(([id, installation]) => [
              id,
              entitlements[id]?.active ? installation : { ...installation, enabled: false },
            ]),
          ),
        })),
      reset: () =>
        set({
          installations: {},
          conversations: {},
          entitlements: defaultAgentEntitlements(),
          updatedAt: timestamp(),
        }),
    }),
    {
      name: STORAGE_KEYS.agents,
      storage: createPersistStorage(),
      merge: (persistedState, currentState) => {
        const persisted = persistedState as Partial<AgentState>;
        return {
          ...currentState,
          ...persisted,
          installations: persisted.installations ?? {},
          conversations: persisted.conversations ?? {},
          entitlements: defaultAgentEntitlements(),
        };
      },
      partialize: (state) =>
        ({
          installations: state.installations,
          conversations: state.conversations,
          updatedAt: state.updatedAt,
        }) as AgentState,
    },
  ),
);
