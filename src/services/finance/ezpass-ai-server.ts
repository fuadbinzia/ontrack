import { defaultOpenAIModel, fetchOpenAIResponses, parseOpenAIJsonResponse } from '@/services/ai';
import {
  apiRateLimitSubject,
  authenticateApiRequest,
  isApiRequestBlocked,
} from '@/services/http/api-auth';
import { checkApiRateLimit } from '@/services/http/api-rate-limit';

export interface EzPassAiFile {
  name: string;
  mimeType: string;
  dataUrl: string;
}

export interface EzPassAiRow {
  date: string;
  amount: number;
  description: string;
  time?: string;
  type?: string;
  reference?: string;
}

const MAX_FILES = 6;
const MAX_TOTAL_BYTES = 20 * 1024 * 1024;
const MAX_PDF_PAGES = 12;
const ALLOWED_MIME_TYPES = new Set(['application/pdf', 'image/jpeg', 'image/png', 'image/webp']);

const SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['activities'],
  properties: {
    activities: {
      type: 'array',
      maxItems: 500,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['date', 'amount', 'description', 'time', 'type', 'reference'],
        properties: {
          date: { type: 'string', maxLength: 20 },
          amount: { type: 'number' },
          description: { type: 'string', maxLength: 160 },
          time: { type: ['string', 'null'], maxLength: 20 },
          type: { type: ['string', 'null'], maxLength: 80 },
          reference: { type: ['string', 'null'], maxLength: 100 },
        },
      },
    },
  },
} as const;

function decodedBase64(dataUrl: string): string {
  const comma = dataUrl.indexOf(',');
  if (comma < 0 || !/;base64$/i.test(dataUrl.slice(0, comma))) throw new Error('INVALID_FILE');
  try {
    return atob(dataUrl.slice(comma + 1));
  } catch {
    throw new Error('INVALID_FILE');
  }
}

export function validateEzPassAiFiles(files: EzPassAiFile[]): void {
  if (!files.length || files.length > MAX_FILES) throw new Error('INVALID_FILE');
  let totalBytes = 0;
  for (const file of files) {
    if (!ALLOWED_MIME_TYPES.has(file.mimeType)) throw new Error('INVALID_FILE');
    if (!file.dataUrl.startsWith(`data:${file.mimeType};base64,`)) throw new Error('INVALID_FILE');
    const decoded = decodedBase64(file.dataUrl);
    totalBytes += decoded.length;
    if (file.mimeType === 'application/pdf') {
      const pageCount = decoded.match(/\/Type\s*\/Page\b/g)?.length ?? 0;
      if (pageCount > MAX_PDF_PAGES) throw new Error('TOO_MANY_PAGES');
    }
  }
  if (totalBytes > MAX_TOTAL_BYTES) throw new Error('FILE_TOO_LARGE');
}

function validateRows(value: unknown): EzPassAiRow[] {
  if (!value || typeof value !== 'object') throw new Error('INVALID_ANALYSIS');
  const activities = (value as { activities?: unknown }).activities;
  if (!Array.isArray(activities)) throw new Error('INVALID_ANALYSIS');
  return activities.slice(0, 500).map((value) => {
    const row = value as Partial<EzPassAiRow>;
    if (
      typeof row.date !== 'string' ||
      typeof row.amount !== 'number' ||
      !Number.isFinite(row.amount) ||
      typeof row.description !== 'string'
    ) {
      throw new Error('INVALID_ANALYSIS');
    }
    return {
      date: row.date.slice(0, 20),
      amount: row.amount,
      description: row.description.slice(0, 160),
      time: typeof row.time === 'string' ? row.time.slice(0, 20) : undefined,
      type: typeof row.type === 'string' ? row.type.slice(0, 80) : undefined,
      reference: typeof row.reference === 'string' ? row.reference.slice(0, 100) : undefined,
    };
  });
}

export async function authorizeEzPassAi(request: Request) {
  const auth = await authenticateApiRequest(request);
  if (isApiRequestBlocked(auth)) {
    return { response: Response.json(
      { error: 'Sign in is required for E-ZPass AI parsing.', code: 'PERMISSION_DENIED' },
      { status: 401 },
    ) };
  }
  if (checkApiRateLimit('finance', apiRateLimitSubject(request, auth)) === 'limited') {
    return { response: Response.json(
      { error: 'E-ZPass import limit reached. Try again later.', code: 'RATE_LIMITED' },
      { status: 429 },
    ) };
  }
  return { auth };
}

export async function analyzeEzPassFiles(
  files: EzPassAiFile[],
  safetyIdentifier: string,
): Promise<EzPassAiRow[]> {
  validateEzPassAiFiles(files);
  if (!process.env.OPENAI_API_KEY) throw new Error('NOT_CONFIGURED');
  const content: Record<string, unknown>[] = [{
    type: 'input_text',
    text: [
      'Extract E-ZPass account activity from these user-provided statements or screenshots.',
      'Return every toll, parking charge, fee, replenishment, refund, and balance adjustment.',
      'Keep the printed sign when visible. Use the facility or transaction description, not account-holder details.',
      'Never return names, addresses, account numbers, tag numbers, license plates, or payment-card details.',
      'Dates should be YYYY-MM-DD when the year is available.',
      'Return the printed local transaction time when visible, including AM or PM when shown.',
    ].join('\n'),
  }];
  for (const file of files) {
    content.push(
      file.mimeType.startsWith('image/')
        ? { type: 'input_image', image_url: file.dataUrl, detail: 'high' }
        : { type: 'input_file', filename: file.name, file_data: file.dataUrl },
    );
  }
  const body = await fetchOpenAIResponses({
    model: defaultOpenAIModel(process.env.OPENAI_FINANCE_IMPORT_MODEL),
    safetyIdentifier,
    maxConcurrency: 1,
    timeoutMs: 60_000,
    payload: {
      input: [{ role: 'user', content }],
      text: {
        format: {
          type: 'json_schema',
          name: 'ezpass_activity',
          strict: true,
          schema: SCHEMA,
        },
      },
    },
  });
  return validateRows(parseOpenAIJsonResponse(body));
}
