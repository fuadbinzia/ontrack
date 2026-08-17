import {
  shouldRestartVoicePlayback,
  toggleVoicePlayback,
  VOICE_PLAYBACK_AUDIO_MODE,
  type VoicePlaybackStatus,
} from '../voice-playback';

function playbackStatus(over: Partial<VoicePlaybackStatus> = {}): VoicePlaybackStatus {
  return {
    playing: false,
    didJustFinish: false,
    currentTime: 0,
    duration: 4,
    ...over,
  };
}

function mockPlayer() {
  return {
    play: jest.fn(),
    pause: jest.fn(),
    seekTo: jest.fn(async () => undefined),
  };
}

describe('journal voice playback', () => {
  it('pauses without touching the audio session when already playing', async () => {
    const player = mockPlayer();
    const setAudioModeAsync = jest.fn(async () => undefined);

    await toggleVoicePlayback(player, playbackStatus({ playing: true }), setAudioModeAsync);

    expect(player.pause).toHaveBeenCalledTimes(1);
    expect(player.play).not.toHaveBeenCalled();
    expect(setAudioModeAsync).not.toHaveBeenCalled();
  });

  it('leaves record mode and stays audible on the silent switch before playing', async () => {
    const player = mockPlayer();
    const setAudioModeAsync = jest.fn(async () => undefined);

    await toggleVoicePlayback(player, playbackStatus(), setAudioModeAsync);

    expect(setAudioModeAsync).toHaveBeenCalledWith({
      allowsRecording: false,
      playsInSilentMode: true,
    });
    expect(player.play).toHaveBeenCalledTimes(1);
    expect(player.seekTo).not.toHaveBeenCalled();
  });

  it('replays a finished note from the start instead of a dead play()', async () => {
    const player = mockPlayer();

    await toggleVoicePlayback(
      player,
      playbackStatus({ didJustFinish: true, currentTime: 4 }),
      jest.fn(async () => undefined),
    );

    expect(player.seekTo).toHaveBeenCalledWith(0);
    expect(player.play).toHaveBeenCalledTimes(1);
  });

  it('restarts when the player is parked at the end of the clip', async () => {
    const player = mockPlayer();

    await toggleVoicePlayback(
      player,
      playbackStatus({ currentTime: 4, duration: 4 }),
      jest.fn(async () => undefined),
    );

    expect(player.seekTo).toHaveBeenCalledWith(0);
    expect(player.play).toHaveBeenCalledTimes(1);
  });

  it('resumes mid-clip without seeking back to the start', async () => {
    const player = mockPlayer();

    await toggleVoicePlayback(
      player,
      playbackStatus({ currentTime: 1.5 }),
      jest.fn(async () => undefined),
    );

    expect(player.seekTo).not.toHaveBeenCalled();
    expect(player.play).toHaveBeenCalledTimes(1);
  });

  it('still plays when the audio-mode reset fails', async () => {
    const player = mockPlayer();
    const setAudioModeAsync = jest.fn(async () => {
      throw new Error('session busy');
    });

    await toggleVoicePlayback(player, playbackStatus(), setAudioModeAsync);

    expect(player.play).toHaveBeenCalledTimes(1);
  });

  it('still plays when the restart seek fails', async () => {
    const player = mockPlayer();
    player.seekTo.mockRejectedValueOnce(new Error('not seekable'));

    await toggleVoicePlayback(
      player,
      playbackStatus({ didJustFinish: true }),
      jest.fn(async () => undefined),
    );

    expect(player.play).toHaveBeenCalledTimes(1);
  });

  it('treats an unloaded clip (duration 0) as not finished', () => {
    expect(
      shouldRestartVoicePlayback(playbackStatus({ currentTime: 0, duration: 0 })),
    ).toBe(false);
  });

  it('keeps the playback mode constant recording-free', () => {
    expect(VOICE_PLAYBACK_AUDIO_MODE.allowsRecording).toBe(false);
    expect(VOICE_PLAYBACK_AUDIO_MODE.playsInSilentMode).toBe(true);
  });
});
