import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import {
  ActionChip,
  AppText,
  Card,
  GlassIconWell,
  GlassPlate,
  IconButton,
  Input,
  StatusBadge,
  Symbol,
  statusBadgeToneColor,
} from '@/components/primitives';
import { glassMaterials, radii } from '@/design-system';
import {
  ingredientSafetyIcon,
  ingredientSafetyLabel,
  ingredientSafetyTone,
} from '@/features/food/components';
import { foodTestIdSlug } from '@/features/food/food-slug';
import { useResponsive } from '@/hooks/use-responsive';
import { useTheme } from '@/hooks/use-theme';
import { dietaryPreferenceLabel } from '@/services/food/labels';
import type { AllergyEntry, DietaryPreference } from '@/types/food';
import { AgentTestId, AgentUiIds, useAgentUiTarget } from '@/utils/agent-ui';
import { haptics } from '@/utils/haptics';

/** Every diet the profile model supports — SCREENS.md §6 chips. */
export const DIETARY_PREFERENCE_OPTIONS: readonly DietaryPreference[] = [
  'halal',
  'kosher',
  'vegetarian',
  'vegan',
  'pescatarian',
  'keto',
  'paleo',
  'gluten-free',
  'dairy-free',
  'nut-free',
  'low-sodium',
  'low-carb',
  'high-protein',
  'mediterranean',
];

/** Stable chip testID key from a free-text value. */
export function preferenceItemSlug(value: string): string {
  return foodTestIdSlug(value) || 'item';
}

/** Toggle helper shared by chips (dedupes, preserves order). */
export function toggleListValue<T>(values: readonly T[], value: T): T[] {
  return values.includes(value)
    ? values.filter((entry) => entry !== value)
    : [...values, value];
}

export function DietaryPreferenceChips({
  selected,
  onToggle,
}: {
  selected: readonly DietaryPreference[];
  onToggle: (preference: DietaryPreference) => void;
}) {
  const { spacing } = useResponsive();
  return (
    <View style={[styles.chipWrap, { gap: spacing.sm }]}>
      {DIETARY_PREFERENCE_OPTIONS.map((preference) => (
        <ActionChip
          key={preference}
          label={dietaryPreferenceLabel(preference)}
          selected={selected.includes(preference)}
          testID={AgentUiIds.food.preferences.diet(preference)}
          onPress={() => onToggle(preference)}
        />
      ))}
    </View>
  );
}

/** Allergy row → editor sheet. Severity always shows icon + text, never color alone. */
export function AllergyRow({
  allergy,
  onPress,
}: {
  allergy: AllergyEntry;
  onPress: () => void;
}) {
  const theme = useTheme();
  const { spacing, s } = useResponsive();
  const tone = ingredientSafetyTone(allergy.severity);
  const toneColor = statusBadgeToneColor(tone, theme);
  const label = ingredientSafetyLabel(allergy.severity);

  return (
    <Card
      padded={false}
      onPress={onPress}
      accessibilityLabel={`${allergy.allergen}, ${label} allergy`}
      testID={AgentUiIds.food.preferences.allergyRow(allergy.id)}>
      <View
        style={[
          styles.allergyRow,
          { minHeight: s(56), padding: spacing.md, gap: spacing.md },
        ]}>
        <GlassIconWell size={Math.max(36, s(38))}>
          <Symbol
            name={ingredientSafetyIcon(allergy.severity)}
            size="sm"
            color={toneColor}
          />
        </GlassIconWell>
        <View style={[styles.allergyCopy, { gap: spacing.xxs }]}>
          <AppText variant="body" numberOfLines={1} style={styles.shrinkText}>
            {allergy.allergen}
          </AppText>
          {allergy.notes ? (
            <AppText variant="caption" color="secondary" numberOfLines={2}>
              {allergy.notes}
            </AppText>
          ) : null}
        </View>
        <StatusBadge label={label} tone={tone} />
        <Symbol name="chevron-right" size="sm" color={theme.textTertiary} />
      </View>
    </Card>
  );
}

