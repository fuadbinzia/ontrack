import { WAVE_SILENCE_LEVEL, meteringToWaveLevel } from '@/features/journal/voice-wave';

export const VOICE_TRAILING_SILENCE_MS = 1200;
export const VOICE_MAX_TURN_MS = 60_000;
export const VOICE_RELISTEN_TIMEOUT_MS = 8000;
export const VOICE_SETTLE_MS = 400;
export const VOICE_SAMPLE_MS = 100;

export type EndpointPhase = 'awaiting-onset' | 'speaking' | 'trailing-silence' | 'endpoint';

export interface EndpointState {
  phase: EndpointPhase;
  heardOnset: boolean;
  trailingSilenceMs: number;
}

export function createEndpointState(): EndpointState {
  return { phase: 'awaiting-onset', heardOnset: false, trailingSilenceMs: 0 };
}

function isSpeaking(db: number | null | undefined): boolean {
  return meteringToWaveLevel(db) > WAVE_SILENCE_LEVEL + 0.08;
}

/**
 * Pure metering → endpoint. No endpoint before speech onset. 60s cap always fires.
 */
export function reduceEndpointing(
  state: EndpointState,
  sample: { db: number | null; elapsedMs: number },
  sampleMs: number = VOICE_SAMPLE_MS,
): EndpointState {
  if (sample.elapsedMs >= VOICE_MAX_TURN_MS) {
    return { ...state, phase: 'endpoint' };
  }
  const speaking = isSpeaking(sample.db);
  if (!state.heardOnset) {
    if (speaking) {
      return { phase: 'speaking', heardOnset: true, trailingSilenceMs: 0 };
    }
    return { ...state, phase: 'awaiting-onset' };
  }
  if (speaking) {
    return { phase: 'speaking', heardOnset: true, trailingSilenceMs: 0 };
  }
  const trailingSilenceMs = state.trailingSilenceMs + sampleMs;
  if (trailingSilenceMs >= VOICE_TRAILING_SILENCE_MS) {
    return { phase: 'endpoint', heardOnset: true, trailingSilenceMs };
  }
  return { phase: 'trailing-silence', heardOnset: true, trailingSilenceMs };
}
