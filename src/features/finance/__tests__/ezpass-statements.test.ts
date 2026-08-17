import * as Linking from 'expo-linking';

import { openEzPassStatement } from '../ezpass-statements';

const mockPreviewDocumentsAsync = jest.fn();

jest.mock('../../../../modules/travel-document-reader', () => ({
  __esModule: true,
  default: {
    previewDocumentsAsync: (...args: unknown[]) => mockPreviewDocumentsAsync(...args),
  },
}));

describe('openEzPassStatement', () => {
  beforeEach(() => {
    mockPreviewDocumentsAsync.mockReset();
    jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('uses TravelDocumentReader when available for file-like URLs', async () => {
    mockPreviewDocumentsAsync.mockResolvedValue(undefined);

    const opened = await openEzPassStatement(['content://example.com/statement']);

    expect(mockPreviewDocumentsAsync).toHaveBeenCalledWith(['content://example.com/statement']);
    expect(Linking.openURL).not.toHaveBeenCalled();
    expect(opened).toBe(true);
  });

  it('falls back to URL handling when the document reader throws', async () => {
    mockPreviewDocumentsAsync.mockRejectedValue(new Error('Reader failed'));

    const opened = await openEzPassStatement(['content://example.com/statement']);

    expect(mockPreviewDocumentsAsync).toHaveBeenCalledWith(['content://example.com/statement']);
    expect(Linking.openURL).toHaveBeenCalledWith('content://example.com/statement');
    expect(opened).toBe(true);
  });

  it('returns false when no statement URI can be opened', async () => {
    const opened = await openEzPassStatement(['https://example.com/statement.csv']);

    expect(opened).toBe(false);
    expect(Linking.openURL).not.toHaveBeenCalled();
  });

  it('returns false when the fallback URL open fails', async () => {
    mockPreviewDocumentsAsync.mockRejectedValue(new Error('Reader failed'));
    (Linking.openURL as jest.Mock).mockRejectedValue(new Error('Cannot open'));

    const opened = await openEzPassStatement(['content://example.com/statement']);

    expect(opened).toBe(false);
    expect(mockPreviewDocumentsAsync).toHaveBeenCalledWith(['content://example.com/statement']);
    expect(Linking.openURL).toHaveBeenCalledWith('content://example.com/statement');
  });
});
