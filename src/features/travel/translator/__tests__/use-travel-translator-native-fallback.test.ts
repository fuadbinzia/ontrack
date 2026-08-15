import { readFileSync } from 'node:fs';
import { join } from 'node:path';

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

  it('safe-loads expo-audio so a broken JS package cannot crash Travel', () => {
    const source = readFileSync(join(__dirname, '../use-travel-translator.ts'), 'utf8');
    expect(source).toContain('loadOptionalExpoAudio');
    expect(source).toContain('recordingOptionsFor');
    expect(source).not.toMatch(/require\(['"]expo-audio['"]\)/);
  });
});
