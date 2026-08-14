import type { EzPassImportAsset } from './ezpass-import';

const SUPPORTED_DOCUMENT_EXTENSIONS = new Set(['csv', 'tsv', 'xls', 'xlsx', 'pdf']);

const MIME_TYPE_BY_EXTENSION: Record<string, string> = {
  csv: 'text/csv',
  tsv: 'text/tab-separated-values',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  pdf: 'application/pdf',
};

function documentName(uri: string): string {
  const encoded = uri.split(/[?#]/, 1)[0].split('/').pop() || 'E-ZPass statement';
  try {
    return decodeURIComponent(encoded);
  } catch {
    return encoded;
  }
}

export function ezPassAssetFromDocumentUrl(uri: string): EzPassImportAsset | undefined {
  if (!/^(?:file|content):\/\//i.test(uri)) return undefined;
  const name = documentName(uri);
  const extension = name.split('.').pop()?.toLowerCase() ?? '';
  if (!SUPPORTED_DOCUMENT_EXTENSIONS.has(extension)) return undefined;
  return {
    uri,
    name,
    mimeType: MIME_TYPE_BY_EXTENSION[extension],
  };
}

export function incomingEzPassDocumentDestination(uri: string) {
  return ezPassAssetFromDocumentUrl(uri)
    ? {
        pathname: '/(tabs)/finance/ezpass-import',
        params: { source: 'document', uri },
      }
    : undefined;
}

export function nextIncomingEzPassDocumentUri(
  source: string | undefined,
  uri: string | undefined,
  lastStartedUri: string | undefined,
): string | undefined {
  if (source !== 'document' || !uri || uri === lastStartedUri) return undefined;
  return uri;
}
