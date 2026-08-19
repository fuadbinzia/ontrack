import { DEFAULT_EMOTIONS } from '../defaults';
import { averageMetric, playbookOutcomeSummary } from '../model';
import type { MoodEntry, MoodPlaybook, MoodPlaybookRun } from '../types';

describe('health model', () => {
  it('averages only known metric values', () => {
    expect(averageMetric([
      { dateKey: '2026-08-01', steps: 1000 },
      { dateKey: '2026-08-02' },
      { dateKey: '2026-08-03', steps: 3000 },
    ], 'steps')).toBe(2000);
  });

  it('uses observed, non-causal wording for playbook outcomes', () => {
    const playbook: MoodPlaybook = { id: 'p', name: 'Reset', sourceEmotionIds: ['sad'], targetEmotionIds: ['calm'], steps: ['Walk'], enabled: true, createdAt: 'x', updatedAt: 'x' };
    const entries: MoodEntry[] = [
      { id: 'before', occurredAt: '2026-08-01T10:00:00Z', emotions: [{ emotionId: 'sad', intensity: 5 }], factorIds: [], source: 'ontrack', createdAt: 'x', updatedAt: 'x' },
      { id: 'after', occurredAt: '2026-08-01T10:20:00Z', emotions: [{ emotionId: 'sad', intensity: 2 }], factorIds: [], source: 'ontrack', createdAt: 'x', updatedAt: 'x' },
    ];
    const runs: MoodPlaybookRun[] = [{ id: 'r', playbookId: 'p', initialEntryId: 'before', followUpEntryId: 'after', startedAt: 'x', completedAt: 'x', status: 'completed' }];
    expect(playbookOutcomeSummary({ playbook, entries, runs, emotions: DEFAULT_EMOTIONS })).toBe('This action was followed by lower sad in 1 of 1 check-ins.');
  });

  it('counts a target emotion gain when the source emotion stays the same', () => {
    const playbook: MoodPlaybook = {
      id: 'p',
      name: 'Reset',
      sourceEmotionIds: ['anxious'],
      targetEmotionIds: ['calm'],
      steps: ['Walk'],
      enabled: true,
      createdAt: 'x',
      updatedAt: 'x',
    };
    const entries: MoodEntry[] = [
      {
        id: 'before',
        occurredAt: '2026-08-01T10:00:00Z',
        emotions: [
          { emotionId: 'anxious', intensity: 5 },
          { emotionId: 'calm', intensity: 1 },
        ],
        factorIds: [],
        source: 'ontrack',
        createdAt: 'x',
        updatedAt: 'x',
      },
      {
        id: 'after',
        occurredAt: '2026-08-01T10:20:00Z',
        emotions: [
          { emotionId: 'anxious', intensity: 5 },
          { emotionId: 'calm', intensity: 4 },
        ],
        factorIds: [],
        source: 'ontrack',
        createdAt: 'x',
        updatedAt: 'x',
      },
    ];
    const runs: MoodPlaybookRun[] = [{
      id: 'r',
      playbookId: 'p',
      initialEntryId: 'before',
      followUpEntryId: 'after',
      startedAt: 'x',
      completedAt: 'x',
      status: 'completed',
    }];
    expect(playbookOutcomeSummary({ playbook, entries, runs, emotions: DEFAULT_EMOTIONS })).toBe(
      'This action was followed by higher calm in 1 of 1 check-ins.',
    );
  });
});
