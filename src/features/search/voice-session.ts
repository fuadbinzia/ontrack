import {
  VOICE_MAX_TURN_MS,
  VOICE_RELISTEN_TIMEOUT_MS,
  VOICE_SETTLE_MS,
  createEndpointState,
  reduceEndpointing,
  type EndpointState,
} from './voice-endpoint';

export type VoicePhase =
  | 'idle'
  | 'listening'
  | 'thinking'
  | 'speaking'
  | 'relisten'
  | 'paused';

export type VoiceEvent =
  | { type: 'start' }
  | { type: 'stop' }
  | { type: 'cancel' }
  | { type: 'meter'; db: number | null; elapsedMs: number }
  | { type: 'transcript'; text: string }
  | { type: 'transcript-error'; message: string }
  | { type: 'reply-started' }
  | { type: 'reply-done' }
  | { type: 'barge-in' }
  | { type: 'interrupt' }
  | { type: 'app-inactive' }
  | { type: 'app-active'; nowMs: number }
  | { type: 'relisten-timeout' }
  | { type: 'activate-assistant' }
  | { type: 'settle'; nowMs: number };

export interface VoiceSessionState {
  phase: VoicePhase;
  endpoint: EndpointState;
  audioSessionActive: boolean;
  pauseUntilActive: boolean;
  settleUntilMs: number | null;
  driveMode: boolean;
  autoSendText: string | null;
  lastError: string | null;
}

export function createVoiceSessionState(
  options: { driveMode?: boolean } = {},
): VoiceSessionState {
  return {
    phase: 'idle',
    endpoint: createEndpointState(),
    audioSessionActive: false,
    pauseUntilActive: false,
    settleUntilMs: null,
    driveMode: options.driveMode ?? false,
    autoSendText: null,
    lastError: null,
  };
}

function idle(state: VoiceSessionState): VoiceSessionState {
  return {
    ...state,
    phase: 'idle',
    endpoint: createEndpointState(),
    audioSessionActive: false,
    autoSendText: null,
  };
}

function listen(state: VoiceSessionState): VoiceSessionState {
  return {
    ...state,
    phase: 'listening',
    endpoint: createEndpointState(),
    audioSessionActive: true,
    pauseUntilActive: false,
    settleUntilMs: null,
    autoSendText: null,
    lastError: null,
  };
}

function think(state: VoiceSessionState): VoiceSessionState {
  return {
    ...state,
    phase: 'thinking',
    audioSessionActive: false,
    autoSendText: null,
  };
}

/** Dock dictation types into the search field — the user reviews and sends. */
export function applyDockTranscript(text: string): { fieldQuery: string; pendingMessage: string } {
  return { fieldQuery: text.trim(), pendingMessage: '' };
}

export function reduceVoiceSession(
  state: VoiceSessionState,
  event: VoiceEvent,
): VoiceSessionState {
  switch (event.type) {
    case 'start':
      return listen(state);
    case 'stop':
      if (state.phase !== 'listening' && state.phase !== 'relisten') return state;
      return think(state);
    case 'cancel':
    case 'interrupt':
      return {
        ...idle(state),
        pauseUntilActive: false,
        settleUntilMs: null,
        lastError: null,
      };
    case 'meter': {
      if (state.phase === 'relisten') {
        const endpoint = reduceEndpointing(state.endpoint, event);
        if (endpoint.heardOnset) return listen({ ...state, endpoint });
        return { ...state, endpoint };
      }
      if (state.phase !== 'listening') return state;
      // Manual Stop ends the take. Silence must not. The 60s cap still finishes.
      if (event.elapsedMs >= VOICE_MAX_TURN_MS) {
        return think(state);
      }
      return state;
    }
    case 'transcript': {
      if (state.phase !== 'thinking') return state;
      const { pendingMessage } = applyDockTranscript(event.text);
      if (!pendingMessage) {
        return idle(state);
      }
      return {
        ...state,
        phase: 'thinking',
        audioSessionActive: false,
        autoSendText: pendingMessage,
      };
    }
    case 'transcript-error':
      if (state.phase === 'listening' || state.phase === 'relisten' || state.phase === 'speaking') {
        return state;
      }
      return {
        ...idle(state),
        lastError: event.message,
      };
    case 'reply-started':
      return { ...state, phase: 'speaking', autoSendText: null };
    case 'reply-done':
      return {
        ...state,
        phase: 'relisten',
        endpoint: createEndpointState(),
        audioSessionActive: true,
        autoSendText: null,
      };
    case 'barge-in':
      if (state.phase !== 'speaking' && state.phase !== 'relisten') return state;
      return listen(state);
    case 'relisten-timeout':
      if (state.phase !== 'relisten') return state;
      return state.driveMode ? listen(state) : idle(state);
    case 'activate-assistant':
      return {
        ...idle(state),
        phase: 'paused',
        pauseUntilActive: true,
        settleUntilMs: null,
      };
    case 'app-inactive':
      if (state.pauseUntilActive) {
        return { ...state, audioSessionActive: false };
      }
      if (state.phase === 'idle' || state.phase === 'paused') return state;
      return idle(state);
    case 'app-active':
      if (!state.pauseUntilActive) return state;
      return {
        ...state,
        phase: 'paused',
        pauseUntilActive: true,
        settleUntilMs: event.nowMs + VOICE_SETTLE_MS,
        audioSessionActive: false,
      };
    case 'settle':
      if (!state.pauseUntilActive || state.settleUntilMs == null) return state;
      if (event.nowMs < state.settleUntilMs) return state;
      if (state.driveMode) return listen({ ...state, pauseUntilActive: false });
      return { ...idle(state), pauseUntilActive: false, settleUntilMs: null };
    default:
      return state;
  }
}

export { VOICE_RELISTEN_TIMEOUT_MS, VOICE_SETTLE_MS };
