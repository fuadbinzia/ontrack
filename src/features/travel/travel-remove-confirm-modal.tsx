import { Button, SheetScaffold } from '@/components/primitives';
import { useResponsive } from '@/hooks/use-responsive';
import { AgentUiIds } from '@/utils/agent-ui';

export type TravelRemoveConfirmPayload = {
  title: string;
  message: string;
  /** Defaults to “Remove Item”. */
  actionLabel?: string;
  confirmTestID?: string;
  onConfirm: () => void;
};

type TravelRemoveConfirmModalProps = {
  payload: TravelRemoveConfirmPayload | null;
  onCancel: () => void;
  /** Retained for call-site compatibility; sheets dismiss on backdrop by default. */
  disableBackdropDismiss?: boolean;
};

/** Canonical destructive confirmation: neutral top-right X plus one danger action. */
export function TravelRemoveConfirmModal({
  payload,
  onCancel,
  disableBackdropDismiss: _disableBackdropDismiss = false,
}: TravelRemoveConfirmModalProps) {
  const { spacing } = useResponsive();
  if (!payload) return null;

  const actionLabel = payload.actionLabel ?? 'Remove Item';
  const confirm = () => {
    const action = payload.onConfirm;
    onCancel();
    action();
  };

  return (
    <SheetScaffold
      visible
      eyebrow="Confirm"
      title={payload.title}
      subtitle={payload.message}
      onClose={onCancel}
      closeAccessibilityLabel="Cancel destructive action"
      closeTestID={AgentUiIds.travel.removeConfirm.close}
      contentContainerStyle={{ paddingTop: spacing.sm }}
      surface="glass">
      <Button
        variant="danger"
        icon="delete"
        onPress={confirm}
        testID={payload.confirmTestID ?? AgentUiIds.travel.removeConfirm.confirm}
        accessibilityLabel={actionLabel}>
        {actionLabel}
      </Button>
    </SheetScaffold>
  );
}
