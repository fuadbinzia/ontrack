jest.mock('expo-modules-core', () => ({
  ...jest.requireActual('expo-modules-core'),
  requireOptionalNativeModule: (name: string) =>
    name === 'ExpoAudio' || name === 'ExpoSpeech' ? null : {},
}));

jest.mock('expo-clipboard', () => ({ setStringAsync: jest.fn() }));
jest.mock('expo-file-system', () => ({ File: class {} }));
jest.mock('@/services/travel/translator-client', () => ({
  TravelTranslatorError: class extends Error {},
  requestTravelTranslatorLanguages: jest.fn(),
  requestTravelTranslatorTurn: jest.fn(),
}));

describe('travel translator native compatibility', () => {
  it('loads without evaluating voice packages when the installed binary lacks them', () => {
    expect(() => require('../use-travel-translator')).not.toThrow();
  });
});
