import { lazy, Suspense } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { AppText, GlassPlate, LoadingBlock } from '@/components/primitives';
import { radii, spacing } from '@/design-system';
import { ANATOMY_BEIGE } from '@/features/workouts/anatomy-art';
import { formatMuscleLabel } from '@/features/workouts/format-muscle-label';
import { MuscleAtlasDropdowns } from '@/features/workouts/muscle-atlas-dropdowns';
import type { MuscleAtlasCategoryId, MuscleAtlasEntry } from '@/features/workouts/muscle-atlas';
import type {
  AnatomySex,
  BodyView,
  MuscleGroup,
  MuscleKey,
  MuscleTarget,
} from '@/features/workouts/muscle-data';
import {
  BODY_VIEW_TABS,
  HIGHLIGHT_COLOR,
  bodyViewLabel,
} from '@/features/workouts/muscle-explorer-selection';
import type { resolveAtlasWorkoutSelection } from '@/features/workouts/atlas-workout-selection';
import { useTheme } from '@/hooks/use-theme';
import { AgentUiIds, useAgentUiTarget } from '@/utils/agent-ui';

const HumanBodyMap = lazy(() =>
  import('@/features/workouts/human-body-map').then((mod) => ({ default: mod.HumanBodyMap })),
);

type AtlasSelection = ReturnType<typeof resolveAtlasWorkoutSelection>;

export function MuscleExplorer({
  anatomySex,
  bodyView,
  selectedMuscle,
  selectedTarget,
  atlasCategoryId,
  atlasMuscle,
  atlasSelection,
  visibleMuscles,
  gymColors,
  onChangeAnatomySex,
  onChangeBodyView,
  onSelectMapHit,
  onSelectMuscle,
  onSelectAtlasCategory,
  onSelectAtlasMuscle,
}: {
  anatomySex: AnatomySex;
  bodyView: BodyView;
  selectedMuscle: MuscleKey;
  selectedTarget: MuscleTarget;
  atlasCategoryId: MuscleAtlasCategoryId;
  atlasMuscle: MuscleAtlasEntry;
  atlasSelection: AtlasSelection;
  visibleMuscles: MuscleGroup[];
  gymColors: { main: string; tint: string };
  onChangeAnatomySex: (next: AnatomySex) => void;
  onChangeBodyView: (next: BodyView) => void;
  onSelectMapHit: (hit: { key: MuscleKey; highlightId: string }) => void;
  onSelectMuscle: (key: MuscleKey) => void;
  onSelectAtlasCategory: (categoryId: MuscleAtlasCategoryId) => void;
  onSelectAtlasMuscle: (muscle: MuscleAtlasEntry) => void;
}) {
  const theme = useTheme();
  const anatomyCanvas = theme.name === 'dark' ? theme.backgroundSunken : ANATOMY_BEIGE;

  return (
    <View style={styles.root}>
      <View style={styles.sectionIntro}>
        <AppText variant="overline" color="tertiary">Interactive Anatomy</AppText>
        <AppText variant="heading">Muscle Explorer</AppText>
      </View>

      <View
        style={[
          styles.bodyExperience,
          { backgroundColor: anatomyCanvas, borderColor: theme.separator },
        ]}>
        <View style={[styles.bodyChromeBar, { backgroundColor: anatomyCanvas }]}>
          <View style={styles.bodyChromeTopRow}>
            <GlassPlate
              style={[
                styles.sexToggle,
                {
                  borderColor: theme.separator,
                },
              ]}>
              <View style={[styles.toggleRow, styles.glassContent]}>
                {([
                  { id: 'male' as const, label: 'Male' },
                  { id: 'female' as const, label: 'Female' },
                ]).map((option) => (
                  <AnatomySexTab
                    key={option.id}
                    id={option.id}
                    label={option.label}
                    selected={anatomySex === option.id}
                    onPress={() => onChangeAnatomySex(option.id)}
                  />
                ))}
              </View>
            </GlassPlate>

            <GlassPlate
              style={[
                styles.bodyViewDock,
                {
                  borderColor: theme.separator,
                },
              ]}>
              <View style={[styles.toggleRow, styles.glassContent]}>
                {BODY_VIEW_TABS.map((tab) => (
                  <BodyViewTab
                    key={tab.view}
                    view={tab.view}
                    label={tab.label}
                    selected={bodyView === tab.view}
                    onPress={() => onChangeBodyView(tab.view)}
                  />
                ))}
              </View>
            </GlassPlate>
          </View>

          <View style={styles.atlasControlsInline}>
            <MuscleAtlasDropdowns
              categoryId={atlasCategoryId}
              muscle={atlasMuscle}
              onSelectCategory={onSelectAtlasCategory}
              onSelectMuscle={onSelectAtlasMuscle}
            />
          </View>
        </View>

        <View style={styles.bodyMapStage}>
          <Suspense fallback={<LoadingBlock label="Loading anatomy…" />}>
            <HumanBodyMap
              anatomySex={anatomySex}
              bodyView={bodyView}
              selectedMuscle={selectedMuscle}
              selectedTarget={selectedTarget}
              highlightMuscleId={atlasSelection.highlightMuscleId}
              onSelectHit={onSelectMapHit}
            />
          </Suspense>
        </View>

        <GlassPlate
          style={[
            styles.bodyCaption,
            {
              borderTopColor: theme.separator,
            },
          ]}>
          <View style={[styles.bodyCaptionCopy, styles.glassContent]}>
            <View style={styles.focusIndicator} />
            <View style={styles.flex}>
              <AppText variant="overline" color="tertiary">
                {atlasSelection.groupLabel}
              </AppText>
              <AppText variant="subheading" numberOfLines={2}>
                {formatMuscleLabel(atlasMuscle.name)}
              </AppText>
            </View>
          </View>
          <AppText variant="caption" color="tertiary" style={styles.glassContent}>
            {bodyViewLabel(bodyView)} · {anatomySex === 'female' ? 'Female' : 'Male'}
            {atlasMuscle.visibility === 'deep' ? ' · Deep' : ''}
          </AppText>
        </GlassPlate>
      </View>

      <ScrollView
        horizontal
        accessibilityRole="tablist"
        contentContainerStyle={styles.muscleChips}
        showsHorizontalScrollIndicator={false}>
        {visibleMuscles.map((group) => (
          <MuscleChip
            key={group.key}
            muscleKey={group.key}
            label={group.label}
            selected={group.key === selectedMuscle}
            selectedBg={gymColors.main}
            borderColor={
              group.key === selectedMuscle ? gymColors.main : theme.separator
            }
            onPress={() => onSelectMuscle(group.key)}
          />
        ))}
      </ScrollView>
    </View>
  );
}

