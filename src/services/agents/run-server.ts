import { fetchOpenAIResponses, openAIResponseText } from '@/services/ai/vision-transport';
import { guardedFetch } from '@/services/http/dependency-guard';

import {
  AGENT_RUN_SYSTEM_PROMPT,
  type AgentRunToolCall,
  type AgentRunToolSpec,
  type AgentRunTurn,
} from './run-types';

const DEFAULT_GEMINI_MODEL = 'gemini-flash-lite-latest';
const FETCH_LIMITS = { timeoutMs: 45_000, maxConcurrency: 2 };
const MAX_TEXT = 2_000;
let toolCallSeq = 0;

function nextToolCallId(): string {
  toolCallSeq += 1;
  return `tool-${toolCallSeq}`;
}

export type AgentRunInput = {
  message?: string;
  history?: { role: 'user' | 'assistant'; text: string }[];
  tools: AgentRunToolSpec[];
  pendingCalls?: AgentRunToolCall[];
  toolResults?: { id: string; name: string; result: unknown }[];
};

function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

export function parseAgentRunInput(value: unknown): AgentRunInput | null {
  const record = asObject(value);
  if (!Array.isArray(record.tools)) return null;
  const tools = record.tools.flatMap((item) => {
    const tool = asObject(item);
    const id = asString(tool.id);
    const description = asString(tool.description);
    if (!id || !description) return [];
    return [
      {
        id,
        description,
        parameters: asObject(tool.parameters),
      },
    ];
  });
  if (tools.length === 0 && !asString(record.message)) return null;
  const history = Array.isArray(record.history)
    ? record.history.flatMap((item) => {
        const row = asObject(item);
        const role: 'user' | 'assistant' | null =
          row.role === 'assistant' ? 'assistant' : row.role === 'user' ? 'user' : null;
        const text = asString(row.text);
        return role && text ? [{ role, text }] : [];
      })
    : [];
  const pendingCalls = Array.isArray(record.pendingCalls)
    ? record.pendingCalls.flatMap((item) => {
        const row = asObject(item);
        const name = asString(row.name);
        if (!name) return [];
        const thoughtSignature = asString(row.thoughtSignature);
        return [
          {
            id: asString(row.id) || name,
            name,
            arguments: asObject(row.arguments),
            ...(thoughtSignature ? { thoughtSignature } : {}),
          },
        ];
      })
    : [];
  const toolResults = Array.isArray(record.toolResults)
    ? record.toolResults.flatMap((item) => {
        const row = asObject(item);
        const name = asString(row.name);
        if (!name) return [];
        return [{ id: asString(row.id) || name, name, result: row.result }];
      })
    : [];
  return {
    message: asString(record.message) || undefined,
    history,
    tools,
    pendingCalls,
    toolResults,
  };
}

/** Gemini function-calling rejects JSON Schema fields such as additionalProperties. */
export function geminiToolParameters(value: unknown): Record<string, unknown> {
  const record = asObject(value);
  const out: Record<string, unknown> = {};
  for (const [key, nested] of Object.entries(record)) {
    if (key === 'additionalProperties') continue;
    if (key === 'properties' && nested && typeof nested === 'object' && !Array.isArray(nested)) {
      out.properties = Object.fromEntries(
        Object.entries(nested as Record<string, unknown>).map(([name, schema]) => [
          name,
          geminiToolParameters(schema),
        ]),
      );
      continue;
    }
    out[key] = nested;
  }
  if ((out.type === 'object' || out.type == null) && out.properties == null) {
    out.type = 'object';
    out.properties = {};
  }
  return out;
}

export function geminiDeclarations(tools: AgentRunToolSpec[]) {
  return tools.map((tool) => ({
    name: tool.id,
    description: tool.description,
    parameters: geminiToolParameters(tool.parameters ?? { type: 'object' }),
  }));
}

export function parseGeminiTurn(body: unknown): AgentRunTurn {
  const record = asObject(body);
  const candidates = Array.isArray(record.candidates) ? record.candidates : [];
  const content = asObject(asObject(candidates[0]).content);
  const parts = Array.isArray(content.parts) ? content.parts : [];
  const calls: AgentRunToolCall[] = [];
  const texts: string[] = [];
  let pendingThought: string | undefined;
  for (const part of parts) {
    const row = asObject(part);
    const signature = asString(row.thoughtSignature);
    const fn = asObject(row.functionCall);
    const name = asString(fn.name);
    if (name) {
      const thoughtSignature = signature || asString(fn.thoughtSignature) || pendingThought;
      pendingThought = undefined;
      calls.push({
        id: nextToolCallId(),
        name,
        arguments: asObject(fn.args ?? fn.arguments),
        ...(thoughtSignature ? { thoughtSignature } : {}),
      });
      continue;
    }
    if (signature) pendingThought = signature;
    if (typeof row.text === 'string' && row.text.trim()) texts.push(row.text.trim());
  }
  if (calls.length) return { type: 'tool_calls', calls };
  return { type: 'text', text: texts.join('\n').slice(0, MAX_TEXT) };
}

