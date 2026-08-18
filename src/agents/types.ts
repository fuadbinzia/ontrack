import type { AddonEnabledState, AddonId } from '@/addons/types';
import type { EntitlementState } from '@/entitlements/types';
import type { AppIconName } from '@/design-system';

export type AgentId = string;
export type AgentProviderId = string;
export type AgentDomain = 'calendar' | 'profile' | 'todos' | 'shell' | AddonId;
export type AgentCapabilityAction = 'read' | 'write' | 'search' | 'act';
export type AgentCapabilityId = `${AgentDomain}.${AgentCapabilityAction}`;

export interface AgentCapabilityDefinition {
  id: AgentCapabilityId;
  name: string;
  description: string;
  sensitive?: boolean;
}

/**
 * Static metadata only. Agent prompts, providers, and tools stay outside the
 * manifest so the app shell never imports feature implementation details.
 */
export interface AgentDefinition {
  id: AgentId;
  version: number;
  name: string;
  description: string;
  icon: AppIconName;
  providerId: AgentProviderId;
  access: 'included' | 'paid';
  requiredAddonId?: AddonId;
  requiredCapabilities: readonly AgentCapabilityId[];
  optionalCapabilities?: readonly AgentCapabilityId[];
}

export interface AgentInstallation {
  agentId: AgentId;
  version: number;
  enabled: boolean;
  grantedCapabilities: AgentCapabilityId[];
  installedAt: string;
  updatedAt: string;
}

export type AgentInstallations = Record<AgentId, AgentInstallation>;
export type AgentEntitlementState = EntitlementState<AgentId>;

export interface AgentMessage {
  id: string;
  role: 'user' | 'agent' | 'system';
  text: string;
  createdAt: string;
}

export interface AgentConversation {
  id: string;
  agentId: AgentId;
  title: string;
  messages: AgentMessage[];
  createdAt: string;
  updatedAt: string;
}

export type AgentConversations = Record<string, AgentConversation>;

export interface AgentAvailability {
  available: boolean;
  reason?: 'not-entitled' | 'required-addon-disabled';
}

export interface AgentRunRequest {
  agentId: AgentId;
  message: string;
  conversationId?: string;
}

export interface AgentRunResult {
  text: string;
  metadata?: Record<string, unknown>;
}

export interface AgentRuntimeState {
  installations: AgentInstallations;
  entitlements: AgentEntitlementState;
  enabledAddons: AddonEnabledState;
}

export interface AgentToolContext {
  agentId: AgentId;
  conversationId?: string;
}

export interface AgentTool {
  id: string;
  capability: AgentCapabilityId;
  description: string;
  /** JSON Schema object for LLM tool-calling. Kept off the catalog manifest. */
  parameters?: Record<string, unknown>;
  execute: (input: unknown, context: AgentToolContext) => Promise<unknown>;
}

export interface AgentProviderRequest {
  definition: AgentDefinition;
  message: string;
  conversationId?: string;
  tools: readonly Pick<AgentTool, 'id' | 'capability' | 'description' | 'parameters'>[];
  callTool: (toolId: string, input: unknown) => Promise<unknown>;
}

export interface AgentProvider {
  id: AgentProviderId;
  run: (request: AgentProviderRequest) => Promise<AgentRunResult>;
}
