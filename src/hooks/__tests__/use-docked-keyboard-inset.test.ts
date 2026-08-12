import { dockedKeyboardInsetFromEvent } from '@/hooks/use-docked-keyboard-inset';

describe('dockedKeyboardInsetFromEvent', () => {
  const window = { windowHeight: 800, windowWidth: 390 };

  it('returns full IME height on iOS (no safe-area subtract)', () => {
    const next = dockedKeyboardInsetFromEvent(
      {
        endCoordinates: { height: 300, screenY: 500, width: 390 },
      } as never,
      { ...window, platform: 'ios' },
    );
    expect(next).toEqual({ keyboardOpen: true, keyboardInset: 300 });
  });

  it('prefers screenY distance when available', () => {
    const next = dockedKeyboardInsetFromEvent(
      {
        endCoordinates: { height: 260, screenY: 520, width: 390 },
      } as never,
      { ...window, platform: 'ios' },
    );
    expect(next.keyboardInset).toBe(280); // 800 - 520
  });

  it('zeros inset on Android resize (avoid double-count with adjustResize)', () => {
    const next = dockedKeyboardInsetFromEvent(
      {
        endCoordinates: { height: 300, screenY: 500, width: 390 },
      } as never,
      { ...window, platform: 'android', androidMode: 'resize' },
    );
    expect(next).toEqual({ keyboardOpen: true, keyboardInset: 0 });
  });

  it('lifts Android modals that ignore soft-input', () => {
    const next = dockedKeyboardInsetFromEvent(
      {
        endCoordinates: { height: 300, screenY: 500, width: 390 },
      } as never,
      { ...window, platform: 'android', androidMode: 'modal' },
    );
    expect(next).toEqual({ keyboardOpen: true, keyboardInset: 300 });
  });

  it('ignores floating / narrow IMEs', () => {
    const next = dockedKeyboardInsetFromEvent(
      {
        endCoordinates: { height: 300, screenY: 500, width: 200 },
      } as never,
      { ...window, platform: 'ios' },
    );
    expect(next).toEqual({ keyboardOpen: false, keyboardInset: 0 });
  });

  it('ignores hardware-keyboard assistant slivers (non-occluding frames)', () => {
    // Sim/device with hardware keyboard: willChangeFrame parks a ~23pt bar at
    // the bottom and never fires willHide — sheets must not float on it.
    const next = dockedKeyboardInsetFromEvent(
      {
        endCoordinates: { height: 23.33, screenY: 776.67, width: 390 },
      } as never,
      { ...window, platform: 'ios' },
    );
    expect(next).toEqual({ keyboardOpen: false, keyboardInset: 0 });
  });

  it('treats off-screen iOS frames as hidden (no fromHeight fallback)', () => {
    const next = dockedKeyboardInsetFromEvent(
      {
        endCoordinates: { height: 336, screenY: 800, width: 390 },
      } as never,
      { ...window, platform: 'ios' },
    );
    expect(next).toEqual({ keyboardOpen: false, keyboardInset: 0 });
  });
});
