import {
  VOICE_MAX_TURN_MS,
  createEndpointState,
  reduceEndpointing,
} from '../voice-endpoint';

describe('voice endpointing', () => {
  it('does not endpoint before speech onset', () => {
    let state = createEndpointState();
    for (let i = 0; i < 20; i += 1) {
      state = reduceEndpointing(state, { db: -80, elapsedMs: i * 100 });
    }
    expect(state.phase).toBe('awaiting-onset');
    expect(state.heardOnset).toBe(false);
  });

  it('goes speaking → trailing silence → endpoint after onset', () => {
    let state = reduceEndpointing(createEndpointState(), { db: -20, elapsedMs: 200 });
    expect(state.phase).toBe('speaking');
    expect(state.heardOnset).toBe(true);
    state = reduceEndpointing(state, { db: -20, elapsedMs: 300 });
    expect(state.phase).toBe('speaking');
    for (let i = 0; i < 13; i += 1) {
      state = reduceEndpointing(state, { db: -80, elapsedMs: 400 + i * 100 });
    }
    expect(state.phase).toBe('endpoint');
  });

  it('still fires at the 60s cap without onset', () => {
    const state = reduceEndpointing(createEndpointState(), {
      db: -80,
      elapsedMs: VOICE_MAX_TURN_MS,
    });
    expect(state.phase).toBe('endpoint');
  });

  it('still computes trailing-silence endpoint at the metering layer', () => {
    let state = reduceEndpointing(createEndpointState(), { db: -20, elapsedMs: 200 });
    for (let i = 0; i < 13; i += 1) {
      state = reduceEndpointing(state, { db: -80, elapsedMs: 300 + i * 100 });
    }
    expect(state.phase).toBe('endpoint');
  });
});
