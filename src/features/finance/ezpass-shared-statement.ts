import type { SharePayload } from 'expo-sharing';

import type { EzPassImportAsset } from './ezpass-import';

const EZPASS_SPREADSHEET_MIME_TYPES = new Set([
  'text/csv',
  'text/tab-separated-values',
  'application/csv',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
]);
const EZPASS_SPREADSHEET_EXTENSIONS = new Set(['csv', 'tsv', 'xls', 'xlsx']);
const EZPASS_REPORT_NAME = /(?:e[\s_-]?zpass|transaction[\s_-]?report)/i;

function payloadName(payload: SharePayload): string {
  const path = payload.value.split(/[?#]/, 1)[0];
  const encodedName = path.split('/').pop() || 'E-ZPass statement';
  try {
    return decodeURIComponent(encodedName);
  } catch {
    return encodedName;
  }
}

function payloadExtension(payload: SharePayload): string {
  return payloadName(payload).split('.').pop()?.toLowerCase() ?? '';
}

export function isEzPassStatementPayload(payload: SharePayload): boolean {
  const mimeType = payload.mimeType?.toLowerCase() ?? '';
  const extension = payloadExtension(payload);
  if (
    EZPASS_SPREADSHEET_MIME_TYPES.has(mimeType) ||
    EZPASS_SPREADSHEET_EXTENSIONS.has(extension)
  ) {
    return true;
  }
  return (
    (mimeType === 'application/pdf' || extension === 'pdf') &&
    EZPASS_REPORT_NAME.test(payloadName(payload))
  );
}

export function ezPassAssetsFromSharedPayloads(
  payloads: SharePayload[],
): EzPassImportAsset[] {
  if (!payloads.length || !payloads.every(isEzPassStatementPayload)) return [];
  return payloads.map((payload) => ({
    uri: payload.value,
    name: payloadName(payload),
    mimeType: payload.mimeType,
  }));
}
