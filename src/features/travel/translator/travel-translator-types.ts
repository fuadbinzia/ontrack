export type TravelTranslatorDirection =
  | 'home-to-destination'
  | 'destination-to-home';

export type TravelTranslatorTurnStatus =
  | 'translating'
  | 'translated'
  | 'failed';

export interface TravelTranslatorLanguage {
  /** BCP-47 language tag used by translation and display APIs. */
  code: string;
  displayName: string;
  /** Best BCP-47 locale to request from the device speech engine. */
  speechLocale: string;
}

export interface TravelTranslatorTurn {
  id: string;
  direction: TravelTranslatorDirection;
  sourceText: string;
  translatedText: string;
  transliteration?: string;
  status: TravelTranslatorTurnStatus;
  errorMessage?: string;
}

export interface TravelTranslatorLanguagesResponse {
  home: TravelTranslatorLanguage;
  destination: TravelTranslatorLanguage;
  alternatives: TravelTranslatorLanguage[];
}

export interface TravelTranslatorTurnResponse {
  transcript: string;
  translatedText: string;
  transliteration?: string;
}

export interface TravelTranslatorLanguagesInput {
  destination: string;
  homeLocale: string;
}

export interface TravelTranslatorTurnInput {
  destination: string;
  sourceLanguage: TravelTranslatorLanguage;
  targetLanguage: TravelTranslatorLanguage;
  text?: string;
  audioDataUrl?: string;
}
