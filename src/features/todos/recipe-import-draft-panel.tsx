import { newId } from '@/utils/id';
import { ActivityIndicator, Platform, Pressable, View } from 'react-native';

import {
  AppText,
  Button,
  Card,
  Input,
  Symbol,
} from '@/components/primitives';
import {
  RecipeIngredientEditor,
  type EditableRecipeIngredient,
} from '@/features/todos/recipe-ingredient-editor';
import type { RecipeImportDraft } from '@/services/recipes';
import { AgentUiIds } from '@/utils/agent-ui';
import { recipeImportScreenStyles as styles } from './recipe-import-screen-styles';

export type RecipeImportDraftPanelProps = {
  draft: RecipeImportDraft;
  name: string;
  setName: (v: string) => void;
  sourceUrl: string;
  setSourceUrl: (v: string) => void;
  sourceServings: string;
  setSourceServings: (v: string) => void;
  targetServings: string;
  setTargetServings: (v: string) => void;
  ingredients: EditableRecipeIngredient[];
  setIngredients: (
    v:
      | EditableRecipeIngredient[]
      | ((prev: EditableRecipeIngredient[]) => EditableRecipeIngredient[]),
  ) => void;
  scaleWarnings: string[];
  working: boolean;
  theme: { textSecondary: string; textTertiary?: string; accentPrimary?: string };
  rescale: (sourceValue: string, targetValue: string) => void;
  onSave: () => void;
  listName: string;
};

export function RecipeImportDraftPanel({
  draft,
  name,
  setName,
  sourceUrl,
  setSourceUrl,
  sourceServings,
  setSourceServings,
  targetServings,
  setTargetServings,
  ingredients,
  setIngredients,
  scaleWarnings,
  working,
  theme,
  rescale,
  onSave,
  listName,
}: RecipeImportDraftPanelProps) {
  return (
    <>

          <Card style={styles.detailsCard}>
            <Input
              label="Meal Name"
              value={name}
              maxLength={80}
              onChangeText={setName}
              testID={AgentUiIds.recipeImport.mealName}
            />
            {draft.sourceKind === 'url' ? (
              <Input
                label="Source URL"
                value={sourceUrl}
                maxLength={2_000}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
                onChangeText={setSourceUrl}
                testID={AgentUiIds.recipeImport.sourceUrl}
              />
            ) : (
              <View style={styles.imageSource}>
                <Symbol name="photo" size={20} color={theme.accentPrimary} />
                <AppText variant="caption" color="secondary">
                  The sanitized screenshot will be kept as the meal thumbnail.
                </AppText>
              </View>
            )}
            <View style={styles.servingRow}>
              <View style={styles.flex}>
                <Input
                  label="Source Servings"
                  value={sourceServings}
                  keyboardType="decimal-pad"
                  testID={AgentUiIds.recipeImport.sourceServings}
                  onChangeText={(value) => {
                    setSourceServings(value);
                    if (targetServings) rescale(value, targetServings);
                  }}
                />
              </View>
              <Symbol name="chevron-right" size={18} color={theme.textTertiary} />
              <View style={styles.flex}>
                <Input
                  label="Target Servings"
                  value={targetServings}
                  keyboardType="decimal-pad"
                  testID={AgentUiIds.recipeImport.targetServings}
                  onChangeText={(value) => {
                    setTargetServings(value);
                    if (sourceServings) rescale(sourceServings, value);
                  }}
                />
              </View>
            </View>
          </Card>

          {[...draft.warnings, ...scaleWarnings].length ? (
            <Card variant="sunken" style={styles.warningCard}>
              <Symbol name="tip" size={20} color={theme.accentPrimary} />
              <View style={styles.flex}>
                {[...draft.warnings, ...scaleWarnings].map((warning, index) => (
                  <AppText
                    key={`${warning}-${index}`}
                    variant="caption"
                    color="secondary">
                    • {warning}
                  </AppText>
                ))}
              </View>
            </Card>
          ) : null}

          <RecipeIngredientEditor
            ingredients={ingredients}
            onChange={setIngredients}
            onAdd={() =>
              setIngredients((current) => [
                ...current,
                {
                  id: newId('ingredient'),
                  name: '',
                  canonicalKey: '',
                  quantityValue: null,
                  quantityText: null,
                  unit: null,
                  preparation: null,
                  originalText: '',
                  confidence: 1,
                },
              ])
            }
          />

          <Button
            size="lg"
            icon="groceries"
            testID={AgentUiIds.recipeImport.save}
            disabled={
              working ||
              !name.trim() ||
              !ingredients.some((ingredient) => ingredient.name.trim())
            }
            onPress={() => void onSave()}>
            {working ? 'Saving…' : `Save to ${listName}`}
          </Button>
        
    </>
  );
}
