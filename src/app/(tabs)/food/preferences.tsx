import { useRouter } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import {
  AppText,
  ScreenHeader,
  SectionHeader,
  SettingsActionRow,
  SettingsGroup,
  SettingsToggleRow,
} from '@/components/primitives';
import { AllergyEditorSheet } from '@/features/food/allergy-editor-sheet';
import { FoodHeaderBackButton } from '@/features/food/food-header-back-button';
import { FoodScreen } from '@/features/food/food-screen';
import {
  AllergyRow,
  DietaryPreferenceChips,
  EditableListSection,
  toggleListValue,
} from '@/features/food/preferences-sections';
import { useResponsive } from '@/hooks/use-responsive';
import { useFoodProfile } from '@/store/food-profile';
import type { AllergyEntry } from '@/types/food';
import { AgentTestId, AgentUiIds } from '@/utils/agent-ui';

/** Diet & Preferences — SCREENS.md §6. Privacy toggles default off. */
export default function FoodPreferencesScreen() {
  const router = useRouter();
  const { spacing } = useResponsive();
  const profile = useFoodProfile((state) => state.profile);
  const setDietaryPreferences = useFoodProfile((state) => state.setDietaryPreferences);
  const setIntolerances = useFoodProfile((state) => state.setIntolerances);
  const setAvoidedIngredients = useFoodProfile((state) => state.setAvoidedIngredients);
  const setNutritionPriorities = useFoodProfile((state) => state.setNutritionPriorities);
  const setCuisineLikes = useFoodProfile((state) => state.setCuisineLikes);
  const setCuisineDislikes = useFoodProfile((state) => state.setCuisineDislikes);
  const setPrivacy = useFoodProfile((state) => state.setPrivacy);

  const [editorVisible, setEditorVisible] = useState(false);
  const [editingAllergy, setEditingAllergy] = useState<AllergyEntry | undefined>();

  const openEditor = (allergy?: AllergyEntry) => {
    setEditingAllergy(allergy);
    setEditorVisible(true);
  };

  return (
    <FoodScreen contentStyle={{ gap: spacing.xl }}>
      <ScreenHeader
        eyebrow="Food"
        title="Diet & Preferences"
        subtitle="Personalizes suggestions and every safety check"
        leading={<FoodHeaderBackButton />}
      />

      <SettingsGroup>
        <SettingsActionRow
          label="Nutrition"
          detail="Profiles, dependents, and targets"
          icon="nutrition-profiles"
          testID={AgentUiIds.food.preferences.clinical}
          onPress={() => router.push('/(tabs)/food/nutrition-profile' as never)}
          accessibilityLabel="Open nutrition profiles"
        />
      </SettingsGroup>

      <AgentTestId
        testID={AgentUiIds.food.preferences.dietSection}
        label="Dietary preferences"
        style={{ gap: spacing.sm }}>
        <SectionHeader flush title="Dietary Preferences" />
        <DietaryPreferenceChips
          selected={profile.dietaryPreferences}
          onToggle={(preference) =>
            setDietaryPreferences(
              toggleListValue(profile.dietaryPreferences, preference),
            )
          }
        />
      </AgentTestId>

      <AgentTestId
        testID={AgentUiIds.food.preferences.allergySection}
        label="Allergies"
        style={{ gap: spacing.sm }}>
        <SectionHeader
          flush
          title="Allergies"
          actionLabel="Add"
          actionTestID={AgentUiIds.food.preferences.allergyAdd}
          onAction={() => openEditor()}
        />
        {profile.allergies.length > 0 ? (
          <View style={{ gap: spacing.sm }}>
            {profile.allergies.map((allergy) => (
              <AllergyRow
                key={allergy.id}
                allergy={allergy}
                onPress={() => openEditor(allergy)}
              />
            ))}
          </View>
        ) : (
          <AppText variant="callout" color="secondary">
            No allergies saved. Add them to personalize recommendations —
            severe ones are always excluded from AI suggestions.
          </AppText>
        )}
      </AgentTestId>

      <EditableListSection
        section="intolerances"
        title="Intolerances"
        hint="Flagged in scans and ingredient checks, but never shared."
        placeholder="Lactose, gluten…"
        values={profile.intolerances}
        onChange={setIntolerances}
      />

      <EditableListSection
        section="avoided"
        title="Avoided Ingredients"
        hint="Kept out of AI ideas and flagged when they show up."
        placeholder="Pork, gelatin, cilantro…"
        values={profile.avoidedIngredients}
        onChange={setAvoidedIngredients}
      />

      <EditableListSection
        section="priorities"
        title="Nutrition Priorities"
        hint="What suggestions should lean toward."
        placeholder="More protein, less added sugar…"
        values={profile.nutritionPriorities}
        onChange={setNutritionPriorities}
      />

      <EditableListSection
        section="cuisineLikes"
        title="Cuisines You Love"
        hint="Bumped to the top of ideas and recipes."
        placeholder="Moroccan, Levantine…"
        values={profile.cuisineLikes}
        onChange={setCuisineLikes}
      />

      <EditableListSection
        section="cuisineDislikes"
        title="Cuisines to Skip"
        hint="Quietly kept out of suggestions."
        placeholder="Heavy cream sauces…"
        values={profile.cuisineDislikes}
        onChange={setCuisineDislikes}
      />

      <AgentTestId
        testID={AgentUiIds.food.preferences.privacySection}
        label="Privacy"
        style={{ gap: spacing.sm }}>
        <SectionHeader flush title="Privacy" />
        <AppText variant="caption" color="secondary">
          Health data is private by default. Nothing here appears in Community
          posts, shares, or your profile preview unless you turn it on.
        </AppText>
        <SettingsGroup>
          <SettingsToggleRow
            label="Share allergies"
            detail="Let posts and your profile preview mention your allergies."
            icon="allergy"
            value={profile.privacy.shareAllergies}
            onValueChange={(value) => setPrivacy({ shareAllergies: value })}
            testID={AgentUiIds.food.preferences.privacy('shareAllergies')}
          />
          <SettingsToggleRow
            label="Share dietary preferences"
            detail="Show diet tags like Halal or Vegan on what you share."
            icon="nutrition"
            value={profile.privacy.shareDietaryPreferences}
            onValueChange={(value) =>
              setPrivacy({ shareDietaryPreferences: value })
            }
            testID={AgentUiIds.food.preferences.privacy('shareDietaryPreferences')}
          />
          <SettingsToggleRow
            label="Share meals"
            detail="Allow tracked meals to appear in friend activity."
            icon="food"
            value={profile.privacy.shareMeals}
            onValueChange={(value) => setPrivacy({ shareMeals: value })}
            testID={AgentUiIds.food.preferences.privacy('shareMeals')}
          />
        </SettingsGroup>
      </AgentTestId>

      <AllergyEditorSheet
        visible={editorVisible}
        allergy={editingAllergy}
        onClose={() => setEditorVisible(false)}
      />
    </FoodScreen>
  );
}
