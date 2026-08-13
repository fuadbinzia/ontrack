import {
  defaultOpenAIModel,
  fetchOpenAIResponses,
  parseOpenAIJsonResponse,
} from '@/services/ai';
import {
  apiRateLimitSubject,
  authenticateApiRequest,
  isApiRequestBlocked,
} from '@/services/http/api-auth';
import { guardedFetch } from '@/services/http/dependency-guard';
import { checkApiRateLimit } from '@/services/http/api-rate-limit';
import {
  isTravelTranslatorLanguage,
  languageFromLocale,
  normalizeTravelTranslatorLanguage,
} from '@/features/travel/translator/travel-translator-language';
import type {
  TravelTranslatorLanguage,
  TravelTranslatorLanguagesInput,
  TravelTranslatorLanguagesResponse,
  TravelTranslatorTurnInput,
  TravelTranslatorTurnResponse,
} from '@/features/travel/translator/travel-translator-types';

const OPENAI_TRANSCRIPTIONS_URL = 'https://api.openai.com/v1/audio/transcriptions';
const MAX_DESTINATION_LENGTH = 180;
const MAX_TEXT_LENGTH = 1_000;
const MAX_AUDIO_BYTES = 6 * 1024 * 1024;
const MAX_AUDIO_BASE64_LENGTH = Math.ceil(MAX_AUDIO_BYTES / 3) * 4;
const AUDIO_DATA_URL_HEADER = /^data:(audio\/(?:mp4|m4a|aac|mpeg|wav|webm|3gpp));base64,$/;
const LANGUAGE_INPUT_KEYS = new Set(['destination', 'homeLocale']);
const TURN_INPUT_KEYS = new Set([
  'destination',
  'sourceLanguage',
  'targetLanguage',
  'text',
  'audioDataUrl',
]);

const LANGUAGE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['home', 'destination', 'alternatives'],
  properties: {
    home: { $ref: '#/$defs/language' },
    destination: { $ref: '#/$defs/language' },
    alternatives: {
      type: 'array',
      maxItems: 6,
      items: { $ref: '#/$defs/language' },
    },
  },
  $defs: {
    language: {
      type: 'object',
      additionalProperties: false,
      required: ['code', 'displayName', 'speechLocale'],
      properties: {
        code: { type: 'string', maxLength: 35 },
        displayName: { type: 'string', maxLength: 80 },
        speechLocale: { type: 'string', maxLength: 35 },
      },
    },
  },
} as const;

const TRANSLATION_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['translatedText', 'transliteration'],
  properties: {
    translatedText: { type: 'string', maxLength: 4_000 },
    transliteration: { type: ['string', 'null'], maxLength: 4_000 },
  },
} as const;

const languageCache = new Map<string, TravelTranslatorLanguagesResponse>();

function exactKeys(value: Record<string, unknown>, allowed: Set<string>): boolean {
  return Object.keys(value).every((key) => allowed.has(key));
}

function cleanDestination(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const destination = value.trim();
  return destination && destination.length <= MAX_DESTINATION_LENGTH
    ? destination
    : undefined;
}

function parseAudioDataUrl(
  audioDataUrl: string,
): { mime: string; payload: string; decodedBytes: number } | undefined {
  const separatorIndex = audioDataUrl.indexOf(',');
  if (separatorIndex < 0) return undefined;
  const header = audioDataUrl.slice(0, separatorIndex + 1);
  const headerMatch = AUDIO_DATA_URL_HEADER.exec(header);
  const payloadLength = audioDataUrl.length - separatorIndex - 1;
  // Reject oversized input before applying a regular expression to attacker-controlled data.
  if (!headerMatch || payloadLength > MAX_AUDIO_BASE64_LENGTH) return undefined;
  const payload = audioDataUrl.slice(separatorIndex + 1);
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(payload)) return undefined;
  const padding = payload.endsWith('==') ? 2 : payload.endsWith('=') ? 1 : 0;
  const decodedBytes = (payloadLength * 3) / 4 - padding;
  if (decodedBytes <= 0 || decodedBytes > MAX_AUDIO_BYTES) return undefined;
  return { mime: headerMatch[1]!, payload, decodedBytes };
}

