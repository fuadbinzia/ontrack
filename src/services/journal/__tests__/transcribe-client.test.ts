const mockApiRequest = jest.fn();

jest.mock('@/services/http/api-client', () => ({
  apiRequest: (...args: unknown[]) => mockApiRequest(...args),
}));

jest.mock('@/services/http/api-url', () => ({
  resolveExpoApiUrl: (path: string) => `https://example.test${path}`,
}));

import { JournalTranscribeError, requestJournalTranscribe } from '../transcribe-client';

describe('journal transcribe client', () => {
  beforeEach(() => {
    mockApiRequest.mockReset();
  });

  it('posts audio to the journal transcribe route', async () => {
    mockApiRequest.mockResolvedValue({ text: 'Morning light' });
    await expect(requestJournalTranscribe('data:audio/m4a;base64,YQ==')).resolves.toEqual({
      text: 'Morning light',
    });
    expect(mockApiRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        url: 'https://example.test/journal/transcribe',
        body: { audioDataUrl: 'data:audio/m4a;base64,YQ==' },
        offlineMessage: 'Connect to the internet to dictate.',
      }),
    );
  });

  it('surfaces offline and provider failures as journal errors', async () => {
    mockApiRequest.mockRejectedValue(
      new JournalTranscribeError('Connect to the internet to dictate.', 'OFFLINE'),
    );
    await expect(requestJournalTranscribe('data:audio/m4a;base64,YQ==')).rejects.toMatchObject({
      code: 'OFFLINE',
    });
  });
});
