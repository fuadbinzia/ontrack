import {
  apiRateLimitSubject,
  authenticateApiRequest,
  isApiRequestBlocked,
} from '@/services/http/api-auth';
import { checkApiRateLimit } from '@/services/http/api-rate-limit';
import { guardedFetch } from '@/services/http/dependency-guard';

const OPENAI_TRANSCRIPTIONS_URL = 'https://api.openai.com/v1/audio/transcriptions';
const MAX_AUDIO_BYTES = 6 * 1024 * 1024;
const MAX_AUDIO_BASE64_LENGTH = Math.ceil(MAX_AUDIO_BYTES / 3) * 4;
const MAX_TEXT_LENGTH = 4_000;
const AUDIO_DATA_URL_HEADER = /^data:(audio\/(?:mp4|m4a|aac|mpeg|wav|webm|3gpp));base64,$/;

export type JournalTranscribeInput = {
  audioDataUrl: string;
};

function audioExtension(mime: string): string {
  if (mime === 'audio/webm') return 'webm';
  if (mime === 'audio/wav') return 'wav';
  if (mime === 'audio/mpeg') return 'mp3';
  if (mime === 'audio/3gpp') return '3gp';
  if (mime === 'audio/aac') return 'aac';
  return 'm4a';
}

export function parseAudioDataUrl(
  audioDataUrl: string,
): { mime: string; payload: string } | undefined {
  const separatorIndex = audioDataUrl.indexOf(',');
  if (separatorIndex < 0) return undefined;
  const header = audioDataUrl.slice(0, separatorIndex + 1);
  const headerMatch = AUDIO_DATA_URL_HEADER.exec(header);
  const payloadLength = audioDataUrl.length - separatorIndex - 1;
  if (!headerMatch || payloadLength > MAX_AUDIO_BASE64_LENGTH) return undefined;
  const payload = audioDataUrl.slice(separatorIndex + 1);
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(payload)) return undefined;
  const padding = payload.endsWith('==') ? 2 : payload.endsWith('=') ? 1 : 0;
  const decodedBytes = (payloadLength * 3) / 4 - padding;
  if (decodedBytes <= 0 || decodedBytes > MAX_AUDIO_BYTES) return undefined;
  return { mime: headerMatch[1]!, payload };
}

export function parseJournalTranscribeInput(value: unknown): JournalTranscribeInput | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const row = value as Record<string, unknown>;
  if (Object.keys(row).some((key) => key !== 'audioDataUrl')) return undefined;
  const audioDataUrl = typeof row.audioDataUrl === 'string' ? row.audioDataUrl : '';
  if (!parseAudioDataUrl(audioDataUrl)) return undefined;
  return { audioDataUrl };
}

export async function authorizeJournalTranscribe(request: Request) {
  const auth = await authenticateApiRequest(request);
  if (isApiRequestBlocked(auth)) {
    return {
      response: Response.json(
        {
          error: 'Sign in is required to transcribe journal audio.',
          code: 'PERMISSION_DENIED',
        },
        { status: 401 },
      ),
    };
  }
  if (checkApiRateLimit('journal', apiRateLimitSubject(request, auth)) === 'limited') {
    return {
      response: Response.json(
        {
          error: 'Journal dictate limit reached. Try again later.',
          code: 'RATE_LIMITED',
        },
        { status: 429 },
      ),
    };
  }
  return { auth };
}

export async function transcribeJournalAudio(audioDataUrl: string): Promise<string> {
  if (!process.env.OPENAI_API_KEY) throw new Error('NOT_CONFIGURED');
  const parsed = parseAudioDataUrl(audioDataUrl);
  if (!parsed) throw new Error('INVALID_INPUT');
  const bytes = Buffer.from(parsed.payload, 'base64');
  if (!bytes.length || bytes.length > MAX_AUDIO_BYTES) throw new Error('INVALID_INPUT');

  const form = new FormData();
  form.append('model', 'gpt-4o-mini-transcribe');
  form.append(
    'file',
    new Blob([bytes], { type: parsed.mime }),
    `journal-dictate.${audioExtension(parsed.mime)}`,
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
