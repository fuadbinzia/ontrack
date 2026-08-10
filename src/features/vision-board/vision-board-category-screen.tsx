import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    Platform,
    StyleSheet,
    useWindowDimensions,
    View,
} from 'react-native';
import {
    appPrompt,
    AppText,
    Button,
    EmptyState,
    IconButton,
    Screen,
    Symbol,
} from '@/components/primitives';
import { fontFamilies, radii, spacing } from '@/design-system';
import { usePendingImagePickerResult } from '@/hooks/use-pending-image-picker';
import { useTheme } from '@/hooks/use-theme';
import { newVisionBoardId, useVisionBoard } from '@/store/vision-board';
import { AgentUiIds } from '@/utils/agent-ui';
import { confirmDestructiveAction } from '@/utils/confirm-destructive';
import { goBackOrReplace } from '@/utils/navigation';
import { pickCameraImage, pickLibraryImage } from '@/utils/pick-image';

import {
    initialCanvasFrame,
    VISION_BOARD_ASPECT_RATIO,
} from './canvas';
import {
    cleanupOrphanedVisionBoardImages,
    persistVisionBoardImage,
} from './media';
import { itemsForCategory } from './selectors';
import type {
    VisionBoardImageItem,
    VisionBoardItem,
    VisionBoardItemKind,
} from './types';
import { VisionBoardCategoryCanvas } from './vision-board-category-canvas';
import { VisionBoardGallery } from './vision-board-gallery';

