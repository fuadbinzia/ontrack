import AppearanceScreen from '../appearance';

jest.mock('@/features/account/avatar-color-picker', () => ({
  AvatarColorPicker: () => null,
}));

describe('App Appearance module boundary', () => {
  it('loads the screen that owns the custom avatar color-picker contract', () => {
    expect(AppearanceScreen).toEqual(expect.any(Function));
  });
});
