import { bottomNavBottomPad } from '../bottom-nav-inset';

describe('bottomNavBottomPad', () => {
  it('lifts the dock by the full Android system nav inset', () => {
    expect(bottomNavBottomPad(48, 8, 'android')).toBe(48);
  });

  it('uses compact spacing when Android reports no bottom inset', () => {
    expect(bottomNavBottomPad(0, 8, 'android')).toBe(8);
  });

  it('keeps the iOS home-indicator pad small', () => {
    expect(bottomNavBottomPad(34, 8, 'ios')).toBe(6);
  });

  it('uses compact spacing when iOS reports no bottom inset', () => {
    expect(bottomNavBottomPad(0, 8, 'ios')).toBe(8);
  });
});
