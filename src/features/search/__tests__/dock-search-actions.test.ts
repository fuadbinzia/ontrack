import { AgentRunError } from '@/services/agents/run-client';

import { sendDockMessage } from '../dock-search-actions';
import { useDockSearch } from '../dock-search-store';

const mockRunCompanionMessage = jest.fn();

jest.mock('../companion-runtime', () => ({
  runCompanionMessage: (...args: unknown[]) => mockRunCompanionMessage(...args),
}));

jest.mock('../ensure-companion', () => ({
  ensureCompanionReady: jest.fn(() => true),
}));

describe('sendDockMessage', () => {
  beforeEach(() => {
    useDockSearch.getState().resetForTests();
    useDockSearch.getState().setQuery('Open plants');
    mockRunCompanionMessage.mockReset();
  });

  it('does not reject when the companion is not configured', async () => {
    mockRunCompanionMessage.mockRejectedValue(
      new AgentRunError('onTrack companion is not configured.', 'NOT_CONFIGURED', 503),
    );

    await expect(
      sendDockMessage('Open plants', { signedIn: true, aiEnabled: true }),
    ).resolves.toBe('onTrack is temporarily unavailable. Search still works.');

    const state = useDockSearch.getState();
    expect(state.query).toBe('Open plants');
    expect(state.transcript.map((turn) => turn.role)).toEqual(['user', 'system']);
    expect(state.transcript[1]?.text).not.toMatch(/not configured/i);
  });

  it('lets guests ask onTrack when AI is on', async () => {
    mockRunCompanionMessage.mockResolvedValue({ text: 'Opened Plants.' });
    await expect(
      sendDockMessage('plants', { signedIn: false, aiEnabled: true }),
    ).resolves.toBe('Opened Plants.');
    expect(mockRunCompanionMessage).toHaveBeenCalledWith('plants', { isGuest: true });
    const state = useDockSearch.getState();
    expect(state.query).toBe('');
    expect(state.transcript.map((turn) => [turn.role, turn.text])).toEqual([
      ['user', 'plants'],
      ['agent', 'Opened Plants.'],
    ]);
  });

  it('keeps typed search when AI is off', async () => {
    const reply = await sendDockMessage('plants', { signedIn: true, aiEnabled: false });
    expect(reply).toBe('AI is off in Preferences. Search still works.');
    expect(mockRunCompanionMessage).not.toHaveBeenCalled();
    expect(useDockSearch.getState().query).toBe('plants');
  });

  it('still blocks guests when AI is off', async () => {
    const reply = await sendDockMessage('plants', { signedIn: false, aiEnabled: false });
    expect(reply).toBe('AI is off in Preferences. Search still works.');
    expect(mockRunCompanionMessage).not.toHaveBeenCalled();
    expect(useDockSearch.getState().query).toBe('plants');
  });

  it('clears the field after a successful companion reply', async () => {
    mockRunCompanionMessage.mockResolvedValue({ text: 'Opened Plants.' });
    await expect(
      sendDockMessage('Open plants', { signedIn: true, aiEnabled: true }),
    ).resolves.toBe('Opened Plants.');
    expect(mockRunCompanionMessage).toHaveBeenCalledWith('Open plants', { isGuest: false });
    const state = useDockSearch.getState();
    expect(state.query).toBe('');
    expect(state.transcript.map((turn) => [turn.role, turn.text])).toEqual([
      ['user', 'Open plants'],
      ['agent', 'Opened Plants.'],
    ]);
  });

  it('ignores blank sends', async () => {
    await expect(sendDockMessage('   ', { signedIn: true, aiEnabled: true })).resolves.toBe('');
    expect(mockRunCompanionMessage).not.toHaveBeenCalled();
    expect(useDockSearch.getState().transcript).toEqual([]);
  });
});
