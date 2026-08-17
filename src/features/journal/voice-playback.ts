import type { AudioMode, AudioStatus } from 'expo-audio';

/**
 * Recording leaves the session in record mode (iOS routes output to the quiet
 * earpiece) and the silent switch would mute playback entirely — always move
 * to a playback mode before playing a voice note.
 */
export const VOICE_PLAYBACK_AUDIO_MODE: Partial<AudioMode> = {
  allowsRecording: false,
  playsInSilentMode: true,
};

export type VoicePlaybackStatus = Pick<
  AudioStatus,
  'playing' | 'didJustFinish' | 'currentTime' | 'duration'
>;

export type VoicePlaybackPlayer = {
  play: () => void;
  pause: () => void;
  seekTo: (seconds: number) => Promise<void>;
};

const END_TOLERANCE_SECONDS = 0.05;

/** A finished player parks at the end of the clip, where play() is a no-op. */
export function shouldRestartVoicePlayback(status: VoicePlaybackStatus): boolean {
  if (status.didJustFinish) return true;
  return (
    status.duration > 0 &&
    status.currentTime >= status.duration - END_TOLERANCE_SECONDS
  );
}

export async function toggleVoicePlayback(
  player: VoicePlaybackPlayer,
  status: VoicePlaybackStatus,
  setAudioModeAsync: (mode: Partial<AudioMode>) => Promise<void>,
): Promise<void> {
  if (status.playing) {
    player.pause();
    return;
  }
  try {
    await setAudioModeAsync(VOICE_PLAYBACK_AUDIO_MODE);
  } catch {
    // Best-effort; playback may still be audible in the current mode.
  }
  if (shouldRestartVoicePlayback(status)) {
    try {
      await player.seekTo(0);
    } catch {
      // Best-effort; play() still resumes from wherever the player sits.
    }
  }
  player.play();
}
