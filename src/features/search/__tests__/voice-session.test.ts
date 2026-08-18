import { mergeDictationIntoDraft } from '@/features/journal/journal-dictate-status';

import { VOICE_MAX_TURN_MS } from '../voice-endpoint';
import {
  applyDockTranscript,
  createVoiceSessionState,
  reduceVoiceSession,
} from '../voice-session';

describe('dock voice session', () => {
  it('places transcribed text in the search field and does not auto-send', () => {
    expect(applyDockTranscript('  add milk  ')).toEqual({
      fieldQuery: 'add milk',
      pendingMessage: '',
    });
    expect(applyDockTranscript('   ')).toEqual({
      fieldQuery: '',
      pendingMessage: '',
    });
    const next = reduceVoiceSession(createVoiceSessionState(), {
      type: 'transcript',
      text: 'add milk',
    });
    expect(next.autoSendText).toBeNull();
    expect(next.phase).toBe('idle');
    expect(next.audioSessionActive).toBe(false);
  });

  it('stop starts the thinking/transcribe path without auto-send', () => {
    const listening = reduceVoiceSession(createVoiceSessionState(), { type: 'start' });
    expect(listening.phase).toBe('listening');
    const stopped = reduceVoiceSession(listening, { type: 'stop' });
    expect(stopped.phase).toBe('thinking');
    expect(stopped.autoSendText).toBeNull();
    expect(stopped.audioSessionActive).toBe(false);
    const transcribed = reduceVoiceSession(stopped, { type: 'transcript', text: 'open plants' });
    expect(transcribed.phase).toBe('idle');
    expect(transcribed.autoSendText).toBeNull();
    expect(applyDockTranscript('open plants').fieldQuery).toBe('open plants');
  });

  it('does not idle a new listen if a stale transcript arrives', () => {
    const listening = reduceVoiceSession(createVoiceSessionState(), { type: 'start' });
    const next = reduceVoiceSession(listening, { type: 'transcript', text: 'add milk' });
    expect(next.phase).toBe('listening');
    expect(next.autoSendText).toBeNull();
    const errored = reduceVoiceSession(listening, {
      type: 'transcript-error',
      message: 'That recording could not be transcribed.',
    });
    expect(errored.phase).toBe('listening');
  });

  it('appends transcribed text onto an existing search query', () => {
    const { fieldQuery } = applyDockTranscript('  milk  ');
    expect(mergeDictationIntoDraft('buy', fieldQuery)).toBe('buy milk');
    expect(mergeDictationIntoDraft('', fieldQuery)).toBe('milk');
    expect(mergeDictationIntoDraft('buy eggs', '   ')).toBe('buy eggs');
  });

  it('stays listening through silence metering until stop', () => {
    let state = reduceVoiceSession(createVoiceSessionState(), { type: 'start' });
    state = reduceVoiceSession(state, { type: 'meter', db: -20, elapsedMs: 200 });
    for (let i = 0; i < 20; i += 1) {
      state = reduceVoiceSession(state, {
        type: 'meter',
        db: -80,
        elapsedMs: 300 + i * 100,
      });
    }
    expect(state.phase).toBe('listening');
    expect(state.audioSessionActive).toBe(true);
    state = reduceVoiceSession(state, { type: 'stop' });
    expect(state.phase).toBe('thinking');
  });

  it('does not leave listening when metering elapsedMs stays at 0', () => {
    let state = reduceVoiceSession(createVoiceSessionState(), { type: 'start' });
    for (let i = 0; i < 25; i += 1) {
      state = reduceVoiceSession(state, { type: 'meter', db: -20, elapsedMs: 0 });
    }
    expect(state.phase).toBe('listening');
  });

  it('still endpoints at the 60s cap without a Stop tap', () => {
    const listening = reduceVoiceSession(createVoiceSessionState(), { type: 'start' });
    const capped = reduceVoiceSession(listening, {
      type: 'meter',
      db: -80,
      elapsedMs: VOICE_MAX_TURN_MS,
    });
    expect(capped.phase).toBe('thinking');
    expect(capped.autoSendText).toBeNull();
    expect(capped.audioSessionActive).toBe(false);
  });

  it('cancel idles a listening session', () => {
    const listening = reduceVoiceSession(createVoiceSessionState(), { type: 'start' });
    const cancelled = reduceVoiceSession(listening, { type: 'cancel' });
    expect(cancelled.phase).toBe('idle');
    expect(cancelled.audioSessionActive).toBe(false);
    expect(cancelled.autoSendText).toBeNull();
  });

  it('ignores stop when the session is not recording', () => {
    const idle = reduceVoiceSession(createVoiceSessionState(), { type: 'stop' });
    expect(idle.phase).toBe('idle');
    const thinking = reduceVoiceSession(
      { ...createVoiceSessionState(), phase: 'thinking' },
      { type: 'stop' },
    );
    expect(thinking.phase).toBe('thinking');
  });

  it('stops speech on barge-in and returns to listening', () => {
    const speaking = reduceVoiceSession(createVoiceSessionState(), { type: 'reply-started' });
    expect(speaking.phase).toBe('speaking');
    const barged = reduceVoiceSession(speaking, { type: 'barge-in' });
    expect(barged.phase).toBe('listening');
    expect(barged.audioSessionActive).toBe(true);
  });

  it('idles after a re-listen timeout when Drive Mode is off', () => {
    const relisten = reduceVoiceSession(
      { ...createVoiceSessionState(), phase: 'relisten', audioSessionActive: true },
      { type: 'relisten-timeout' },
    );
    expect(relisten.phase).toBe('idle');
    expect(relisten.audioSessionActive).toBe(false);
  });

  it('deactivates the audio session on interrupt and idle', () => {
    const listening = reduceVoiceSession(createVoiceSessionState(), { type: 'start' });
    expect(listening.audioSessionActive).toBe(true);
    const interrupted = reduceVoiceSession(listening, { type: 'interrupt' });
    expect(interrupted.phase).toBe('idle');
    expect(interrupted.audioSessionActive).toBe(false);
  });

  it('releases the native recorder when idle, paused, or unmounted', () => {
    const source = require('node:fs').readFileSync(
      require('node:path').join(process.cwd(), 'src/features/search/use-voice-session.ts'),
      'utf8',
    );
    expect(source).toContain("state.phase === 'idle' || state.phase === 'paused'");
    expect(source).toContain('recorderRef.current.cancel()');
    expect(source).toContain("AppState.addEventListener('change'");
    // useJournalRecorder returns a new object each render (metering). Binding
    // cancel to that identity dropped the take before Stop could finish it.
    expect(source).not.toMatch(/\[recorder, state\.phase\]/);
    expect(source).not.toMatch(/\[clearTimers, recorder, stopSpeech\]/);
    expect(source).not.toMatch(/\[dispatch, recorder, stopSpeech\]/);
  });

  it('stop transcribes into the search field instead of speaking or auto-sending', () => {
    const source = require('node:fs').readFileSync(
      require('node:path').join(process.cwd(), 'src/features/search/use-voice-session.ts'),
      'utf8',
    );
    expect(source).toContain('stopListening');
    expect(source).toContain('stopGeneration');
    expect(source).toContain("type: 'stop'");
    expect(source).toContain('setListening(true, Date.now())');
    expect(source).toContain('setListening(false, null)');
    expect(source).toContain('requestJournalTranscribe');
    expect(source).toContain('applyDockTranscript');
    expect(source).toContain('mergeDictationIntoDraft');
    expect(source).toContain('setQuery');
  });

  it('keeps pause across inactive→active and waits for a settle beat before re-arm', () => {
    const paused = reduceVoiceSession(createVoiceSessionState({ driveMode: true }), {
      type: 'activate-assistant',
    });
    expect(paused.phase).toBe('paused');
    expect(paused.audioSessionActive).toBe(false);
    const inactive = reduceVoiceSession(paused, { type: 'app-inactive' });
    expect(inactive.pauseUntilActive).toBe(true);
    const activeAt = 1_000;
    const active = reduceVoiceSession(inactive, { type: 'app-active', nowMs: activeAt });
    expect(active.phase).toBe('paused');
    expect(active.audioSessionActive).toBe(false);
    const tooSoon = reduceVoiceSession(active, { type: 'settle', nowMs: activeAt + 100 });
    expect(tooSoon.phase).toBe('paused');
    const settled = reduceVoiceSession(active, { type: 'settle', nowMs: activeAt + 500 });
    expect(settled.phase).toBe('listening');
  });
});
