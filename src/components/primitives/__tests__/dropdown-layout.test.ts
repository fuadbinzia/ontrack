import { clampNumber, placeDropdownMenu } from '../dropdown-layout';

describe('placeDropdownMenu', () => {
  it('clamps values', () => {
    expect(clampNumber(5, 0, 10)).toBe(5);
    expect(clampNumber(-1, 0, 10)).toBe(0);
    expect(clampNumber(20, 0, 10)).toBe(10);
  });

  it('opens below the trigger when space allows', () => {
    const placement = placeDropdownMenu({
      anchor: { x: 20, y: 100, width: 200, height: 48 },
      windowWidth: 400,
      windowHeight: 800,
      insetTop: 50,
      insetBottom: 30,
      insetLeft: 0,
      insetRight: 0,
      contentHeight: 200,
      menuMaxHeight: 280,
      gutter: 16,
      gap: 8,
    });
    expect(placement.openDown).toBe(true);
    expect(placement.top).toBe(100 + 48 + 8);
    expect(placement.width).toBe(200);
    expect(placement.left).toBe(20);
  });

  it('opens above when there is more room above', () => {
    const placement = placeDropdownMenu({
      anchor: { x: 20, y: 700, width: 200, height: 48 },
      windowWidth: 400,
      windowHeight: 800,
      insetTop: 50,
      insetBottom: 30,
      insetLeft: 0,
      insetRight: 0,
      contentHeight: 200,
      menuMaxHeight: 280,
      gutter: 16,
      gap: 8,
    });
    expect(placement.openDown).toBe(false);
    expect(placement.top).toBeLessThan(700);
  });

  it('keeps the menu above a docked soft keyboard', () => {
    const placement = placeDropdownMenu({
      anchor: { x: 20, y: 420, width: 200, height: 48 },
      windowWidth: 400,
      windowHeight: 800,
      insetTop: 50,
      insetBottom: 34,
      insetLeft: 0,
      insetRight: 0,
      contentHeight: 220,
      menuMaxHeight: 280,
      gutter: 16,
      gap: 8,
      keyboardInset: 300,
    });
    // Without keyboardInset, space below (~332) would open down into the IME.
    expect(placement.openDown).toBe(false);
    expect(placement.top + placement.maxHeight).toBeLessThanOrEqual(420);
  });
});