function param(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export function VisionBoardCategoryScreen() {
  const router = useRouter();
  const theme = useTheme();
  const { width: windowWidth } = useWindowDimensions();
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const categoryId = param(params.id) ?? '';
  const categories = useVisionBoard((state) => state.categories);
  const allItems = useVisionBoard((state) => state.items);
  const updateCategory = useVisionBoard((state) => state.updateCategory);
  const addItem = useVisionBoard((state) => state.addItem);
  const updateItemFrame = useVisionBoard((state) => state.updateItemFrame);
  const moveItemLayer = useVisionBoard((state) => state.moveItemLayer);
  const removeItem = useVisionBoard((state) => state.removeItem);
  const undoCategory = useVisionBoard((state) => state.undoCategory);
  const redoCategory = useVisionBoard((state) => state.redoCategory);
  const clearCategoryHistory = useVisionBoard((state) => state.clearCategoryHistory);
  const history = useVisionBoard((state) => state.history[categoryId]);
  const category = categories.find((item) => item.id === categoryId);
  const items = useMemo(
    () => itemsForCategory(allItems, categoryId),
    [allItems, categoryId],
  );
  const [mode, setMode] = useState<'edit' | 'gallery'>(
    Platform.OS === 'web' ? 'gallery' : 'edit',
  );
  const [selectedId, setSelectedId] = useState<string>();
  const [gestureActive, setGestureActive] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const itemsRef = useRef(allItems);
  const posterWidth = Math.max(280, Math.min(windowWidth - 40, 620));
  const posterHeight = posterWidth / VISION_BOARD_ASPECT_RATIO;
  useEffect(() => {
    itemsRef.current = allItems;
  }, [allItems]);

  useEffect(
    () => () => {
      clearCategoryHistory(categoryId);
      const referenced = itemsRef.current
        .filter((item): item is VisionBoardImageItem => item.kind === 'image')
        .map((item) => item.uri);
      void cleanupOrphanedVisionBoardImages(referenced);
    },
    [categoryId, clearCategoryHistory],
  );

  const addPersistedImage = useCallback(
    async (uri: string) => {
      if (!category) return;
      setBusy(true);
      setError(undefined);
      try {
        const id = newVisionBoardId('vision-image');
        const persisted = await persistVisionBoardImage(uri, id);
        const categoryItems = useVisionBoard
          .getState()
          .items.filter((item) => item.categoryId === category.id);
        const now = new Date().toISOString();
        const item: VisionBoardImageItem = {
          id,
          categoryId: category.id,
          kind: 'image',
          uri: persisted.uri,
          aspectRatio: persisted.width / Math.max(1, persisted.height),
          frame: initialCanvasFrame(
            'image',
            categoryItems.length,
            Math.max(-1, ...categoryItems.map((entry) => entry.frame.zIndex)) + 1,
            persisted.width / Math.max(1, persisted.height),
          ),
          createdAt: now,
          updatedAt: now,
        };
        addItem(item);
        setSelectedId(item.id);
      } catch (caught) {
        setError(
          caught instanceof Error
            ? caught.message
            : 'The selected image could not be added.',
        );
      } finally {
        setBusy(false);
      }
    },
    [addItem, category],
  );

  usePendingImagePickerResult((uri) => {
    void addPersistedImage(uri);
  });

  const choosePhoto = async () => {
    const uri = await pickLibraryImage();
    if (uri) await addPersistedImage(uri);
  };

  const capturePhoto = async () => {
    const uri = await pickCameraImage({
      cameraDeniedMessage:
        'Allow camera access in Settings to add a photo to your vision board.',
    });
    if (uri) await addPersistedImage(uri);
  };

  const showImageActions = () => {
    if (Platform.OS === 'ios') {
      appPrompt.actionSheet(
        {
          options: ['Cancel', 'Choose from Photos', 'Take Photo'],
          cancelButtonIndex: 0,
          title: 'Add an Image',
        },
        (index) => {
          if (index === 1) void choosePhoto();
          if (index === 2) void capturePhoto();
        },
      );
      return;
    }
    appPrompt.alert('Add an Image', undefined, [
      { text: 'Choose from Photos', onPress: () => void choosePhoto() },
      { text: 'Take Photo', onPress: () => void capturePhoto() },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const openItemEditor = (type: VisionBoardItemKind, id?: string) => {
    router.push({
      pathname: '/vision-board/item-editor',
      params: { categoryId, type, ...(id ? { id } : {}) },
    } as never);
  };

  const confirmDelete = (item: VisionBoardItem) => {
    const perform = () => {
      removeItem(item.id);
      setSelectedId(undefined);
    };
    const label =
      item.kind === 'image'
        ? item.caption || 'this image'
        : item.kind === 'affirmation'
          ? item.text
          : item.title;
    confirmDestructiveAction({
      title: 'Remove Board Item?',
      message: label,
      actionLabel: 'Remove',
      onConfirm: perform,
    });
  };

  const switchMode = () => {
    setSelectedId(undefined);
    setMode((value) => (value === 'edit' ? 'gallery' : 'edit'));
  };

  if (!category) {
    return (
      <Screen>
        <EmptyState
          icon="vision-board"
          title="Category Not Found"
          message="This vision board category may have been removed on another device."
          actionLabel="Back to Vision Board"
          onAction={() =>
            router.replace('/(tabs)/vision-board/categories' as never)
          }
        />
      </Screen>
    );
  }

  return (
    <Screen
      bottomInset="safe"
      scrollEnabled={!gestureActive}
      contentStyle={{ ...styles.screen, maxWidth: Math.max(680, posterWidth) }}>
      <View style={styles.header}>
        <IconButton
          icon="chevron-left"
          size={40}
          background="transparent"
          accessibilityLabel="Back to Vision Board"
          onPress={() =>
            goBackOrReplace(router, '/(tabs)/vision-board/categories')
          }
        />
        <View style={styles.headerCopy}>
          <AppText style={styles.title}>{category.name}</AppText>
          <AppText color="secondary">{category.intention}</AppText>
        </View>
        {Platform.OS !== 'web' ? (
          <Button
            icon={mode === 'edit' ? 'gallery' : 'edit'}
            variant={mode === 'edit' ? 'secondary' : 'primary'}
            testID={AgentUiIds.vision.categoryMode}
            onPress={switchMode}
            accessibilityLabel={
              mode === 'edit' ? 'Show read-only gallery' : 'Return to editable board'
            }>
            {mode === 'edit' ? 'Gallery' : 'Edit Board'}
          </Button>
        ) : null}
      </View>

      {Platform.OS === 'web' ? (
        <View style={[styles.notice, { backgroundColor: theme.backgroundSunken }]}>
          <Symbol name="gallery" color={theme.textSecondary} />
          <AppText variant="callout" color="secondary" style={styles.flex}>
            This is the synced read-only gallery. Edit the collage in the mobile app.
          </AppText>
        </View>
      ) : null}

      {mode === 'gallery' ? (
        <VisionBoardGallery category={category} items={items} />
      ) : (
        <VisionBoardCategoryCanvas
          category={category}
          items={items}
          posterWidth={posterWidth}
          posterHeight={posterHeight}
          selectedId={selectedId}
          busy={busy}
          error={error}
          history={history}
          onSelect={setSelectedId}
          onGestureActive={setGestureActive}
          onUpdateFrame={updateItemFrame}
          onUndo={() => undoCategory(category.id)}
          onRedo={() => redoCategory(category.id)}
          onAddImage={showImageActions}
          onOpenItemEditor={openItemEditor}
          onMoveLayer={moveItemLayer}
          onConfirmDelete={confirmDelete}
          onUpdateBackground={(background) =>
            updateCategory(category.id, { background })
          }
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: {
    width: '100%',
    alignSelf: 'center',
    gap: spacing.lg,
    paddingTop: spacing.sm,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  headerCopy: { flex: 1, gap: spacing.xs },
  title: { fontFamily: fontFamilies.serif, fontSize: 34, lineHeight: 40, fontWeight: '400' },
  notice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radii.md,
    borderCurve: 'continuous',
  },
  flex: { flex: 1 },
});
