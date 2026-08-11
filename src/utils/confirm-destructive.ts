import type { ModalProps } from 'react-native';

import { appPrompt } from '@/components/primitives';

/**
 * Standard destructive confirm: Cancel + destructive action.
 * Prefer this over ad-hoc appPrompt.alert for delete/clear flows.
 */
export function confirmDestructiveAction(options: {
  title: string;
  message?: string;
  actionLabel?: string;
  confirmTestID?: string;
  supportedOrientations?: ModalProps['supportedOrientations'];
  onConfirm: () => void;
}): void {
  const actions = [
    { text: 'Cancel', style: 'cancel' as const },
    {
      text: options.actionLabel ?? 'Delete',
      style: 'destructive' as const,
      ...(options.confirmTestID ? { testID: options.confirmTestID } : {}),
      onPress: options.onConfirm,
    },
  ];
  if (options.supportedOrientations) {
    appPrompt.alert(options.title, options.message, actions, {
      supportedOrientations: options.supportedOrientations,
    });
    return;
  }
  appPrompt.alert(options.title, options.message, actions);
}
