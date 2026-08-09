import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import {
  AppText,
  Button,
  GlassPrimaryAction,
  Input,
  SegmentedControl,
} from '@/components/primitives';
import { FoodSheet } from '@/features/food/food-sheet';
import { useResponsive } from '@/hooks/use-responsive';
import { useFoodProfile } from '@/store/food-profile';
import type { AllergyEntry, AllergySeverity } from '@/types/food';
import { AgentUiIds } from '@/utils/agent-ui';
import { confirmDestructiveAction } from '@/utils/confirm-destructive';
import { haptics } from '@/utils/haptics';

const SEVERITIES: readonly { value: AllergySeverity; label: string }[] = [
  { value: 'mild', label: 'Mild' },
  { value: 'moderate', label: 'Moderate' },
  { value: 'severe', label: 'Severe' },
];

/**
 * Add/edit one allergy. Removing a SEVERE allergy always routes through an
 * explicit destructive confirmation (skill hard requirement).
 */
export function AllergyEditorSheet({
  visible,
  allergy,
  onClose,
}: {
  visible: boolean;
  /** Existing entry when editing; omit to add. */
  allergy?: AllergyEntry;
  onClose: () => void;
}) {
  const { spacing } = useResponsive();
  const addAllergy = useFoodProfile((state) => state.addAllergy);
  const updateAllergy = useFoodProfile((state) => state.updateAllergy);
  const removeAllergy = useFoodProfile((state) => state.removeAllergy);

  const [name, setName] = useState('');
  const [severity, setSeverity] = useState<AllergySeverity>('moderate');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (!visible) return;
    setName(allergy?.allergen ?? '');
    setSeverity(allergy?.severity ?? 'moderate');
    setNotes(allergy?.notes ?? '');
  }, [visible, allergy]);

  const save = () => {
    const allergen = name.trim();
    if (!allergen) return;
    if (allergy) {
      updateAllergy(allergy.id, { allergen, severity, notes: notes.trim() || undefined });
    } else {
      addAllergy({ allergen, severity, notes: notes.trim() || undefined });
    }
    haptics.success();
    onClose();
  };

  const remove = () => {
    if (!allergy) return;
    const finish = () => {
      removeAllergy(allergy.id);
      haptics.select();
      onClose();
    };
    // Gate on the SAVED severity — unsaved edits must not soften the guard.
    if (allergy.severity === 'severe') {
      confirmDestructiveAction({
        title: `Remove severe ${allergy.allergen} allergy?`,
        message:
          'AI suggestions and safety checks stop excluding it the moment it is removed.',
        actionLabel: 'Remove',
        confirmTestID: AgentUiIds.food.preferences.allergyRemoveConfirm,
        onConfirm: finish,
      });
      return;
    }
    finish();
  };

  return (
    <FoodSheet
      visible={visible}
      name="allergyEditor"
      title={allergy ? 'Edit Allergy' : 'Add Allergy'}
      subtitle="Severe allergies are always excluded from AI suggestions"
      subtitleIcon="allergy"
      onClose={onClose}
      contentContainerStyle={{ gap: spacing.lg }}
      footer={
        <View style={{ gap: spacing.sm }}>
          <GlassPrimaryAction
            label={allergy ? 'Save Allergy' : 'Add Allergy'}
            icon="check"
            disabled={!name.trim()}
            onPress={save}
            testID={AgentUiIds.food.sheet.done('allergyEditor')}
          />
          {allergy ? (
            <Button
              variant="ghost"
              icon="delete"
              accessibilityLabel={`Remove ${allergy.allergen} allergy`}
              testID={AgentUiIds.food.preferences.allergyRemove}
              onPress={remove}>
              Remove Allergy
            </Button>
          ) : null}
        </View>
      }>
      <Input
        stackedLabel="Allergen"
        placeholder="Peanuts, shellfish, sesame…"
        value={name}
        onChangeText={setName}
        maxLength={60}
        testID={AgentUiIds.food.preferences.allergyName}
      />
      <SegmentedControl
        label="Severity"
        value={severity}
        onChange={setSeverity}
        options={SEVERITIES.map((option) => ({
          ...option,
          testID: AgentUiIds.food.preferences.allergySeverity(option.value),
        }))}
      />
      {severity === 'severe' ? (
        <AppText variant="caption" color="secondary" style={styles.severeNote}>
          Severe means never suggested: recipes and AI ideas that trip this
          allergen are filtered out everywhere.
        </AppText>
      ) : null}
      <Input
        stackedLabel="Notes (Optional)"
        placeholder="Reactions, medication, cross-contamination…"
        value={notes}
        onChangeText={setNotes}
        multiline
        maxLength={200}
        testID={AgentUiIds.food.preferences.allergyNotes}
      />
    </FoodSheet>
  );
}

const styles = StyleSheet.create({
  severeNote: {
    flexShrink: 1,
    minWidth: 0,
  },
});
