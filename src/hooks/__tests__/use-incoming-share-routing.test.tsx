import { renderHook } from '@testing-library/react-native';
import * as Sharing from 'expo-sharing';

import {
  incomingShareDestination,
  useIncomingShareRouting,
} from '../use-incoming-share-routing';

jest.mock('expo-sharing', () => ({
  getSharedPayloads: jest.fn(),
}));

const mockGetSharedPayloads = jest.mocked(Sharing.getSharedPayloads);

describe('incoming share routing', () => {
  const csv = {
    value: 'file:///Share/Transaction_Report.csv',
    shareType: 'file' as const,
    mimeType: 'text/plain',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetSharedPayloads.mockReturnValue([]);
  });

  it('routes a CSV shared while onTrack is already open when the app becomes active', () => {
    const router = { replace: jest.fn() };
    mockGetSharedPayloads.mockReturnValue([csv]);
    const { rerender } = renderHook(
      ({ active }) => useIncomingShareRouting(active, router),
      { initialProps: { active: false } },
    );

    expect(router.replace).not.toHaveBeenCalled();
    rerender({ active: true });

    expect(router.replace).toHaveBeenCalledWith({
      pathname: '/(tabs)/finance/ezpass-import',
      params: { source: 'share' },
    });
  });

  it('keeps non-E-ZPass shares on the existing destination chooser', () => {
    expect(incomingShareDestination([{
      value: 'Dinner tomorrow at 7',
      shareType: 'text',
      mimeType: 'text/plain',
    }])).toBe('/share-import');
  });

  it('tolerates an older native build without incoming-share support', () => {
    const router = { replace: jest.fn() };
    mockGetSharedPayloads.mockImplementation(() => {
      throw new Error('Native module unavailable');
    });

    expect(() => renderHook(() => useIncomingShareRouting(true, router))).not.toThrow();
    expect(router.replace).not.toHaveBeenCalled();
  });
});
