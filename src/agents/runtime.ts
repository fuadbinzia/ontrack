import { agentAvailability, createAgentRegistry } from './registry';
import type {
  AgentDefinition,
  AgentProvider,
  AgentRunRequest,
  AgentRunResult,
  AgentRuntimeState,
  AgentTool,
} from './types';

export class AgentRuntimeError extends Error {
  constructor(
    message: string,
    readonly code:
      | 'agent-not-found'
      | 'agent-not-installed'
      | 'agent-disabled'
      | 'agent-unavailable'
      | 'permission-required'
      | 'provider-not-found'
      | 'tool-not-found'
      | 'tool-not-authorized',
  ) {
    super(message);
    this.name = 'AgentRuntimeError';
  }
}

export interface AgentRuntime {
  run: (request: AgentRunRequest, state: AgentRuntimeState) => Promise<AgentRunResult>;
}

export function createAgentRuntime(input: {
  definitions: readonly AgentDefinition[];
  providers: readonly AgentProvider[];
  tools: readonly AgentTool[];
}): AgentRuntime {
  const definitions = createAgentRegistry(input.definitions);
  const providers = new Map(input.providers.map((provider) => [provider.id, provider]));
  const tools = new Map(input.tools.map((tool) => [tool.id, tool]));

  return {
    async run(request, state) {
      const definition = definitions.get(request.agentId);
      if (!definition) {
        throw new AgentRuntimeError('This agent is not in the app catalog.', 'agent-not-found');
      }
      const installation = state.installations[request.agentId];
      if (!installation) {
        throw new AgentRuntimeError('Install this agent before using it.', 'agent-not-installed');
      }
      if (!installation.enabled) {
        throw new AgentRuntimeError('This agent is turned off.', 'agent-disabled');
      }
      if (!agentAvailability(definition, state.entitlements, state.enabledAddons).available) {
        throw new AgentRuntimeError('This agent is not available for this account.', 'agent-unavailable');
      }
      const granted = new Set(installation.grantedCapabilities);
      const missing = definition.requiredCapabilities.filter((capability) => !granted.has(capability));
      if (missing.length > 0) {
        throw new AgentRuntimeError(
          `Required permission not granted: ${missing.join(', ')}`,
          'permission-required',
        );
      }
      const provider = providers.get(definition.providerId);
      if (!provider) {
        throw new AgentRuntimeError('This agent provider is not configured.', 'provider-not-found');
      }
      const declared = new Set([
        ...definition.requiredCapabilities,
        ...(definition.optionalCapabilities ?? []),
      ]);
      const availableTools = [...tools.values()].filter(
        (tool) => declared.has(tool.capability) && granted.has(tool.capability),
      );

      return provider.run({
        definition,
        message: request.message,
        conversationId: request.conversationId,
        tools: availableTools.map(({ id, capability, description, parameters }) =>
          parameters
            ? { id, capability, description, parameters }
            : { id, capability, description },
        ),
        callTool: async (toolId, toolInput) => {
          const tool = tools.get(toolId);
          if (!tool) {
            throw new AgentRuntimeError(`Unknown tool: ${toolId}`, 'tool-not-found');
          }
          if (!declared.has(tool.capability) || !granted.has(tool.capability)) {
            throw new AgentRuntimeError(
              `The agent cannot use ${toolId}.`,
              'tool-not-authorized',
            );
          }
          return tool.execute(toolInput, {
            agentId: definition.id,
            conversationId: request.conversationId,
          });
        },
      });
    },
  };
}
