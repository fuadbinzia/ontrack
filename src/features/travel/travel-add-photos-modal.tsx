import { View } from 'react-native';

import { Button, SheetScaffold } from '@/components/primitives';
import { useResponsive } from '@/hooks/use-responsive';
import { AgentUiIds } from '@/utils/agent-ui';
import { confirmDestructiveAction } from '@/utils/confirm-destructive';

export type TravelAddPhotosModalProps = {
  visible: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  onTakePhoto: () => void;
  onChooseFromPhotos: () => void;
  onRemovePhoto?: () => void;
  removeLabel?: string;
};

/** Canonical photo action sheet; feature identity stays in content, not control styling. */
export function TravelAddPhotosModal({
  visible,
  onClose,
  title = 'Add Photos',
  subtitle = 'Attach pictures to this timeline entry.',
  onTakePhoto,
  onChooseFromPhotos,
  onRemovePhoto,
  removeLabel = 'Remove Photo',
}: TravelAddPhotosModalProps) {
  const { spacing } = useResponsive();
  // Invoke the action first so hosts can snapshot item ids, then dismiss.
  // pick-image settles briefly before presenting the system picker so this
  // SheetScaffold Modal is unmounted (present-over-Modal races on iOS).
  const runAndClose = (action: () => void) => {
    action();
    onClose();
  };
  const confirmRemove = () => {
    if (!onRemovePhoto) return;
    confirmDestructiveAction({
      title: `${removeLabel}?`,
      message: 'This removes the photo from this travel item.',
      actionLabel: removeLabel,
      confirmTestID: AgentUiIds.travel.addPhotos.confirmRemovePhoto,
      onConfirm: () => runAndClose(onRemovePhoto),
    });
  };

  return (
    <SheetScaffold
      visible={visible}
      eyebrow="Photos"
      title={title}
      subtitle={subtitle}
      onClose={onClose}
      closeAccessibilityLabel="Close photo actions"
      closeTestID={AgentUiIds.travel.addPhotos.close}
      surface="glass">
      <View style={{ gap: spacing.md }}>
        <Button
          variant="primary"
          icon="camera"
          testID={AgentUiIds.travel.addPhotos.takePhoto}
          accessibilityLabel="Take Photo"
          onPress={() => runAndClose(onTakePhoto)}>
          Take Photo
        </Button>
        <Button
          variant="secondary"
          icon="photo"
          testID={AgentUiIds.travel.addPhotos.chooseFromPhotos}
          accessibilityLabel="Choose from Photos"
          onPress={() => runAndClose(onChooseFromPhotos)}>
          Choose from Photos
        </Button>
        {onRemovePhoto ? (
          <Button
            variant="danger"
            icon="delete"
            testID={AgentUiIds.travel.addPhotos.removePhoto}
            accessibilityLabel={removeLabel}
            onPress={confirmRemove}>
            {removeLabel}
          </Button>
        ) : null}
      </View>
    </SheetScaffold>
  );
}
