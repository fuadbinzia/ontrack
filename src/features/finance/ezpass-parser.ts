import type { FinanceTransactionActivity } from './types';

export {
  deduplicateEzPassDrafts,
  deduplicateEzPassDraftsAgainstTransactions,
  deduplicateEzPassTransactions,
  ezPassCrossFormatDuplicateKey,
  ezPassProbableKeyForTransaction,
} from './ezpass-deduplication';

export type EzPassActivityKind =
  | 'toll'
  | 'parking'
  | 'fee'
  | 'replenishment'
  | 'refund'
  | 'adjustment';

export interface EzPassActivityDraft {
  fingerprint: string;
  probableDuplicateKey: string;
  date: string;
  activityTime?: string;
  amount: number;
  merchant: string;
  activity: FinanceTransactionActivity;
  kind: EzPassActivityKind;
  notes?: string;
  confidence: 'high' | 'review';
}

export interface EzPassParseResult {
  activities: EzPassActivityDraft[];
  skippedRows: number;
}

const DATE_HEADERS = ['date', 'transaction date', 'posting date', 'posted date', 'trip date'];
const AMOUNT_HEADERS = ['amount', 'transaction amount', 'charge', 'toll', 'debit', 'credit'];
const DESCRIPTION_HEADERS = [
  'description',
  'facility',
  'location',
  'plaza',
  'agency',
  'transaction',
];
const TYPE_HEADERS = ['type', 'transaction type', 'activity', 'entry type'];
const REFERENCE_HEADERS = ['reference', 'reference number', 'transaction id', 'trip id'];
const TIME_HEADERS = ['time', 'transaction time', 'exit time', 'entry time', 'trip time'];

function normalizedHeader(value: unknown): string {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ');
}

function headerIndex(headers: string[], aliases: string[]): number {
  return headers.findIndex((header) =>
    aliases.some((alias) => header === alias || header.endsWith(` ${alias}`)),
  );
}

function parseDate(value: unknown): string | undefined {
  const text = String(value ?? '').trim();
  let match = text.match(/^(\d{4})[-/]([01]?\d)[-/]([0-3]?\d)(?:\D|$)/);
  let year: number;
  let month: number;
  let day: number;
  if (match) {
    year = Number(match[1]);
    month = Number(match[2]);
    day = Number(match[3]);
  } else {
    match = text.match(/^([01]?\d)[-/]([0-3]?\d)[-/](\d{2}|\d{4})(?:\D|$)/);
    if (!match) return undefined;
    month = Number(match[1]);
    day = Number(match[2]);
    const rawYear = Number(match[3]);
    year = rawYear < 100 ? 2000 + rawYear : rawYear;
  }
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return undefined;
  }
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function parseAmount(value: unknown): number | undefined {
  const text = String(value ?? '').trim();
  if (!text) return undefined;
  const parenthesized = /^\(.*\)$/.test(text);
  const parsed = Number(text.replace(/[$,()\s]/g, ''));
  if (!Number.isFinite(parsed)) return undefined;
  return parenthesized ? -Math.abs(parsed) : parsed;
}

