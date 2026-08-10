import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  View,
  type LayoutChangeEvent,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { IconButton } from '@/components/primitives';
import { useResponsive } from '@/hooks/use-responsive';
import { useTheme } from '@/hooks/use-theme';
import { AgentTestId, AgentUiIds } from '@/utils/agent-ui';

/** Full-screen fade lightbox for a single travel photo (trip cover or moment). */
export function TravelPhotoLightbox({
  uri,
  visible,
  viewerKey,
  onClose,
}: {
  uri?: string;
  visible: boolean;
  /** Suffix for agent ids (`photoViewer.dismiss|close.<viewerKey>`). */
  viewerKey: string;
  onClose: () => void;
}) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { s, spacing: rs } = useResponsive();
  const closeSize = Math.max(44, s(46));
  const closeGap = rs.xs;
  const closeChrome = closeSize + closeGap;
  const [stage, setStage] = useState({ width: 0, height: 0 });
  const [imageAspect, setImageAspect] = useState<number | undefined>();

  useEffect(() => {
    setImageAspect(undefined);
  }, [uri]);

  const onStageLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setStage((prev) =>
      prev.width === width && prev.height === height ? prev : { width, height },
    );
  };

  const photoSize = containedSize(
    stage.width,
    Math.max(0, stage.height - closeChrome),
    imageAspect,
  );

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      presentationStyle="overFullScreen"
      statusBarTranslucent
      onRequestClose={onClose}>
      <View
        accessibilityViewIsModal
        style={[styles.lightbox, { backgroundColor: theme.overlayScrim, paddingTop: insets.top }]}>
        <AgentTestId
          testID={AgentUiIds.travel.photoViewer.dismiss(viewerKey)}
          label="Dismiss photo"
          onPress={onClose}
          style={StyleSheet.absoluteFill}>
          <Pressable
            accessibilityLabel="Dismiss photo"
            onPress={onClose}
            style={StyleSheet.absoluteFill}
          />
        </AgentTestId>
        <View style={styles.stage} onLayout={onStageLayout} pointerEvents="box-none">
          {uri ? (
            <View style={styles.photoCluster} pointerEvents="box-none">
              <View
                pointerEvents="box-none"
                style={[
                  styles.closeRow,
                  {
                    width: photoSize?.width,
                    marginBottom: closeGap,
                    minHeight: closeSize,
                  },
                ]}>
                <IconButton
                  icon="close"
                  size={closeSize}
                  testID={AgentUiIds.travel.photoViewer.close(viewerKey)}
                  accessibilityLabel="Close photo"
                  onPress={onClose}
                />
              </View>
              <View style={[styles.photoStage, photoSize]}>
                {/* Absorb taps on the photo so only the scrim dismisses. */}
                <Pressable accessibilityRole="image" style={styles.photoHit}>
                  <Image
                    source={{ uri }}
                    style={styles.expandedImage}
                    contentFit="contain"
                    onLoad={(event) => {
                      const { width, height } = event.source;
                      if (width > 0 && height > 0) {
                        setImageAspect(width / height);
                      }
                    }}
                  />
                </Pressable>
              </View>
            </View>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

function containedSize(
  stageWidth: number,
  stageHeight: number,
  aspect: number | undefined,
): { width: number; height: number } | undefined {
  if (!stageWidth || !stageHeight) return undefined;
  if (!aspect) {
    return { width: stageWidth, height: stageHeight };
  }
  const stageAspect = stageWidth / stageHeight;
  if (aspect > stageAspect) {
    return { width: stageWidth, height: stageWidth / aspect };
  }
  return { width: stageHeight * aspect, height: stageHeight };
}

const styles = StyleSheet.create({
  lightbox: {
    flex: 1,
    paddingBottom: 0,
  },
  stage: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  photoCluster: {
    alignItems: 'flex-end',
    zIndex: 1,
  },
  closeRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    zIndex: 2,
  },
  photoStage: {
    zIndex: 1,
  },
  photoHit: {
    width: '100%',
    height: '100%',
  },
  expandedImage: {
    width: '100%',
    height: '100%',
  },
});
