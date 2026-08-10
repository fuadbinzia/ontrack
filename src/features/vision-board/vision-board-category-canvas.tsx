import { useMemo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, ReduceMotion } from 'react-native-reanimated';

import {
  AppText,
  Button,
  ErrorMessage,
  GlassPlate,
  IconButton,
  Symbol,
} from '@/components/primitives';
import { fontFamilies, radii, shadows, spacing } from '@/design-system';
import { useTheme } from '@/hooks/use-theme';
import { AgentUiIds } from '@/utils/agent-ui';

import { nudgeCanvasFrame } from './canvas';
import { VISION_BOARD_BACKGROUNDS } from './defaults';
import type {
  CanvasFrame,
  VisionBoardBackground,
  VisionBoardCategory,
  VisionBoardItem,
  VisionBoardItemKind,
} from './types';
import { VisionBoardBackground as BoardBackground } from './vision-board-background';
import { VisionBoardCanvasItem } from './vision-board-canvas-item';

type AdjustAction =
  | 'left'
  | 'right'
  | 'up'
  | 'down'
  | 'grow'
  | 'shrink'
  | 'rotate-left'
  | 'rotate-right';

type Props = {
  category: VisionBoardCategory;
  items: VisionBoardItem[];
  posterWidth: number;
  posterHeight: number;
  selectedId?: string;
  busy: boolean;
  error?: string;
  history?: { past: unknown[]; future: unknown[] };
  onSelect: (id: string | undefined) => void;
  onGestureActive: (active: boolean) => void;
  onUpdateFrame: (id: string, frame: CanvasFrame) => void;
  onUndo: () => void;
  onRedo: () => void;
  onAddImage: () => void;
  onOpenItemEditor: (type: VisionBoardItemKind, id?: string) => void;
  onMoveLayer: (id: string, direction: 'back' | 'forward') => void;
  onConfirmDelete: (item: VisionBoardItem) => void;
  onUpdateBackground: (background: VisionBoardBackground) => void;
};

