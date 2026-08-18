import { createAgentRuntime } from '@/agents/runtime';
import { ONTRACK_COMPANION, ONTRACK_COMPANION_ID } from '@/agents/registry';
import type { AgentProvider, AgentRunResult } from '@/agents/types';
import { useAddons } from '@/store/addons';
import { useAgents } from '@/store/agents';
import { newId } from '@/utils/id';

import { redactToolResult } from './companion-redact';
import { companionTools } from './companion-tools';
import { ensureCompanionReady } from './ensure-companion';
import { requestAgentRun } from '@/services/agents/run-client';
import type { AgentRunToolCall } from '@/services/agents/run-types';

const MAX_ROUNDS = 6;
const SIGNED_IN_COMPANION_TITLE = 'Search';
const GUEST_COMPANION_TITLE = 'Search (Guest)';
const GUEST_COMPANION_CONVERSATION_ID = 'aconvo-search-guest';

export function companionConversationTitle(isGuest: boolean): string {
  return isGuest ? GUEST_COMPANION_TITLE : SIGNED_IN_COMPANION_TITLE;
}

function findCompanionConversation(isGuest: boolean) {
  const title = companionConversationTitle(isGuest);
  return Object.values(useAgents.getState().conversations).find((item) => {
    if (item.agentId !== ONTRACK_COMPANION_ID) return false;
    if (isGuest) {
      return item.id === GUEST_COMPANION_CONVERSATION_ID || item.title === GUEST_COMPANION_TITLE;
    }
    return item.id !== GUEST_COMPANION_CONVERSATION_ID && item.title === title;
  });
}

function spokenFromResult(value: unknown): string | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const spoken = (value as { spoken?: unknown }).spoken;
  return typeof spoken === 'string' && spoken.trim() ? spoken.trim() : undefined;
}

export function createCompanionProvider(): AgentProvider {
  return {
    id: 'ontrack-companion',
    async run(request) {
      const history: { role: 'user' | 'assistant'; text: string }[] = [];
      const tools = request.tools.map((tool) => ({
        id: tool.id,
        description: tool.description,
        parameters: tool.parameters,
      }));
      let message: string | undefined = request.message;
      let pendingCalls: AgentRunToolCall[] | undefined;
      let toolResults: { id: string; name: string; result: unknown }[] | undefined;
      let lastSpoken = '';

      for (let round = 0; round < MAX_ROUNDS; round += 1) {
        const turn = await requestAgentRun({
          message,
          history,
          tools,
          pendingCalls,
          toolResults,
        });
        message = undefined;
        pendingCalls = undefined;
        toolResults = undefined;
        if (turn.type === 'text') {
          const text = turn.text.trim() || lastSpoken || 'Done.';
          return { text };
        }
        const results: { id: string; name: string; result: unknown }[] = [];
        for (const call of turn.calls) {
          const raw = await request.callTool(call.name, call.arguments);
          const spoken = spokenFromResult(raw);
          if (spoken) lastSpoken = spoken;
          results.push({
            id: call.id,
            name: call.name,
            result: redactToolResult(raw),
          });
        }
        pendingCalls = turn.calls;
        toolResults = results;
        if (request.message && history.length === 0) {
          history.push({ role: 'user', text: request.message });
        }
      }
      return { text: lastSpoken || 'Done.' };
    },
  };
}

export async function runCompanionMessage(
  message: string,
  options: { isGuest?: boolean } = {},
): Promise<AgentRunResult> {
  ensureCompanionReady();
  const isGuest = Boolean(options.isGuest);
  const agents = useAgents.getState();
  let conversation = findCompanionConversation(isGuest);
  if (!conversation) {
    const now = new Date().toISOString();
    conversation = {
      id: isGuest ? GUEST_COMPANION_CONVERSATION_ID : newId('aconvo'),
      agentId: ONTRACK_COMPANION_ID,
      title: companionConversationTitle(isGuest),
      messages: [],
      createdAt: now,
      updatedAt: now,
    };
    agents.saveConversation(conversation);
  }
  agents.appendMessage(conversation.id, {
    id: newId('amsg'),
    role: 'user',
    text: message,
    createdAt: new Date().toISOString(),
  });
  const runtime = createAgentRuntime({
    definitions: [ONTRACK_COMPANION],
    providers: [createCompanionProvider()],
    tools: companionTools,
  });
  const result = await runtime.run(
    {
      agentId: ONTRACK_COMPANION_ID,
      message,
      conversationId: conversation.id,
    },
    {
      installations: useAgents.getState().installations,
      entitlements: useAgents.getState().entitlements,
      enabledAddons: useAddons.getState().enabled,
    },
  );
  useAgents.getState().appendMessage(conversation.id, {
    id: newId('amsg'),
    role: 'agent',
    text: result.text,
    createdAt: new Date().toISOString(),
  });
  return result;
}
