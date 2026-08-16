import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import {
  Pressable,
  StyleSheet,
  View,
  type LayoutChangeEvent,
} from 'react-native';

import { SheetScaffold } from '@/components/primitives';
import { useResponsive } from '@/hooks/use-responsive';
import { AgentUiIds } from '@/utils/agent-ui';

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
    <SheetScaffold
      visible={visible}
      title="Photo"
      closeAccessibilityLabel="Close photo"
      closeTestID={AgentUiIds.travel.photoViewer.close(viewerKey)}
      backdropTestID={AgentUiIds.travel.photoViewer.dismiss(viewerKey)}
      onClose={onClose}>
      <View style={styles.stage} onLayout={onStageLayout}>
        {uri ? (
          <View style={[styles.photoStage, photoSize]}>
            <Pressable accessibilityRole="image" style={styles.photoHit}>
              <Image
                source={{ uri }}
                style={styles.expandedImage}
                contentFit="contain"
                transition={0}
                cachePolicy="memory-disk"
                onLoad={(event) => {
                  const { width, height } = event.source;
                  if (width > 0 && height > 0) {
                    setImageAspect(width / height);
                  }
                }}
              />
            </Pressable>
          </View>
        ) : null}
      </View>
    </SheetScaffold>
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