export function VisionBoardCategoryCanvas({
  category,
  items,
  posterWidth,
  posterHeight,
  selectedId,
  busy,
  error,
  history,
  onSelect,
  onGestureActive,
  onUpdateFrame,
  onUndo,
  onRedo,
  onAddImage,
  onOpenItemEditor,
  onMoveLayer,
  onConfirmDelete,
  onUpdateBackground,
}: Props) {
  const theme = useTheme();
  const selected = useMemo(
    () => items.find((item) => item.id === selectedId),
    [items, selectedId],
  );

  const adjustSelected = (action: AdjustAction) => {
    if (selected) onUpdateFrame(selected.id, nudgeCanvasFrame(selected.frame, action));
  };

  return (
        <Animated.View
          entering={FadeIn.duration(220).reduceMotion(ReduceMotion.System)}
          style={styles.editor}>
          <View style={styles.editorTopbar}>
            <View style={styles.historyActions}>
              <IconButton
                icon="undo"
                disabled={!history?.past.length}
                accessibilityLabel="Undo last board change"
                onPress={onUndo}
              />
              <IconButton
                icon="redo"
                disabled={!history?.future.length}
                accessibilityLabel="Redo last board change"
                onPress={onRedo}
              />
            </View>
            <AppText variant="caption" color="secondary">
              Drag · pinch · rotate
            </AppText>
          </View>

          <View
            style={[
              styles.poster,
              { width: posterWidth, height: posterHeight, borderColor: theme.separator },
            ]}>
            <BoardBackground background={category.background} />
            {items.length === 0 ? (
              <View pointerEvents="none" style={styles.posterEmpty}>
                <Symbol name="vision-board" size={42} color="rgba(255,255,255,0.82)" />
                <AppText style={styles.posterEmptyTitle} align="center">
                  Build the life you can see
                </AppText>
                <AppText style={styles.posterEmptyBody} align="center">
                  Add an image, affirmation, or goal below.
                </AppText>
              </View>
            ) : null}
            {[...items]
              .sort((a, b) => a.frame.zIndex - b.frame.zIndex)
              .map((item) => (
                <VisionBoardCanvasItem
                  key={`${item.id}-${item.updatedAt}`}
                  item={item}
                  category={category}
                  posterWidth={posterWidth}
                  posterHeight={posterHeight}
                  selected={selectedId === item.id}
                  onSelect={() => onSelect(item.id)}
                  onCommit={(frame: CanvasFrame) => onUpdateFrame(item.id, frame)}
                  onGestureActive={onGestureActive}
                />
              ))}
          </View>

          <View style={styles.addActions}>
            <Button
              icon="photo"
              variant="secondary"
              disabled={busy}
              testID={AgentUiIds.vision.addImage}
              onPress={onAddImage}
              accessibilityLabel="Add an image to this vision board">
              {busy ? 'Adding…' : 'Image'}
            </Button>
            <Button
              icon="smart"
              variant="secondary"
              testID={AgentUiIds.vision.addAffirmation}
              onPress={() => onOpenItemEditor('affirmation')}
              accessibilityLabel="Add an affirmation to this vision board">
              Affirmation
            </Button>
            <Button
              icon="target"
              variant="secondary"
              testID={AgentUiIds.vision.addGoal}
              onPress={() => onOpenItemEditor('goal')}
              accessibilityLabel="Add a goal to this vision board">
              Goal
            </Button>
          </View>

          {error ? <ErrorMessage message={error} /> : null}

          {selected ? (
            <GlassPlate
              accessibilityLiveRegion="polite"
              style={styles.selectionPanel}>
              <View style={[styles.selectionHeading, { zIndex: 1 }]}>
                <View style={styles.flex}>
                  <AppText variant="subheading">Selected {selected.kind}</AppText>
                  <AppText variant="caption" color="secondary" numberOfLines={1}>
                    Use these controls as an alternative to gestures.
                  </AppText>
                </View>
                <IconButton
                  icon="close"
                  testID={AgentUiIds.vision.selectionDeselect}
                  accessibilityLabel="Deselect board item"
                  onPress={() => onSelect(undefined)}
                />
              </View>
              <View style={[styles.toolRow, { zIndex: 1 }]}>
                <IconButton
                  icon="edit"
                  testID={AgentUiIds.vision.selectionEdit}
                  accessibilityLabel={`Edit selected ${selected.kind}`}
                  onPress={() => onOpenItemEditor(selected.kind, selected.id)}
                />
                <IconButton
                  icon="layer-back"
                  testID={AgentUiIds.vision.selectionLayerBack}
                  accessibilityLabel="Send selected item backward"
                  onPress={() => onMoveLayer(selected.id, 'back')}
                />
                <IconButton
                  icon="layer-forward"
                  testID={AgentUiIds.vision.selectionLayerForward}
                  accessibilityLabel="Bring selected item forward"
                  onPress={() => onMoveLayer(selected.id, 'forward')}
                />
                <IconButton
                  icon="delete"
                  color={theme.danger}
                  testID={AgentUiIds.vision.selectionDelete}
                  accessibilityLabel={`Delete selected ${selected.kind}`}
                  onPress={() => onConfirmDelete(selected)}
                />
              </View>
              <View style={[styles.adjustments, { zIndex: 1 }]}>
                {[
                  ['←', 'left', 'Move selected item left'],
                  ['↑', 'up', 'Move selected item up'],
                  ['↓', 'down', 'Move selected item down'],
                  ['→', 'right', 'Move selected item right'],
                  ['−', 'shrink', 'Make selected item smaller'],
                  ['+', 'grow', 'Make selected item larger'],
                  ['↺', 'rotate-left', 'Rotate selected item left'],
                  ['↻', 'rotate-right', 'Rotate selected item right'],
                ].map(([label, action, accessibilityLabel]) => (
                  <Pressable
                    key={action}
                    accessibilityRole="button"
                    accessibilityLabel={accessibilityLabel}
                    onPress={() => adjustSelected(action as Parameters<typeof adjustSelected>[0])}
                    style={({ pressed }) => [
                      { opacity: pressed ? 0.65 : 1 },
                    ]}>
                    <GlassPlate airy style={styles.adjustButton}>
                      <AppText variant="subheading">{label}</AppText>
                    </GlassPlate>
                  </Pressable>
                ))}
              </View>
            </GlassPlate>
          ) : null}

          <View style={styles.backgroundSection}>
            <View style={styles.backgroundHeading}>
              <Symbol name="background" color={theme.textSecondary} />
              <AppText variant="overline" color="tertiary">
                Background
              </AppText>
            </View>
            <View style={styles.backgroundChoices}>
              {(Object.keys(VISION_BOARD_BACKGROUNDS) as VisionBoardBackground[]).map(
                (background) => {
                  const preset = VISION_BOARD_BACKGROUNDS[background];
                  return (
                    <Pressable
                      key={background}
                      accessibilityRole="radio"
                      accessibilityState={{ checked: category.background === background }}
                      accessibilityLabel={`Use ${preset.label} background`}
                      onPress={() => onUpdateBackground(background)}
                      style={[
                        styles.backgroundChoice,
                        {
                          backgroundColor:
                            theme.name === 'light' ? preset.light : preset.dark,
                          borderColor:
                            category.background === background
                              ? theme.accentPrimary
                              : theme.separator,
                        },
                      ]}>
                      <AppText
                        variant="caption"
                        style={{
                          color: background === 'charcoal' ? '#FFFFFF' : theme.textPrimary,
                        }}>
                        {preset.label}
                      </AppText>
                    </Pressable>
                  );
                },
              )}
            </View>
          </View>
        </Animated.View>
  );
}

const styles = StyleSheet.create({
  editor: { alignItems: 'center', gap: spacing.lg },
  editorTopbar: {
    width: '100%',
    maxWidth: 620,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  historyActions: { flexDirection: 'row', gap: spacing.sm },
  poster: {
    overflow: 'hidden',
    borderWidth: 4,
    borderRadius: radii.lg,
    borderCurve: 'continuous',
    ...shadows.overlay,
  },
  posterEmpty: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    padding: spacing.xl,
    backgroundColor: 'rgba(35,29,23,0.16)',
  },
  posterEmptyTitle: {
    color: '#FFFFFF',
    fontFamily: fontFamilies.serif,
    fontSize: 25,
    lineHeight: 31,
    fontWeight: '400',
  },
  posterEmptyBody: { color: 'rgba(255,255,255,0.88)' },
  addActions: {
    width: '100%',
    maxWidth: 620,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  selectionPanel: {
    width: '100%',
    maxWidth: 620,
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radii.lg,
    borderCurve: 'continuous',
    ...shadows.card,
  },
  selectionHeading: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  toolRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  adjustments: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  adjustButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.pill,
  },
  backgroundSection: { width: '100%', maxWidth: 620, gap: spacing.md },
  backgroundHeading: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  backgroundChoices: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  backgroundChoice: {
    minWidth: 82,
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderWidth: 2,
    borderRadius: radii.md,
    borderCurve: 'continuous',
  },
  flex: { flex: 1 },
});