export function geminiModelPartsFromCalls(calls: AgentRunToolCall[]): Record<string, unknown>[] {
  return calls.map((call) => {
    const part: Record<string, unknown> = {
      functionCall: { name: call.name, args: call.arguments },
    };
    if (call.thoughtSignature) part.thoughtSignature = call.thoughtSignature;
    return part;
  });
}

async function runGemini(input: AgentRunInput): Promise<AgentRunTurn> {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) throw new Error('NOT_CONFIGURED');
  const model =
    process.env.AGENTS_GEMINI_MODEL?.trim() ||
    process.env.JOURNAL_GEMINI_MODEL?.trim() ||
    DEFAULT_GEMINI_MODEL;
  const contents: Record<string, unknown>[] = [];
  for (const turn of input.history ?? []) {
    contents.push({
      role: turn.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: turn.text }],
    });
  }
  if (input.message) {
    contents.push({ role: 'user', parts: [{ text: input.message }] });
  }
  if (input.pendingCalls?.length) {
    contents.push({
      role: 'model',
      parts: geminiModelPartsFromCalls(input.pendingCalls),
    });
    contents.push({
      role: 'user',
      parts: (input.toolResults ?? []).map((result) => ({
        functionResponse: {
          name: result.name,
          response: { result: result.result },
        },
      })),
    });
  }
  const response = await guardedFetch(
    'gemini-journal',
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey,
      },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: AGENT_RUN_SYSTEM_PROMPT }] },
        contents,
        tools: [{ functionDeclarations: geminiDeclarations(input.tools) }],
        generationConfig: { temperature: 0.2 },
      }),
    },
    FETCH_LIMITS,
  );
  if (!response.ok) {
    const detail = (await response.text().catch(() => '')).slice(0, 400);
    console.warn(`[agents.run] gemini ${response.status}${detail ? `: ${detail}` : ''}`);
    throw new Error('PROVIDER_FAILURE');
  }
  return parseGeminiTurn(await response.json());
}

function parseOpenAITurn(body: Record<string, unknown>): AgentRunTurn {
  const output = Array.isArray(body.output) ? body.output : [];
  const calls: AgentRunToolCall[] = [];
  for (const item of output) {
    const row = asObject(item);
    if (row.type === 'function_call' || row.type === 'tool_call') {
      const name = asString(row.name);
      if (!name) continue;
      let args: Record<string, unknown> = {};
      if (typeof row.arguments === 'string') {
        try {
          args = asObject(JSON.parse(row.arguments));
        } catch {
          args = {};
        }
      } else {
        args = asObject(row.arguments);
      }
      calls.push({
        id: asString(row.call_id) || asString(row.id) || nextToolCallId(),
        name,
        arguments: args,
      });
    }
  }
  if (calls.length) return { type: 'tool_calls', calls };
  return { type: 'text', text: (openAIResponseText(body) ?? '').trim().slice(0, MAX_TEXT) };
}

async function runOpenAI(input: AgentRunInput): Promise<AgentRunTurn> {
  if (!process.env.OPENAI_API_KEY?.trim()) throw new Error('NOT_CONFIGURED');
  const inputItems: Record<string, unknown>[] = [
    { role: 'system', content: AGENT_RUN_SYSTEM_PROMPT },
  ];
  for (const turn of input.history ?? []) {
    inputItems.push({ role: turn.role, content: turn.text });
  }
  if (input.message) inputItems.push({ role: 'user', content: input.message });
  for (const result of input.toolResults ?? []) {
    inputItems.push({
      type: 'function_call_output',
      call_id: result.id,
      output: JSON.stringify(result.result ?? {}),
    });
  }
  const body = await fetchOpenAIResponses({
    model: process.env.AGENTS_OPENAI_MODEL?.trim() || 'gpt-4.1-mini',
    safetyIdentifier: 'ontrack-companion',
    payload: {
      input: inputItems,
      tools: input.tools.map((tool) => ({
        type: 'function',
        name: tool.id,
        description: tool.description,
        parameters: tool.parameters ?? { type: 'object', properties: {} },
      })),
    },
    timeoutMs: 45_000,
  });
  return parseOpenAITurn(body);
}

export function agentRunProvider(): 'gemini' | 'openai' | undefined {
  if (process.env.GEMINI_API_KEY?.trim()) return 'gemini';
  if (process.env.OPENAI_API_KEY?.trim()) return 'openai';
  return undefined;
}

export async function runAgentTurn(input: AgentRunInput): Promise<AgentRunTurn> {
  const provider = agentRunProvider();
  if (!provider) throw new Error('NOT_CONFIGURED');
  return provider === 'gemini' ? runGemini(input) : runOpenAI(input);
}
