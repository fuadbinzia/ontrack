import { appStackScreenOptions, mergeAppStackScreenOptions } from '../app-stack';

describe('mergeAppStackScreenOptions', () => {
  it('keeps full-screen iOS pop and Android ios_from_right by default', () => {
    expect(appStackScreenOptions.fullScreenGestureEnabled).toBe(true);
    expect(appStackScreenOptions.animationDuration).toBeGreaterThan(0);
  });

  it('lets a screen override animation without dropping the gesture flag', () => {
    const merged = mergeAppStackScreenOptions({ animation: 'fade' });
    expect(merged).toMatchObject({
      fullScreenGestureEnabled: true,
      animation: 'fade',
    });
  });

  it('merges function screenOptions onto the shared defaults', () => {
    const merged = mergeAppStackScreenOptions(() => ({ headerShown: true }));
    expect(typeof merged).toBe('function');
    if (typeof merged !== 'function') return;
    expect(merged({} as never)).toMatchObject({
      fullScreenGestureEnabled: true,
      headerShown: true,
    });
  });
});
