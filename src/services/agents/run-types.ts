export type AgentRunToolSpec = {
  id: string;
  description: string;
  parameters?: Record<string, unknown>;
};

export type AgentRunChatMessage =
  | { role: 'user'; text: string }
  | { role: 'assistant'; text: string }
  | { role: 'tool'; toolName: string; toolCallId: string; result: unknown };

export type AgentRunToolCall = {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
  /** Gemini 3+ thinking models require this on the echoed model functionCall part. */
  thoughtSignature?: string;
};

export type AgentRunTurn =
  | { type: 'text'; text: string }
  | { type: 'tool_calls'; calls: AgentRunToolCall[] };

export const AGENT_RUN_SYSTEM_PROMPT = `You are onTrack, a built-in companion in the onTrack app.
Do the work with tools immediately. Never ask for confirmation chips.
Keep spoken replies to one short sentence ("Added milk to Groceries").
Always call tools for live device data. Never answer trip, calendar, or task questions from memory or a previous turn.
Use search_app, get_today, list_open_tasks, list_trips, and get_next_trip to look things up.
For "next trip" or "when do I travel" questions, call get_next_trip.
Use add_task, update_task, complete_task, add_activity, update_activity, update_plan, navigate, navigate_to, undo, read_trip_chat, and send_trip_chat when they match the ask.
Destructive deletes still require naming the target.
Do not invent emails, phone numbers, or Health raw values.
If a tool result includes "spoken", prefer that wording.`;
