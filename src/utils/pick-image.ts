import * as ImageManipulator from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { Platform } from 'react-native';

import { appPrompt } from '@/components/primitives';
import { promptOpenAppSettings } from '@/utils/prompt-open-settings';

export type PickImageOptions = {
  quality?: number;
  allowsEditing?: boolean;
  aspect?: [number, number];
  /**
   * Force UIImagePickerController on iOS (skips PHPicker). More reliable for
   * Simulator sample photos and iCloud-only assets; single selection only.
   */
  legacy?: boolean;
  /** Shown when camera permission is denied (settings prompt). */
  cameraDeniedMessage?: string;
  /** Shown when library permission is denied (settings prompt). */
  libraryDeniedMessage?: string;
  /**
   * When set, called instead of the Settings prompt on denial.
   * Use for screens that surface their own ErrorMessage.
   */
  onDenied?: () => void;
};

export type PickedImageAsset = {
  uri: string;
  fileName?: string;
  fileSize?: number;
};

export type PickLibraryImagesOptions = PickImageOptions & {
  /** Max images when multi-select is enabled. */
  selectionLimit?: number;
  allowsMultipleSelection?: boolean;
  orderedSelection?: boolean;
};

const DEFAULT_CAMERA_DENIED =
  'Allow camera access in Settings to take a photo.';
const DEFAULT_LIBRARY_DENIED =
  'Allow photo library access in Settings to choose an image.';

/** Beat for host RN Modals (e.g. Add Photos) to unmount before the system picker presents. */
const PICKER_HOST_SETTLE_MS = 50;

function cameraLaunchOptions(options: PickImageOptions = {}) {
  return {
    mediaTypes: ['images'] as ImagePicker.MediaType[],
    quality: options.quality ?? 0.9,
    allowsEditing: options.allowsEditing ?? false,
    aspect: options.aspect,
  };
}

/**
 * Library launch options.
 * - Native quality stays 1 so iOS can use the PHPicker fast-path when not legacy.
 * - Default to legacy UIImagePicker on iOS for single-select (PHPicker fails on
 *   many Simulator / iCloud-only assets with CloudPhotoLibraryErrorDomain 1006).
 */
function libraryLaunchOptions(
  options: PickLibraryImagesOptions = {},
  multi: boolean,
) {
  const legacy =
    options.legacy ?? (Platform.OS === 'ios' && !multi);
  return {
    mediaTypes: ['images'] as ImagePicker.MediaType[],
    quality: 1,
    allowsEditing: options.allowsEditing ?? false,
    aspect: options.aspect,
    legacy,
    preferredAssetRepresentationMode:
      ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Compatible,
    shouldDownloadFromNetwork: true,
  };
}

async function settleBeforeSystemPicker() {
  await new Promise<void>((resolve) =>
    setTimeout(resolve, PICKER_HOST_SETTLE_MS),
  );
}

async function maybeCompressAsset(
  asset: ImagePicker.ImagePickerAsset,
  quality: number | undefined,
): Promise<PickedImageAsset> {
  const compress = quality ?? 1;
  if (compress >= 1) {
    return {
      uri: asset.uri,
      fileName: asset.fileName ?? undefined,
      fileSize: asset.fileSize,
    };
  }
  const jpeg = await ImageManipulator.manipulateAsync(asset.uri, [], {
    compress,
    format: ImageManipulator.SaveFormat.JPEG,
  });
  const baseName = asset.fileName?.replace(/\.[^.]+$/, '');
  return {
    uri: jpeg.uri,
    fileName: baseName ? `${baseName}.jpg` : undefined,
    fileSize: asset.fileSize,
  };
}

function handleDenied(
  options: PickImageOptions,
  title: string,
  message: string,
) {
  if (options.onDenied) {
    options.onDenied();
    return;
  }
  promptOpenAppSettings(title, message);
}

function handlePickFailure(error: unknown, action: 'camera' | 'library') {
  if (__DEV__) {
    console.warn(`[pick-image] ${action} failed`, error);
  }
  const detail = error instanceof Error ? error.message : String(error ?? '');
  const cloudLocked =
    /CloudPhotoLibrary|iCloud|public\.(png|image|jpeg)|Failed to read/i.test(
      detail,
    );
  appPrompt.alert(
    'Couldn’t add photo',
    cloudLocked
      ? 'That photo isn’t available on this device (it may still be in iCloud). Take a new one, or choose a photo that’s already downloaded.'
      : 'That image couldn’t be read. Try another photo, or take a new one.',
  );
}

/** Returns a local image URI from the camera, or undefined if cancelled/denied. */
export async function pickCameraImage(
  options: PickImageOptions = {},
): Promise<string | undefined> {
  try {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      handleDenied(
        options,
        'Camera access needed',
        options.cameraDeniedMessage ?? DEFAULT_CAMERA_DENIED,
      );
      return undefined;
    }
    await settleBeforeSystemPicker();
    const result = await ImagePicker.launchCameraAsync(
      cameraLaunchOptions(options),
    );
    if (result.canceled) return undefined;
    return result.assets[0]?.uri;
  } catch (error) {
    handlePickFailure(error, 'camera');
    return undefined;
  }
}

/** Returns a local image URI from the library, or undefined if cancelled/denied. */
export async function pickLibraryImage(
  options: PickImageOptions = {},
): Promise<string | undefined> {
  const assets = await pickLibraryImages({
    ...options,
    allowsMultipleSelection: false,
    selectionLimit: 1,
  });
  return assets?.[0]?.uri;
}

/**
 * Returns one or more library images, or undefined if cancelled/denied.
 * Use for multi-select flows (e.g. flight confirmation screenshots).
 */
export async function pickLibraryImages(
  options: PickLibraryImagesOptions = {},
): Promise<PickedImageAsset[] | undefined> {
  const multi = Boolean(
    options.allowsMultipleSelection && (options.selectionLimit ?? 0) !== 1,
  );
  try {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      handleDenied(
        options,
        'Photos access needed',
        options.libraryDeniedMessage ?? DEFAULT_LIBRARY_DENIED,
      );
      return undefined;
    }
    await settleBeforeSystemPicker();
    const result = await ImagePicker.launchImageLibraryAsync({
      ...libraryLaunchOptions(options, multi),
      allowsMultipleSelection: multi,
      orderedSelection: multi ? (options.orderedSelection ?? false) : false,
      selectionLimit: multi ? options.selectionLimit : 1,
    });
    if (result.canceled) return undefined;
    const assets: PickedImageAsset[] = [];
    for (const asset of result.assets) {
      assets.push(await maybeCompressAsset(asset, options.quality));
    }
    return assets;
  } catch (error) {
    // Multi PHPicker often fails on iCloud-only assets — retry once via legacy single pick.
    if (multi && Platform.OS === 'ios') {
      if (__DEV__) {
        console.warn('[pick-image] multi failed; retrying legacy single', error);
      }
      try {
        await settleBeforeSystemPicker();
        const retry = await ImagePicker.launchImageLibraryAsync({
          ...libraryLaunchOptions({ ...options, legacy: true }, false),
          allowsMultipleSelection: false,
          selectionLimit: 1,
        });
        if (retry.canceled) return undefined;
        const assets: PickedImageAsset[] = [];
        for (const asset of retry.assets) {
          assets.push(await maybeCompressAsset(asset, options.quality));
        }
        return assets;
      } catch (retryError) {
        handlePickFailure(retryError, 'library');
        return undefined;
      }
    }
    handlePickFailure(error, 'library');
    return undefined;
  }
}
