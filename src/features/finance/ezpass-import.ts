import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import * as XLSX from 'xlsx';

import { recognizeDocumentText } from '@/services/document-text';
import { pickLibraryImages } from '@/utils/pick-image';

import {
  parseDelimitedText,
  parseEzPassRows,
  parseEzPassText,
  type EzPassParseResult,
} from './ezpass-parser';

const MAX_FILE_BYTES = 20 * 1024 * 1024;
const MAX_SCREENSHOTS = 6;

export interface EzPassImportAsset {
  uri: string;
  name: string;
  mimeType?: string;
  size?: number;
}

export async function pickEzPassDocument(): Promise<EzPassImportAsset[] | undefined> {
  const result = await DocumentPicker.getDocumentAsync({
    type: [
      'text/csv',
      'text/tab-separated-values',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/pdf',
      'image/*',
    ],
    copyToCacheDirectory: true,
    multiple: false,
  });
  if (result.canceled || !result.assets[0]) return undefined;
  const asset = result.assets[0];
  return [{
    uri: asset.uri,
    name: asset.name || 'E-ZPass activity',
    mimeType: asset.mimeType ?? undefined,
    size: asset.size,
  }];
}

export async function pickEzPassScreenshots(): Promise<EzPassImportAsset[] | undefined> {
  const assets = await pickLibraryImages({
    quality: 1,
    allowsEditing: false,
    allowsMultipleSelection: true,
    orderedSelection: true,
    selectionLimit: MAX_SCREENSHOTS,
    onDenied: () => {
      throw new Error('Photo library access is required to choose E-ZPass screenshots.');
    },
  });
  return assets?.map((asset, index) => ({
    uri: asset.uri,
    name: asset.fileName ?? `E-ZPass screenshot ${index + 1}`,
    mimeType: 'image/jpeg',
    size: asset.fileSize,
  }));
}

function extension(asset: EzPassImportAsset): string {
  return asset.name.split(/[?#]/, 1)[0].split('.').pop()?.toLowerCase() ?? '';
}

function assertImportLimits(assets: EzPassImportAsset[]) {
  if (!assets.length) throw new Error('Choose at least one E-ZPass file or screenshot.');
  if (assets.length > MAX_SCREENSHOTS) {
    throw new Error(`Choose no more than ${MAX_SCREENSHOTS} screenshots at once.`);
  }
  if (assets.some((asset) => asset.size && asset.size > MAX_FILE_BYTES)) {
    throw new Error('Each E-ZPass file must be smaller than 20 MB.');
  }
}

export async function parseEzPassWorkbookBytes(bytes: ArrayBuffer): Promise<EzPassParseResult> {
  const workbook = XLSX.read(bytes, { type: 'array', cellDates: false });
  const activities = [];
  let skippedRows = 0;
  for (const name of workbook.SheetNames) {
    const sheet = workbook.Sheets[name];
    if (!sheet) continue;
    const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
      header: 1,
      raw: false,
      blankrows: false,
    });
    const parsed = parseEzPassRows(rows);
    activities.push(...parsed.activities);
    skippedRows += parsed.skippedRows;
  }
  return { activities, skippedRows };
}

async function parseWorkbook(asset: EzPassImportAsset): Promise<EzPassParseResult> {
  return parseEzPassWorkbookBytes(await new File(asset.uri).arrayBuffer());
}

export async function parseEzPassAssets(
  assets: EzPassImportAsset[],
): Promise<EzPassParseResult> {
  assertImportLimits(assets);
  const activities = [];
  let skippedRows = 0;
  for (const asset of assets) {
    const ext = extension(asset);
    let result: EzPassParseResult;
    if (ext === 'xlsx' || ext === 'xls') {
      result = await parseWorkbook(asset);
    } else if (ext === 'csv' || ext === 'tsv') {
      const text = await new File(asset.uri).text();
      result = parseEzPassRows(parseDelimitedText(text, ext === 'tsv' ? '\t' : ','));
    } else {
      result = parseEzPassText(await recognizeDocumentText(asset.uri));
    }
    activities.push(...result.activities);
    skippedRows += result.skippedRows;
  }
  return { activities, skippedRows };
}

export async function ezPassAssetsAsDataUrls(
  assets: EzPassImportAsset[],
): Promise<{ name: string; mimeType: string; dataUrl: string }[]> {
  assertImportLimits(assets);
  return Promise.all(
    assets.map(async (asset, index) => {
      const ext = extension(asset);
      const mimeType = asset.mimeType ?? (
        ext === 'pdf' ? 'application/pdf' : ext === 'png' ? 'image/png' : 'image/jpeg'
      );
      return {
        name: `ezpass-statement-${index + 1}.${ext || (mimeType === 'application/pdf' ? 'pdf' : 'jpg')}`,
        mimeType,
        dataUrl: `data:${mimeType};base64,${await new File(asset.uri).base64()}`,
      };
    }),
  );
}
