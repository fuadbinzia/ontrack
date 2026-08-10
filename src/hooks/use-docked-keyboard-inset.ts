import { useEffect, useState } from 'react';
import {
  Keyboard,
  Platform,
  useWindowDimensions,
  type KeyboardEvent,
} from 'react-native';

export type DockedKeyboardAndroidMode = 'resize' | 'modal';

export type DockedKeyboardInsetOptions = {
  /** When false, inset stays 0 (e.g. sheet not visible). Default true. */
  enabled?: boolean;
  /**
   * `resize` — Android `adjustResize` already shrinks the root; inset stays 0
   *   (in-tree screens / overlays). Default.
   * `modal` — RN Modal ignores soft-input; lift on Android too (SheetScaffold).
   */
  androidMode?: DockedKeyboardAndroidMode;
};

/**
 * Pure inset from a keyboard event — shared by the hook + unit tests.
 * iOS / modal-Android: distance from window bottom to docked IME top.
 * Never subtracts safe-area (that under-lifts chrome into the keyboard).
 */
export function dockedKeyboardInsetFromEvent(
  event: Pick<KeyboardEvent, 'endCoordinates'>,
  options: {
    windowHeight: number;
    windowWidth: number;
    platform?: typeof Platform.OS;
    androidMode?: DockedKeyboardAndroidMode;
  },
): { keyboardInset: number; keyboardOpen: boolean } {
  const platform = options.platform ?? Platform.OS;
  const androidMode = options.androidMode ?? 'resize';
  const { height: kbHeight, screenY, width: kbWidth } = event.endCoordinates;
  const fullWidth = kbWidth >= options.windowWidth * 0.8;
  if (!fullWidth || kbHeight <= 0) {
    return { keyboardInset: 0, keyboardOpen: false };
  }
  if (platform === 'android' && androidMode === 'resize') {
    return { keyboardInset: 0, keyboardOpen: true };
  }
  const fromScreenY = Math.max(0, options.windowHeight - screenY);
  const fromHeight = Math.max(0, kbHeight);
  return {
    keyboardOpen: true,
    keyboardInset: fromScreenY > 0 ? fromScreenY : fromHeight,
  };
}

/**
 * Docked bottom chrome / sheets: keep inputs clear of the soft keyboard.
 * Prefer this over ad-hoc under-lift math that subtracts the home-indicator inset.
 */
export function useDockedKeyboardInset(
  options: DockedKeyboardInsetOptions = {},
): { keyboardInset: number; keyboardOpen: boolean } {
  const enabled = options.enabled ?? true;
  const androidMode = options.androidMode ?? 'resize';
  const { height: windowHeight, width: windowWidth } = useWindowDimensions();
  const [keyboardInset, setKeyboardInset] = useState(0);
  const [keyboardOpen, setKeyboardOpen] = useState(false);

  useEffect(() => {
    if (!enabled) {
      setKeyboardInset(0);
      setKeyboardOpen(false);
      return;
    }
    const showEvent =
      Platform.OS === 'ios' ? 'keyboardWillChangeFrame' : 'keyboardDidShow';
    const hideEvent =
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const updateInset = (event: KeyboardEvent) => {
      Keyboard.scheduleLayoutAnimation(event);
      const next = dockedKeyboardInsetFromEvent(event, {
        windowHeight,
        windowWidth,
        androidMode,
      });
      setKeyboardOpen(next.keyboardOpen);
      setKeyboardInset(next.keyboardInset);
    };
    const showSubscription = Keyboard.addListener(showEvent, updateInset);
    const hideSubscription = Keyboard.addListener(hideEvent, () => {
      setKeyboardOpen(false);
      setKeyboardInset(0);
    });
    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, [androidMode, enabled, windowHeight, windowWidth]);

  return { keyboardInset, keyboardOpen };
}