export function parseTravelTranslatorLanguagesInput(
  value: unknown,
): TravelTranslatorLanguagesInput | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const row = value as Record<string, unknown>;
  if (!exactKeys(row, LANGUAGE_INPUT_KEYS)) return undefined;
  const destination = cleanDestination(row.destination);
  const homeLocale = typeof row.homeLocale === 'string' ? row.homeLocale.trim() : '';
  if (!destination || !homeLocale || homeLocale.length > 35) return undefined;
  return { destination, homeLocale };
}

export function parseTravelTranslatorTurnInput(
  value: unknown,
): TravelTranslatorTurnInput | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const row = value as Record<string, unknown>;
  if (!exactKeys(row, TURN_INPUT_KEYS)) return undefined;
  const destination = cleanDestination(row.destination);
  if (
    !destination ||
    !isTravelTranslatorLanguage(row.sourceLanguage) ||
    !isTravelTranslatorLanguage(row.targetLanguage)
  ) {
    return undefined;
  }

  const text = typeof row.text === 'string' ? row.text.trim() : undefined;
  const audioDataUrl =
    typeof row.audioDataUrl === 'string' ? row.audioDataUrl : undefined;
  if (Boolean(text) === Boolean(audioDataUrl)) return undefined;
  if (text && text.length > MAX_TEXT_LENGTH) return undefined;
  if (audioDataUrl && !parseAudioDataUrl(audioDataUrl)) return undefined;

  return {
    destination,
    sourceLanguage: normalizeTravelTranslatorLanguage(row.sourceLanguage),
    targetLanguage: normalizeTravelTranslatorLanguage(row.targetLanguage),
    ...(text ? { text } : {}),
    ...(audioDataUrl ? { audioDataUrl } : {}),
  };
}

export async function authorizeTravelTranslator(request: Request) {
  const auth = await authenticateApiRequest(request);
  if (isApiRequestBlocked(auth)) {
    return {
      response: Response.json(
        {
          error: 'Sign in is required to use the travel translator.',
          code: 'PERMISSION_DENIED',
        },
        { status: 401 },
      ),
    };
  }
  if (checkApiRateLimit('travel', apiRateLimitSubject(request, auth)) === 'limited') {
    return {
      response: Response.json(
        {
          error: 'Translator limit reached. Try again later.',
          code: 'RATE_LIMITED',
        },
        { status: 429 },
      ),
    };
  }
  return { auth };
}

function validateLanguage(value: unknown): TravelTranslatorLanguage {
  if (!isTravelTranslatorLanguage(value)) throw new Error('INVALID_RESPONSE');
  return normalizeTravelTranslatorLanguage(value);
}

function validateLanguageResponse(value: unknown): TravelTranslatorLanguagesResponse {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('INVALID_RESPONSE');
  }
  const row = value as Record<string, unknown>;
  if (!Array.isArray(row.alternatives)) throw new Error('INVALID_RESPONSE');
  const result = {
    home: validateLanguage(row.home),
    destination: validateLanguage(row.destination),
    alternatives: row.alternatives.slice(0, 6).map(validateLanguage),
  };
  return result;
}

export async function resolveTravelTranslatorLanguages(
  input: TravelTranslatorLanguagesInput,
  safetyIdentifier: string,
): Promise<TravelTranslatorLanguagesResponse> {
  if (!process.env.OPENAI_API_KEY) throw new Error('NOT_CONFIGURED');
  const cacheKey = `${input.homeLocale.toLowerCase()}|${input.destination.toLowerCase()}`;
  const cached = languageCache.get(cacheKey);
  if (cached) return cached;

  const homeFallback = languageFromLocale(input.homeLocale);
  const body = await fetchOpenAIResponses({
    model: defaultOpenAIModel(
      process.env.OPENAI_TRAVEL_TRANSLATOR_MODEL,
      'gpt-5.6-luna',
    ),
    safetyIdentifier,
    payload: {
      input: [
        {
          role: 'user',
          content: [
            {
              type: 'input_text',
              text: [
                'Choose practical languages for a traveler translation tool.',
                `Traveler device locale: ${input.homeLocale}.`,
                `Trip destination exactly as entered: ${input.destination}.`,
                `The home fallback is ${homeFallback.displayName} (${homeFallback.speechLocale}).`,
                'Return the traveler language, the most locally useful destination language, and up to six useful alternatives.',
                'Use valid BCP-47 tags. speechLocale should be a region-specific locale commonly supported by device text-to-speech.',
                'Do not infer or return any personal information.',
              ].join('\n'),
            },
          ],
        },
      ],
      text: {
        format: {
          type: 'json_schema',
          name: 'travel_translator_languages',
          strict: true,
          schema: LANGUAGE_SCHEMA,
        },
      },
    },
  });
  const resolved = validateLanguageResponse(
    parseOpenAIJsonResponse(body, { emptyError: 'INVALID_RESPONSE' }),
  );
  languageCache.set(cacheKey, resolved);
  return resolved;
}

