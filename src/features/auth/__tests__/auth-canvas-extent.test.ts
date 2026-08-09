import { settleAuthCanvasExtent } from '@/features/auth/auth-canvas-extent';

describe('settleAuthCanvasExtent', () => {
  it('takes the first positive layout as the baseline', () => {
    expect(settleAuthCanvasExtent(0, 402.4)).toBe(402);
  });

  it('ignores zero and negative measurements', () => {
    expect(settleAuthCanvasExtent(400, 0)).toBe(400);
    expect(settleAuthCanvasExtent(400, -12)).toBe(400);
  });

  it('follows a smaller slot so the card cannot clip the low sweep', () => {
    expect(settleAuthCanvasExtent(400, 360)).toBe(360);
  });

  it('allows the canvas to grow when more room appears', () => {
    expect(settleAuthCanvasExtent(360, 420)).toBe(420);
  });
});