/**
 * Free-text list editor (intolerances, avoided ingredients, priorities,
 * cuisine likes/dislikes): removable chips + an inline composer.
 */
export function EditableListSection({
  section,
  title,
  hint,
  placeholder,
  values,
  onChange,
}: {
  /** testID segment, e.g. `intolerances`. */
  section: string;
  title: string;
  hint: string;
  placeholder: string;
  values: readonly string[];
  onChange: (values: string[]) => void;
}) {
  const { spacing } = useResponsive();
  const [draft, setDraft] = useState('');

  const add = () => {
    const clean = draft.trim();
    if (!clean) return;
    const exists = values.some(
      (value) => value.trim().toLowerCase() === clean.toLowerCase(),
    );
    if (!exists) onChange([...values, clean]);
    setDraft('');
    haptics.select();
  };

  return (
    <AgentTestId
      testID={AgentUiIds.food.preferences.listSection(section)}
      label={title}
      style={{ gap: spacing.sm }}>
      <AppText variant="heading">{title}</AppText>
      <AppText variant="caption" color="secondary">
        {hint}
      </AppText>
      {values.length > 0 ? (
        <View style={[styles.chipWrap, { gap: spacing.sm }]}>
          {values.map((value) => (
            <RemovableChip
              key={value}
              label={value}
              testID={AgentUiIds.food.preferences.listItem(
                section,
                preferenceItemSlug(value),
              )}
              onRemove={() => onChange(values.filter((entry) => entry !== value))}
            />
          ))}
        </View>
      ) : null}
      <Input
        placeholder={placeholder}
        value={draft}
        onChangeText={setDraft}
        returnKeyType="done"
        onSubmitEditing={add}
        maxLength={60}
        testID={AgentUiIds.food.preferences.listInput(section)}
        trailing={
          <IconButton
            icon="add"
            size={36}
            iconSize="sm"
            disabled={!draft.trim()}
            accessibilityLabel={`Add to ${title.toLowerCase()}`}
            testID={AgentUiIds.food.preferences.listAdd(section)}
            onPress={add}
          />
        }
      />
    </AgentTestId>
  );
}

/** One tap removes the value — the chip is the remove control. */
function RemovableChip({
  label,
  testID,
  onRemove,
}: {
  label: string;
  testID: string;
  onRemove: () => void;
}) {
  const theme = useTheme();
  const { spacing, layout, s } = useResponsive();
  const handlePress = () => {
    haptics.select();
    onRemove();
  };
  const agent = useAgentUiTarget(testID, {
    label: `Remove ${label}`,
    onPress: handlePress,
  });

  return (
    <Pressable
      ref={agent.ref}
      testID={agent.testID}
      onLayout={agent.onLayout}
      accessibilityRole="button"
      accessibilityLabel={`Remove ${label}`}
      onPress={handlePress}
      style={({ pressed }) => [
        styles.removableHit,
        { maxWidth: s(200), opacity: pressed ? 0.86 : 1 },
      ]}>
      <GlassPlate
        style={[
          styles.removableChip,
          {
            minHeight: layout.minTapTarget,
            gap: spacing.xs,
            paddingHorizontal: spacing.md,
            borderRadius: radii.pill,
            borderColor:
              theme.name === 'dark'
                ? glassMaterials.border.darkStrong
                : glassMaterials.border.light,
          },
        ]}>
        <AppText variant="callout" color="secondary" fit numberOfLines={1}>
          {label}
        </AppText>
        <Symbol name="close" size={13} color={theme.textTertiary} />
      </GlassPlate>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
  },
  allergyRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  allergyCopy: {
    flex: 1,
    minWidth: 0,
  },
  shrinkText: {
    flexShrink: 1,
    minWidth: 0,
  },
  removableHit: {
    flexShrink: 1,
    minWidth: 0,
  },
  removableChip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 1,
    minWidth: 0,
  },
});
