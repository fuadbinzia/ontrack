import { StyleSheet, View } from 'react-native';

import {
  ActionChip,
  AppText,
  IconButton,
  Input,
} from '@/components/primitives';
import { useResponsive } from '@/hooks/use-responsive';
import { AgentTestId, AgentUiIds } from '@/utils/agent-ui';

import { FoodSheet } from './food-sheet';

function percent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

export interface ScanIngredientReviewProps {
  visible: boolean;
  overallConfidence: number;
  names: string[];
  onChangeNames: (names: string[]) => void;
  onClose: () => void;
  onConfirm: () => void;
  confirmDisabled: boolean;
}

/**
 * Mandatory low-confidence OCR correction step — analysis is never shown as
 * conclusive until the ingredient list is confirmed.
 */
export function ScanIngredientReview({
  visible,
  overallConfidence,
  names,
  onChangeNames,
  onClose,
  onConfirm,
  confirmDisabled,
}: ScanIngredientReviewProps) {
  const { spacing } = useResponsive();

  return (
    <FoodSheet
      visible={visible}
      name="scan"
      eyebrow="Scan"
      title="Check the ingredients"
      subtitle="The label was hard to read — fix anything wrong first"
      subtitleIcon="warning"
      onClose={onClose}
      doneLabel="Confirm ingredients"
      doneIcon="check"
      onDone={onConfirm}
      doneDisabled={confirmDisabled}
      contentContainerStyle={{ gap: spacing.sm }}>
      <AgentTestId
        testID={AgentUiIds.food.scan.reviewSection}
        label="Correct detected ingredients"
        style={{ gap: spacing.sm }}>
        <AppText variant="callout" color="secondary">
          {`This read with ${percent(overallConfidence)} confidence. Analysis waits until you confirm the list.`}
        </AppText>
        {names.map((name, index) => (
          <View key={index} style={[styles.reviewRow, { gap: spacing.sm }]}>
            <View style={styles.reviewField}>
              <Input
                value={name}
                placeholder="Ingredient"
                onChangeText={(text) =>
                  onChangeNames(
                    names.map((entry, i) => (i === index ? text : entry)),
                  )
                }
                testID={AgentUiIds.food.scan.reviewItem(index)}
                accessibilityLabel={`Detected ingredient ${index + 1}`}
              />
            </View>
            <IconButton
              icon="delete"
              accessibilityLabel={`Remove ingredient ${index + 1}`}
              testID={AgentUiIds.food.scan.reviewRemove(index)}
              onPress={() =>
                onChangeNames(names.filter((_, i) => i !== index))
              }
            />
          </View>
        ))}
        <View style={styles.chipRow}>
          <ActionChip
            label="Add ingredient"
            icon="add"
            testID={AgentUiIds.food.scan.reviewAdd}
            onPress={() => onChangeNames([...names, ''])}
          />
        </View>
      </AgentTestId>
    </FoodSheet>
  );
}

const styles = StyleSheet.create({
  reviewRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  reviewField: {
    flex: 1,
    minWidth: 0,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
});
