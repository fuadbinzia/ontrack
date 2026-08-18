import mockAsyncStorage from '@react-native-async-storage/async-storage/jest/async-storage-mock';

import { ALL_ADDONS_ON } from '@/addons/registry';
import { ONTRACK_COMPANION, ONTRACK_COMPANION_ID } from '@/agents/registry';
import { useAddons } from '@/store/addons';
import { useAgents } from '@/store/agents';

import {
  companionConversationTitle,
  createCompanionProvider,
  runCompanionMessage,
} from '../companion-runtime';

const mockRequestAgentRun = jest.fn();

jest.mock('@react-native-async-storage/async-storage', () => mockAsyncStorage);

jest.mock('@/services/agents/run-client', () => ({
  requestAgentRun: (...args: unknown[]) => mockRequestAgentRun(...args),
}));

describe('runCompanionMessage conversations', () => {
  beforeEach(() => {
    useAgents.getState().reset();
    useAddons.getState().replaceEnabled(ALL_ADDONS_ON);
    mockRequestAgentRun.mockReset();
    mockRequestAgentRun.mockResolvedValue({ type: 'text', text: 'Opened Plants.' });
  });

  it('keeps guest and signed-in companion threads distinct', async () => {
    await runCompanionMessage('Open plants', { isGuest: true });
    await runCompanionMessage('Open finance', { isGuest: false });

    const conversations = Object.values(useAgents.getState().conversations).filter(
      (item) => item.agentId === ONTRACK_COMPANION_ID,
    );
    const guest = conversations.find((item) => item.title === companionConversationTitle(true));
    const signedIn = conversations.find((item) => item.title === companionConversationTitle(false));

    expect(guest?.id).toBe('aconvo-search-guest');
    expect(signedIn?.id).not.toBe(guest?.id);
    expect(guest?.messages.map((message) => message.text)).toEqual([
      'Open plants',
      'Opened Plants.',
    ]);
    expect(signedIn?.messages.map((message) => message.text)).toEqual([
      'Open finance',
      'Opened Plants.',
    ]);
  });

  it('reuses the guest conversation on later guest asks', async () => {
    await runCompanionMessage('First', { isGuest: true });
    await runCompanionMessage('Second', { isGuest: true });

    const guests = Object.values(useAgents.getState().conversations).filter(
      (item) => item.title === companionConversationTitle(true),
    );
    expect(guests).toHaveLength(1);
    expect(guests[0]?.messages.filter((message) => message.role === 'user').map((message) => message.text)).toEqual([
      'First',
      'Second',
    ]);
  });

  it('does not continue a guest thread after sign-in', async () => {
    await runCompanionMessage('Guest ask', { isGuest: true });
    await runCompanionMessage('Account ask', { isGuest: false });

    const signedIn = Object.values(useAgents.getState().conversations).find(
      (item) => item.title === companionConversationTitle(false),
    );
    expect(signedIn?.messages.some((message) => message.text === 'Guest ask')).toBe(false);
  });
});

describe('createCompanionProvider tool results', () => {
  beforeEach(() => {
    mockRequestAgentRun.mockReset();
  });

  it('does not redact calendar dates before sending get_today results to the model', async () => {
    mockRequestAgentRun
      .mockResolvedValueOnce({
        type: 'tool_calls',
        calls: [{ id: 'call-1', name: 'get_today', arguments: {} }],
      })
      .mockResolvedValueOnce({ type: 'text', text: 'Today is Monday, August 17, 2026.' });

    await createCompanionProvider().run({
      definition: ONTRACK_COMPANION,
      message: 'What day is it',
      tools: [{ id: 'get_today', capability: 'calendar.read', description: 'today' }],
      callTool: async () => ({
        date: '2026-08-17',
        spoken: 'Today is Monday, August 17, 2026.',
        activities: [],
      }),
    });

    const followUp = mockRequestAgentRun.mock.calls[1]?.[0] as {
      toolResults: { result: { date: string; spoken: string } }[];
    };
    expect(followUp.toolResults[0]?.result.date).toBe('2026-08-17');
    expect(followUp.toolResults[0]?.result.spoken).toBe('Today is Monday, August 17, 2026.');
    expect(JSON.stringify(followUp.toolResults)).not.toContain('[redacted]');
  });
});
