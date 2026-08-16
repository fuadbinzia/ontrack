import { useEffect, useRef } from 'react';
import {
  AccessibilityInfo,
  findNodeHandle,
  Platform,
  type Text,
} from 'react-native';

import { isOperationalErrorMessage, reportOperationalFailure, userVisibleError } from '@/utils/operational-error';

import { AppText, type AppTextProps } from './app-text';

export interface ErrorMessageProps
  extends Omit<AppTextProps, 'accessibilityLabel' | 'accessibilityRole' | 'children' | 'color'> {
  message: string;
}

export function ErrorMessage({
  message,
  variant = 'callout',
  ...rest
}: ErrorMessageProps) {
  const ref = useRef<Text>(null);
  const visible = userVisibleError(message);

  useEffect(() => {
    if (!visible) {
      if (isOperationalErrorMessage(message)) {
        reportOperationalFailure(message, 'ui.error-message');
      }
      return;
    }
    const timeout = setTimeout(() => {
      if (Platform.OS !== 'web') {
        const reactTag = findNodeHandle(ref.current);
        if (reactTag) AccessibilityInfo.setAccessibilityFocus(reactTag);
      }
      AccessibilityInfo.announceForAccessibility(`Error: ${visible}`);
    }, 100);

    return () => clearTimeout(timeout);
  }, [message, visible]);

  if (!visible) return null;

  return (
    <AppText
      ref={ref}
      variant={variant}
      color="danger"
      accessibilityLabel={`Error: ${visible}`}
      accessibilityRole="alert"
      accessibilityLiveRegion="assertive"
      {...rest}
    >
      {visible}
    </AppText>
  );
}
