import * as ImagePicker from 'expo-image-picker';
import { Platform } from 'react-native';

import { pickLibraryImages } from '@/utils/pick-image';

jest.mock('expo-image-picker', () => ({
  requestMediaLibraryPermissionsAsync: jest.fn(async () => ({
    granted: true,
  })),
  launchImageLibraryAsync: jest.fn(async () => ({
    canceled: false,
    assets: [{ uri: 'file:///tmp/photo.heic', fileName: 'photo.heic', fileSize: 12 }],
  })),
  UIImagePickerPreferredAssetRepresentationMode: {
    Automatic: 'automatic',
    Compatible: 'compatible',
    Current: 'current',
  },
}));

jest.mock('expo-image-manipulator', () => ({
  SaveFormat: { JPEG: 'jpeg' },
  manipulateAsync: jest.fn(async (uri: string) => ({ uri: `${uri}.jpg` })),
}));

jest.mock('@/components/primitives', () => ({
  appPrompt: { alert: jest.fn() },
}));

describe('pickLibraryImages', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    Platform.OS = 'ios';
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('uses iOS legacy UIImagePicker for single-select library picks', async () => {
    const pending = pickLibraryImages({ quality: 0.9 });
    await jest.advanceTimersByTimeAsync(50);
    const assets = await pending;

    expect(ImagePicker.launchImageLibraryAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        quality: 1,
        legacy: true,
        allowsMultipleSelection: false,
        preferredAssetRepresentationMode: 'compatible',
        shouldDownloadFromNetwork: true,
      }),
    );
    expect(assets?.[0]?.uri).toBe('file:///tmp/photo.heic.jpg');
  });

  it('skips re-encode when quality is omitted or 1', async () => {
    const pending = pickLibraryImages();
    await jest.advanceTimersByTimeAsync(50);
    const assets = await pending;

    expect(assets?.[0]?.uri).toBe('file:///tmp/photo.heic');
  });

  it('keeps PHPicker multi-select (legacy off) when requested', async () => {
    const pending = pickLibraryImages({
      allowsMultipleSelection: true,
      selectionLimit: 8,
    });
    await jest.advanceTimersByTimeAsync(50);
    await pending;

    expect(ImagePicker.launchImageLibraryAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        allowsMultipleSelection: true,
        selectionLimit: 8,
        legacy: false,
      }),
    );
  });
});
