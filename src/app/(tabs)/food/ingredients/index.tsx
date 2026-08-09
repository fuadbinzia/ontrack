import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import {
  AppText,
  Card,
  EmptyState,
  HeaderBackButton,
  Input,
  ScreenHeader,
  Symbol,
} from '@/components/primitives';
import {
  IngredientSafetyRow,
  ingredientSafetyStatusForLevel,
} from '@/features/food/components';
import { FoodScreen } from '@/features/food/food-screen';
import { searchIngredientKnowledge } from '@/features/food/ingredient-knowledge';
import { useResponsive } from '@/hooks/use-responsive';
import { useTheme } from '@/hooks/use-theme';
import {
  assessIngredientSafety,
  profileHasSafetySignals,
} from '@/services/food/safety';
import { useFoodProfile } from '@/store/food-profile';
import { AgentTestId, AgentUiIds } from '@/utils/agent-ui';

/** Search/browse the sourced ingredient knowledge base. */
export default function FoodIngredientsScreen() {
  const router = useRouter();
  const theme = useTheme();
  const { spacing, s } = useResponsive();
  const profile = useFoodProfile((state) => state.profile);
  const [query, setQuery] = useState('');

  const entries = useMemo(() => searchIngredientKnowledge(query), [query]);
  const profileInformed = profileHasSafetySignals(profile);

  return (
    <FoodScreen contentStyle={{ gap: spacing.lg }}>
      <ScreenHeader
        eyebrow="Food"
        title="Ingredient Info"
        leading={<HeaderBackButton compact />}
      />

      <Input
        icon="search"
        placeholder="Search ingredients, E-numbers, aliases"
        value={query}
        onChangeText={setQuery}
        testID={AgentUiIds.food.ingredients.search}
        accessibilityLabel="Search ingredient knowledge"
      />

      {!profileInformed ? (
        <AppText variant="caption" color="tertiary">
          No allergies or preferences saved — entries show sourced facts without
          a personal compatibility check.
        </AppText>
      ) : null}

      <AgentTestId
        testID={AgentUiIds.food.ingredients.listSection}
        label="Ingredient knowledge list"
        style={{ gap: spacing.sm }}>
        {entries.length === 0 ? (
          <EmptyState
            icon="search"
            title="No matches"
            message="Try the label name, an E-number, or a common alias."
          />
        ) : (
          <View style={{ gap: spacing.sm }}>
            {entries.map((entry) => {
              const assessment = assessIngredientSafety(entry.name, profile);
              const status = ingredientSafetyStatusForLevel(assessment.level);
              const open = () =>
                router.push(
                  `/(tabs)/food/ingredients/${entry.canonicalKey}` as never,
                );
              // No profile signal → sourced facts only, never a "Safe" badge.
              if (!status) {
                return (
                  <Card
                    key={entry.canonicalKey}
                    padded={false}
                    accessibilityLabel={entry.name}
                    testID={AgentUiIds.food.ingredients.row(entry.canonicalKey)}
                    onPress={open}>
                    <View
                      style={[
                        styles.plainRow,
                        { minHeight: s(56), padding: spacing.md, gap: spacing.md },
                      ]}>
                      <View style={styles.plainBody}>
                        <AppText variant="body" numberOfLines={1}>
                          {entry.name}
                        </AppText>
                        {entry.functionalPurpose ? (
                          <AppText
                            variant="caption"
                            color="secondary"
                            numberOfLines={1}>
                            {entry.functionalPurpose}
                          </AppText>
                        ) : null}
                      </View>
                      <Symbol
                        name="chevron-right"
                        size="sm"
                        color={theme.textTertiary}
                      />
                    </View>
                  </Card>
                );
              }
              return (
                <IngredientSafetyRow
                  key={entry.canonicalKey}
                  name={entry.name}
                  status={status}
                  reason={
                    assessment.level === 'none'
                      ? entry.functionalPurpose
                      : assessment.reason
                  }
                  testID={AgentUiIds.food.ingredients.row(entry.canonicalKey)}
                  onPress={open}
                />
              );
            })}
          </View>
        )}
      </AgentTestId>
    </FoodScreen>
  );
}

const styles = StyleSheet.create({
  plainRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  plainBody: {
    flex: 1,
    minWidth: 0,
  },
});