function audioExtension(mime: string): string {
  if (mime === 'audio/webm') return 'webm';
  if (mime === 'audio/wav') return 'wav';
  if (mime === 'audio/mpeg') return 'mp3';
  if (mime === 'audio/3gpp') return '3gp';
  if (mime === 'audio/aac') return 'aac';
  return 'm4a';
}

async function transcribeAudio(audioDataUrl: string): Promise<string> {
  const parsed = parseAudioDataUrl(audioDataUrl);
  if (!parsed) throw new Error('INVALID_INPUT');
  const bytes = Buffer.from(parsed.payload, 'base64');
  if (!bytes.length || bytes.length > MAX_AUDIO_BYTES) throw new Error('INVALID_INPUT');

  const form = new FormData();
  form.append('model', 'gpt-4o-mini-transcribe');
  form.append(
    'file',
    new Blob([bytes], { type: parsed.mime }),
    `travel-turn.${audioExtension(parsed.mime)}`,
  );
  form.append('response_format', 'json');
  const response = await guardedFetch(
    'openai',
    OPENAI_TRANSCRIPTIONS_URL,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
      body: form,
    },
    { timeoutMs: 45_000, maxConcurrency: 2 },
  );
  if (!response.ok) throw new Error('TRANSCRIPTION_FAILED');
  const body = (await response.json()) as { text?: unknown };
  const transcript = typeof body.text === 'string' ? body.text.trim() : '';
  if (!transcript || transcript.length > MAX_TEXT_LENGTH) {
    throw new Error('INVALID_TRANSCRIPT');
  }
  return transcript;
}

function validateTranslation(value: unknown): {
  translatedText: string;
  transliteration?: string;
} {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('INVALID_RESPONSE');
  }
  const row = value as Record<string, unknown>;
  const translatedText =
    typeof row.translatedText === 'string' ? row.translatedText.trim() : '';
  const transliteration =
    typeof row.transliteration === 'string' ? row.transliteration.trim() : '';
  if (!translatedText || translatedText.length > 4_000) {
    throw new Error('INVALID_RESPONSE');
  }
  return {
    translatedText,
    ...(transliteration ? { transliteration } : {}),
  };
}

export async function translateTravelTranslatorTurn(
  input: TravelTranslatorTurnInput,
  safetyIdentifier: string,
): Promise<TravelTranslatorTurnResponse> {
  if (!process.env.OPENAI_API_KEY) throw new Error('NOT_CONFIGURED');
  const transcript = input.text ?? (await transcribeAudio(input.audioDataUrl!));
  const body = await fetchOpenAIResponses({
    model: defaultOpenAIModel(
      process.env.OPENAI_TRAVEL_TRANSLATOR_MODEL,
      'gpt-5.6-luna',
    ),
    safetyIdentifier,
    payload: {
      input: [
        {
          role: 'user',
          content: [
            {
              type: 'input_text',
              text: [
                'Translate one short travel-conversation turn faithfully and naturally.',
                `Trip destination context: ${input.destination}.`,
                `Source: ${input.sourceLanguage.displayName} (${input.sourceLanguage.code}).`,
                `Target: ${input.targetLanguage.displayName} (${input.targetLanguage.code}).`,
                'Preserve meaning, names, numbers, politeness, and questions. Do not answer the speaker or add advice.',
                'Return transliteration only when it materially helps a traveler read a non-Latin target script; otherwise null.',
                `Text: ${JSON.stringify(transcript)}`,
              ].join('\n'),
            },
          ],
        },
      ],
      text: {
        format: {
          type: 'json_schema',
          name: 'travel_translation_turn',
          strict: true,
          schema: TRANSLATION_SCHEMA,
        },
      },
    },
  });
  return {
    transcript,
    ...validateTranslation(
      parseOpenAIJsonResponse(body, { emptyError: 'INVALID_RESPONSE' }),
    ),
  };
}

export function resetTravelTranslatorLanguageCacheForTests() {
  languageCache.clear();
}