function parseTime(value: unknown): string | undefined {
  const text = String(value ?? '').trim();
  const match = text.match(/\b(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?\b/i);
  if (!match) return undefined;
  let hour = Number(match[1]);
  const minute = Number(match[2]);
  const second = Number(match[3] ?? 0);
  const meridiem = match[4]?.toUpperCase();
  if (minute > 59 || second > 59 || (meridiem ? hour < 1 || hour > 12 : hour > 23)) {
    return undefined;
  }
  if (meridiem === 'AM') hour %= 12;
  if (meridiem === 'PM') hour = (hour % 12) + 12;
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:${String(second).padStart(2, '0')}`;
}

function titleCase(value: string): string {
  return value
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

const VEHICLE_STATE_CODES =
  'AL|AK|AZ|AR|CA|CO|CT|DE|FL|GA|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VT|VA|WA|WV|WI|WY|DC';

function sanitizeReportDescription(value: string): string {
  return value
    .replace(/\b\d{8,}\b/g, ' ')
    .replace(new RegExp(`\\b(?:${VEHICLE_STATE_CODES})\\s+[A-Z0-9-]{4,10}\\b`, 'gi'), ' ')
    .replace(/\b\d{1,2}\b\s*$/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function classifyActivity(description: string): {
  kind: EzPassActivityKind;
  activity: FinanceTransactionActivity;
} {
  const value = description.toLowerCase();
  if (/refund|credit issued|reversal|toll credit/.test(value)) {
    return { kind: 'refund', activity: 'refund' };
  }
  if (/parking|airport/.test(value)) return { kind: 'parking', activity: 'expense' };
  if (/fee|administrative|returned payment/.test(value)) {
    return { kind: 'fee', activity: 'expense' };
  }
  if (/replenish|payment received|credit card payment|ach payment|account funding|\bpayment\b/.test(value)) {
    return { kind: 'replenishment', activity: 'transfer' };
  }
  if (/adjust|correction|balance forward|opening balance|closing balance/.test(value)) {
    return { kind: 'adjustment', activity: 'adjustment' };
  }
  return { kind: 'toll', activity: 'expense' };
}

function stableHash(value: string): string {
  let first = 0x811c9dc5;
  let second = 0x9e3779b9;
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    first = Math.imul(first ^ code, 0x01000193);
    second = Math.imul(second ^ code, 0x85ebca6b);
  }
  return `${(first >>> 0).toString(16).padStart(8, '0')}${(second >>> 0)
    .toString(16)
    .padStart(8, '0')}`;
}

function normalizeActivity(input: {
  date: unknown;
  amount: unknown;
  description: unknown;
  type?: unknown;
  reference?: unknown;
  time?: unknown;
  confidence?: 'high' | 'review';
}): EzPassActivityDraft | undefined {
  const date = parseDate(input.date);
  const rawAmount = parseAmount(input.amount);
  if (!date || rawAmount === undefined || rawAmount === 0) return undefined;
  const rawDescription = [input.type, input.description]
    .map((value) => String(value ?? '').trim())
    .filter(Boolean)
    .join(' · ');
  if (!rawDescription) return undefined;
  const { kind, activity } = classifyActivity(rawDescription);
  const amount =
    activity === 'refund'
      ? -Math.abs(rawAmount)
      : activity === 'expense' || activity === 'transfer'
        ? Math.abs(rawAmount)
        : rawAmount;
  const merchant = titleCase(String(input.description ?? input.type ?? 'E-ZPass NY'));
  const reference = String(input.reference ?? '').trim();
  const activityTime = parseTime(input.time ?? input.date);
  const canonical = [date, amount.toFixed(2), kind, merchant.toLowerCase(), reference].join('|');
  return {
    fingerprint: `ezpass:${stableHash(canonical)}`,
    probableDuplicateKey: [date, amount.toFixed(2), kind, merchant.toLowerCase()].join('|'),
    date,
    activityTime,
    amount,
    merchant: merchant || 'E-ZPass NY',
    activity,
    kind,
    notes: `E-ZPass ${titleCase(kind)}`,
    confidence: input.confidence ?? 'high',
  };
}

export function parseDelimitedText(text: string, delimiter?: ',' | '\t'): string[][] {
  const selected = delimiter ?? (text.includes('\t') ? '\t' : ',');
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (char === '"') {
      if (quoted && text[index + 1] === '"') {
        cell += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (char === selected && !quoted) {
      row.push(cell);
      cell = '';
    } else if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && text[index + 1] === '\n') index += 1;
      row.push(cell);
      if (row.some((value) => value.trim())) rows.push(row);
      row = [];
      cell = '';
    } else {
      cell += char;
    }
  }
  row.push(cell);
  if (row.some((value) => value.trim())) rows.push(row);
  return rows;
}

export function parseEzPassRows(rows: unknown[][]): EzPassParseResult {
  const headerRowIndex = rows.slice(0, 12).findIndex((row) => {
    const headers = row.map(normalizedHeader);
    return headerIndex(headers, DATE_HEADERS) >= 0 && headerIndex(headers, AMOUNT_HEADERS) >= 0;
  });
  if (headerRowIndex < 0) return { activities: [], skippedRows: rows.length };
  const headers = rows[headerRowIndex].map(normalizedHeader);
  const dateIndex = headerIndex(headers, DATE_HEADERS);
  const amountIndex = headerIndex(headers, AMOUNT_HEADERS);
  const descriptionIndex = headerIndex(headers, DESCRIPTION_HEADERS);
  const typeIndex = headerIndex(headers, TYPE_HEADERS);
  const referenceIndex = headerIndex(headers, REFERENCE_HEADERS);
  const timeIndex = headerIndex(headers, TIME_HEADERS);
  const activities: EzPassActivityDraft[] = [];
  let skippedRows = 0;
  for (const row of rows.slice(headerRowIndex + 1)) {
    const draft = normalizeActivity({
      date: row[dateIndex],
      amount: row[amountIndex],
      description:
        descriptionIndex >= 0 ? row[descriptionIndex] : typeIndex >= 0 ? row[typeIndex] : '',
      type: typeIndex >= 0 ? row[typeIndex] : undefined,
      reference: referenceIndex >= 0 ? row[referenceIndex] : undefined,
      time: timeIndex >= 0 ? row[timeIndex] : row[dateIndex],
    });
    if (draft) activities.push(draft);
    else if (row.some((value) => String(value ?? '').trim())) skippedRows += 1;
  }
  return { activities, skippedRows };
}

export function parseEzPassText(text: string): EzPassParseResult {
  if (text.includes(',') || text.includes('\t')) {
    const structured = parseEzPassRows(parseDelimitedText(text));
    if (structured.activities.length) return structured;
  }
  const activities: EzPassActivityDraft[] = [];
  let skippedRows = 0;
  const lines = text.split(/\r?\n/).map((rawLine) => rawLine.trim().replace(/\s+/g, ' '));
  const datePattern = /(?:\d{4}[-/]\d{1,2}[-/]\d{1,2}|\d{1,2}[-/]\d{1,2}[-/]\d{2,4})/;
  const amountPattern = /(?:\(\s*)?(?:[-+]\s*)?(?:\$\s*)?(?:[-+]\s*)?\d{1,4}(?:,\d{3})*(?:\.\d{2})\s*\)?/g;
  const amountOnlyPattern = /^(?:\(\s*)?(?:[-+]\s*)?(?:\$\s*)?(?:[-+]\s*)?\d{1,4}(?:,\d{3})*(?:\.\d{2})\s*\)?$/;
  const timePattern = /\b\d{1,2}:\d{2}(?::\d{2})?\s*(?:AM|PM)?\b/gi;
  const adjacentDescription = (lineIndex: number): string | undefined => {
    for (const offset of [1, -1, 2, -2]) {
      const candidate = lines[lineIndex + offset]?.trim();
      if (!candidate || !/[a-z]/i.test(candidate)) continue;
      if (datePattern.test(candidate) || [...candidate.matchAll(amountPattern)].length) continue;
      if (
        /^(?:am|pm|date|amount|balance|description|transaction|type|page\b)$/i.test(candidate) ||
        /^(?:date|amount|balance|description|transaction|type|page\b)/i.test(candidate) ||
        /\b(?:account|tag|plate|vehicle|address|customer)\b/i.test(candidate)
      ) {
        continue;
      }
      return candidate.slice(0, 160);
    }
    return undefined;
  };
  for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
    const line = lines[lineIndex];
    if (!line) continue;
    const dateMatch = line.match(datePattern);
    const inlineAmountMatches = [...line.matchAll(amountPattern)].filter(
      (match) => match.index !== undefined && match.index > (dateMatch?.index ?? -1) + (dateMatch?.[0].length ?? 0),
    );
    let amountText = inlineAmountMatches[0]?.[0];
    if (!amountText && dateMatch) {
      for (let offset = 1; offset <= 3; offset += 1) {
        const candidate = lines[lineIndex + offset];
        if (!candidate || datePattern.test(candidate)) break;
        const separatedAmount = candidate.match(amountOnlyPattern);
        if (separatedAmount) {
          amountText = separatedAmount[0];
          break;
        }
      }
    }
    if (!dateMatch || !amountText || dateMatch.index === undefined) {
      continue;
    }
    const rawInlineDescription = line
      .replace(dateMatch[0], ' ')
      .replace(amountPattern, ' ')
      .replace(timePattern, ' ')
      .replace(/^\s*[|·-]\s*|\s*[|·-]\s*$/g, '')
      .replace(/\s+/g, ' ')
      .trim();
    const timeMatch = line.match(timePattern)?.[0];
    const adjacentMeridiem = timeMatch && !/\b(?:AM|PM)\b/i.test(timeMatch)
      ? lines[lineIndex + 1]?.match(/^(AM|PM)$/i)?.[1]
      : undefined;
    const isPayment = /\bpayment\b/i.test(rawInlineDescription);
    const isReportTransaction = /\b\d{8,}\b/.test(rawInlineDescription);
    const reportDescription = sanitizeReportDescription(rawInlineDescription);
    const parsedAmount = parseAmount(amountText);
    const description = isPayment
      ? 'E-ZPass NY Payment'
      : isReportTransaction && parsedAmount !== undefined && parsedAmount > 0 && reportDescription
        ? `Toll Credit · ${reportDescription}`
        : /[a-z]/i.test(reportDescription)
          ? reportDescription
          : adjacentDescription(lineIndex) ?? 'E-ZPass NY Activity';
    const draft = normalizeActivity({
      date: dateMatch[0],
      amount: amountText,
      description,
      time: timeMatch ? `${timeMatch}${adjacentMeridiem ? ` ${adjacentMeridiem}` : ''}` : undefined,
      confidence: 'review',
    });
    if (draft) activities.push(draft);
    else skippedRows += 1;
  }
  return { activities, skippedRows };
}