function AnatomySexTab({
  id,
  label,
  selected,
  onPress,
}: {
  id: AnatomySex;
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  const accessibilityLabel = `${label} anatomy`;
  const agent = useAgentUiTarget(AgentUiIds.workouts.anatomySex(id), {
    label: accessibilityLabel,
    onPress,
  });
  return (
    <Pressable
      ref={agent.ref}
      testID={agent.testID}
      onLayout={agent.onLayout}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ selected }}
      hitSlop={4}
      onPress={onPress}
      style={[styles.sexToggleTab, selected && styles.selectedToggleTab]}>
      {selected ? (
        <GlassPlate airy style={StyleSheet.absoluteFill} />
      ) : null}
      <AppText
        variant="caption"
        color={selected ? 'primary' : 'secondary'}
        fit
        style={styles.glassContent}>
        {label}
      </AppText>
    </Pressable>
  );
}

function BodyViewTab({
  view,
  label,
  selected,
  onPress,
}: {
  view: BodyView;
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  const accessibilityLabel = `${label} body view`;
  const agent = useAgentUiTarget(AgentUiIds.workouts.bodyView(view), {
    label: accessibilityLabel,
    onPress,
  });
  return (
    <Pressable
      ref={agent.ref}
      testID={agent.testID}
      onLayout={agent.onLayout}
      accessibilityRole="tab"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[styles.bodyTab, selected && styles.selectedToggleTab]}>
      {selected ? (
        <GlassPlate airy style={StyleSheet.absoluteFill} />
      ) : null}
      <AppText
        variant="caption"
        color={selected ? 'primary' : 'secondary'}
        fit
        style={styles.glassContent}>
        {label}
      </AppText>
    </Pressable>
  );
}

function MuscleChip({
  muscleKey,
  label,
  selected,
  selectedBg,
  borderColor,
  onPress,
}: {
  muscleKey: MuscleKey;
  label: string;
  selected: boolean;
  selectedBg: string;
  borderColor: string;
  onPress: () => void;
}) {
  const agent = useAgentUiTarget(AgentUiIds.workouts.muscleChip(muscleKey), {
    label,
    onPress,
  });
  return (
    <Pressable
      ref={agent.ref}
      testID={agent.testID}
      onLayout={agent.onLayout}
      accessibilityRole="tab"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[
        styles.muscleChip,
        {
          borderColor,
          overflow: 'hidden',
        },
      ]}>
      {selected ? (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: selectedBg }]} />
      ) : (
        <GlassPlate airy style={StyleSheet.absoluteFill} />
      )}
      <AppText variant="callout" color={selected ? 'onAccent' : 'secondary'} style={styles.glassContent}>
        {label}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { gap: spacing.md },
  flex: { flex: 1 },
  glassContent: { zIndex: 1 },
  sectionIntro: { gap: spacing.xxs },
  bodyMapStage: {
    position: 'relative',
    width: '100%',
  },
  bodyChromeBar: {
    gap: spacing.sm,
    borderBottomWidth: 0,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  bodyChromeTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  sexToggle: {
    borderWidth: 1,
    borderRadius: radii.pill,
    padding: 2,
  },
  toggleRow: {
    flexDirection: 'row',
    gap: 2,
  },
  selectedToggleTab: {
    overflow: 'hidden',
  },
  sexToggleTab: {
    minHeight: 30,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.pill,
  },
  bodyViewDock: {
    flex: 1,
    borderWidth: 1,
    borderRadius: radii.pill,
    padding: 2,
  },
  atlasControlsInline: { gap: spacing.sm },
  bodyExperience: {
    overflow: 'hidden',
    marginTop: spacing.md,
    borderWidth: 1,
    borderRadius: radii.xl,
    boxShadow: '0 18px 45px rgba(54, 28, 20, 0.22)',
  },
  bodyTab: {
    minHeight: 30,
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.pill,
    paddingHorizontal: spacing.xs,
  },
  bodyCaption: {
    minHeight: 68,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    borderTopWidth: 1,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  bodyCaptionCopy: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  focusIndicator: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: HIGHLIGHT_COLOR,
    boxShadow: '0 0 12px rgba(255, 122, 31, 0.85)',
  },
  muscleChips: {
    gap: spacing.sm,
    paddingVertical: spacing.xs,
    paddingRight: spacing.xl,
  },
  muscleChip: {
    minHeight: 40,
    justifyContent: 'center',
    borderWidth: 1,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.lg,
  },
});
