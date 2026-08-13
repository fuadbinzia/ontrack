import {
  commonTravelTranslatorLanguages,
  languageFromLocale,
  languagesForDirection,
  mergeTravelTranslatorLanguages,
  reverseTravelTranslatorDirection,
} from '../travel-translator-language';

describe('travel translator languages', () => {
  it('uses the device locale as the home-language default', () => {
    expect(languageFromLocale('es-MX')).toEqual({
      code: 'es',
      displayName: 'Spanish',
      speechLocale: 'es-MX',
    });
    expect(languageFromLocale('system').speechLocale).toBe('en-US');
  });

  it('deduplicates locale choices without dropping distinct regional voices', () => {
    const spanishSpain = languageFromLocale('es-ES');
    const spanishMexico = languageFromLocale('es-MX');
    expect(
      mergeTravelTranslatorLanguages(
        [spanishSpain],
        [spanishSpain, spanishMexico],
      ).map((item) => item.speechLocale),
    ).toEqual(['es-ES', 'es-MX']);
  });

  it('opens with a valid locale when Intl.Locale is unavailable', () => {
    const localeDescriptor = Object.getOwnPropertyDescriptor(Intl, 'Locale');
    Object.defineProperty(Intl, 'Locale', {
      configurable: true,
      value: undefined,
    });

    try {
      expect(languageFromLocale('es-MX')).toEqual({
        code: 'es',
        displayName: 'Spanish',
        speechLocale: 'es-MX',
      });
      expect(commonTravelTranslatorLanguages()).toHaveLength(18);
    } finally {
      if (localeDescriptor) Object.defineProperty(Intl, 'Locale', localeDescriptor);
      else Reflect.deleteProperty(Intl, 'Locale');
    }
  });

  it('falls back to a language code when Intl display names are unavailable', () => {
    const displayNamesDescriptor = Object.getOwnPropertyDescriptor(Intl, 'DisplayNames');
    Object.defineProperty(Intl, 'DisplayNames', {
      configurable: true,
      value: undefined,
    });

    try {
      expect(languageFromLocale('fr-FR')).toEqual({
        code: 'fr',
        displayName: 'fr',
        speechLocale: 'fr-FR',
      });
      expect(languageFromLocale('not_a_locale')).toEqual({
        code: 'en',
        displayName: 'en',
        speechLocale: 'en-US',
      });
    } finally {
      if (displayNamesDescriptor) {
        Object.defineProperty(Intl, 'DisplayNames', displayNamesDescriptor);
      } else {
        Reflect.deleteProperty(Intl, 'DisplayNames');
      }
    }
  });

  it('resolves and reverses both conversation directions', () => {
    const home = languageFromLocale('en-US');
    const destination = languageFromLocale('fr-FR');
    expect(languagesForDirection('home-to-destination', home, destination)).toEqual({
      source: home,
      target: destination,
    });
    expect(languagesForDirection('destination-to-home', home, destination)).toEqual({
      source: destination,
      target: home,
    });
    expect(reverseTravelTranslatorDirection('home-to-destination')).toBe(
      'destination-to-home',
    );
  });
});
