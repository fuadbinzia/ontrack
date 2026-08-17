import {
    useLocalSearchParams,
    useNavigation,
    useRouter,
} from 'expo-router';
import type { NavigationAction } from 'expo-router/react-navigation';
import {
    clearSharedPayloads,
    getResolvedSharedPayloadsAsync,
    getSharedPayloads,
} from 'expo-sharing';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Platform,
    StyleSheet,
    View,
} from 'react-native';

import { recipeImportScreenStyles as styles } from './recipe-import-screen-styles';

import {
    appPrompt,
    AppText,
    Button,
    Card,
    ErrorMessage,
    Input,
    Screen,
    Symbol
} from '@/components/primitives';
import { layout, radii, spacing } from '@/design-system';
import { scaleIngredients } from '@/features/todos/grocery-utils';
import {
    RecipeIngredientEditor,
    type EditableRecipeIngredient,
} from '@/features/todos/recipe-ingredient-editor';
import { usePendingImagePickerResult } from '@/hooks/use-pending-image-picker';
import { useTheme } from '@/hooks/use-theme';
import { sanitizeMealUrl } from '@/services/nutrition/url-safety';
import {
    analyzeRecipe,
    persistRecipeImage,
    prepareRecipeImage,
    RecipeImportError,
    type RecipeImportDraft,
    type RecipeImportIngredient,
} from '@/services/recipes';
import {
    useChecklists,
    type ChecklistIngredientInput,
    type ChecklistRecipeSourceKind,
} from '@/store/todos';
import { AgentUiIds } from '@/utils/agent-ui';
import { haptics } from '@/utils/haptics';
import { newId } from '@/utils/id';
import { asPositiveNumber } from '@/utils/parse';
import { pickCameraImage, pickLibraryImage } from '@/utils/pick-image';


import { RecipeImportDraftPanel } from '@/features/todos/recipe-import-draft-panel';
import { sharedUrl, withIds } from '@/features/todos/recipe-import-helpers';

export function RecipeImportScreen({ listId }: { listId: string }) {
  const theme = useTheme();
  const router = useRouter();
  const navigation = useNavigation();
  const { source } = useLocalSearchParams<{ source?: string }>();
  const list = useChecklists((state) =>
    state.lists.find((item) => item.id === listId),
  );
  const addRecipe = useChecklists((state) => state.addRecipe);
  const [url, setUrl] = useState('');
  const [draft, setDraft] = useState<RecipeImportDraft>();
  const [ingredients, setIngredients] = useState<EditableRecipeIngredient[]>([]);
  const baseIngredients = useRef<EditableRecipeIngredient[]>([]);
  const [name, setName] = useState('');
  const [sourceUrl, setSourceUrl] = useState('');
  const [sourceServings, setSourceServings] = useState('');
  const [targetServings, setTargetServings] = useState('');
  const [scaleWarnings, setScaleWarnings] = useState<string[]>([]);
  const [imageUri, setImageUri] = useState<string>();
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string>();
  const [sharedLoading, setSharedLoading] = useState(source === 'share');
  const controllerRef = useRef<AbortController | undefined>(undefined);
  const allowLeave = useRef(false);
  const sharedImport = source === 'share';

  const applyDraft = useCallback((next: RecipeImportDraft) => {
    const editable = withIds(next.ingredients);
    baseIngredients.current = editable;
    setDraft(next);
    setIngredients(editable);
    setName(next.name);
    setSourceUrl(next.sourceUrl ?? '');
    setSourceServings(next.originalServings ? String(next.originalServings) : '');
    setTargetServings(next.targetServings ? String(next.targetServings) : '');
    setScaleWarnings([]);
  }, []);

  const analyzeImage = useCallback(
    async (uri: string) => {
      controllerRef.current?.abort();
      const controller = new AbortController();
      controllerRef.current = controller;
      setImageUri(uri);
      setWorking(true);
      setError(undefined);
      try {
        const imageDataUrl = await prepareRecipeImage(uri);
        applyDraft(
          await analyzeRecipe(
            { kind: 'image', imageDataUrl },
            controller.signal,
          ),
        );
      } catch (caught) {
        if (caught instanceof Error && caught.name === 'AbortError') return;
        setError(
          caught instanceof RecipeImportError
            ? caught.message
            : 'The recipe image could not be analyzed.',
        );
      } finally {
        if (controllerRef.current === controller) setWorking(false);
      }
    },
    [applyDraft],
  );

  usePendingImagePickerResult((uri) => {
    void analyzeImage(uri);
  });

  useEffect(() => {
    if (!sharedImport) return;
    let active = true;
    void getResolvedSharedPayloadsAsync()
      .then(async (resolved) => {
        if (!active) return;
        const image = resolved.find(
          (payload) =>
            payload.contentType === 'image' ||
            payload.shareType === 'image',
        );
        if (image?.contentUri) {
          await analyzeImage(image.contentUri);
          return;
        }
        const nextUrl = sharedUrl();
        if (!nextUrl) {
          throw new Error('The shared content does not contain a recipe URL or image.');
        }
        setUrl(nextUrl);
        const controller = new AbortController();
        controllerRef.current = controller;
        setWorking(true);
        applyDraft(
          await analyzeRecipe({ kind: 'url', url: nextUrl }, controller.signal),
        );
      })
      .catch((caught: unknown) => {
        if (active) {
          setError(
            caught instanceof Error
              ? caught.message
              : 'The shared recipe could not be read.',
          );
        }
      })
      .finally(() => {
        if (active) {
          setWorking(false);
          setSharedLoading(false);
        }
      });
    return () => {
      active = false;
      controllerRef.current?.abort();
    };
  }, [analyzeImage, applyDraft, sharedImport]);

  const discard = useCallback(
    (action?: NavigationAction) => {
      if (sharedImport) clearSharedPayloads();
      allowLeave.current = true;
      if (action) navigation.dispatch(action);
      else router.replace(sharedImport ? '/(tabs)/to-do' : `/(tabs)/to-do/${listId}` as never);
    },
    [listId, navigation, router, sharedImport],
  );

  const confirmDiscard = useCallback(
    (action?: NavigationAction) => {
      if (!sharedImport) {
        allowLeave.current = true;
        if (action) navigation.dispatch(action);
        else router.back();
        return;
      }
      appPrompt.alert(
        'Discard Shared Recipe?',
        'The shared URL or image will be cleared without being saved.',
        [
          { text: 'Keep Reviewing', style: 'cancel' },
          {
            text: 'Discard',
            style: 'destructive',
            onPress: () => discard(action),
          },
        ],
      );
    },
    [discard, navigation, router, sharedImport],
  );

  useEffect(
    () =>
      navigation.addListener('beforeRemove', (event) => {
        if (allowLeave.current || !sharedImport) return;
        event.preventDefault();
        confirmDiscard(event.data.action);
      }),
    [confirmDiscard, navigation, sharedImport],
  );

  if (!list || list.kind !== 'grocery' || list.role !== 'owner') {
    return (
      <Screen contentStyle={styles.center} refresh={false}>
        <Symbol name="groceries" size={40} color={theme.textTertiary} />
        <AppText variant="heading">Recipe Import Unavailable</AppText>
        <AppText variant="body" color="secondary" align="center">
          Only the owner of a Grocery list can add recipes.
        </AppText>
        <Button onPress={() => router.replace('/(tabs)/to-do' as never)}>
          Back to Lists
        </Button>
      </Screen>
    );
  }

  const runUrlAnalysis = async () => {
    if (!url.trim()) return;
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    setWorking(true);
    setError(undefined);
    setImageUri(undefined);
    try {
      applyDraft(
        await analyzeRecipe(
          { kind: 'url', url: url.trim() },
          controller.signal,
        ),
      );
    } catch (caught) {
      if (caught instanceof Error && caught.name === 'AbortError') return;
      setError(
        caught instanceof RecipeImportError
          ? caught.message
          : 'The recipe URL could not be analyzed.',
      );
    } finally {
      if (controllerRef.current === controller) setWorking(false);
    }
  };

  const pickCamera = async () => {
    const uri = await pickCameraImage({
      quality: 1,
      onDenied: () =>
        setError('Camera permission is needed to photograph a recipe.'),
    });
    if (uri) await analyzeImage(uri);
  };

  const pickLibrary = async () => {
    const uri = await pickLibraryImage({
      quality: 1,
      onDenied: () => {
        if (Platform.OS !== 'web') {
          setError('Photo-library permission is needed to select a recipe image.');
        }
      },
    });
    if (uri) await analyzeImage(uri);
  };

  const rescale = (sourceValue: string, targetValue: string) => {
    const sourceNumber = asPositiveNumber(Number(sourceValue));
    const targetNumber = asPositiveNumber(Number(targetValue));
    const scaled = scaleIngredients(
      baseIngredients.current.map(
        ({ id: _id, ...ingredient }): ChecklistIngredientInput => ({
          name: ingredient.name,
          canonicalKey: ingredient.canonicalKey,
          quantityValue: ingredient.quantityValue ?? undefined,
          quantityText: ingredient.quantityText ?? undefined,
          unit: ingredient.unit ?? undefined,
          preparation: ingredient.preparation ?? undefined,
          originalText: ingredient.originalText,
          confidence: ingredient.confidence,
        }),
      ),
      sourceNumber,
      targetNumber,
    );
    setIngredients((current) =>
      scaled.ingredients.map((ingredient, index) => ({
        id: current[index]?.id ?? newId('ingredient'),
        name: ingredient.name,
        canonicalKey: ingredient.canonicalKey ?? '',
        quantityValue: ingredient.quantityValue ?? null,
        quantityText: ingredient.quantityText ?? null,
        unit: ingredient.unit ?? null,
        preparation: ingredient.preparation ?? null,
        originalText: ingredient.originalText ?? ingredient.name,
        confidence: ingredient.confidence ?? 0,
      })),
    );
    setScaleWarnings(scaled.warnings);
  };

  const save = async () => {
    const validIngredients = ingredients.filter(
      (ingredient) => ingredient.name.trim(),
    );
    if (!name.trim() || validIngredients.length === 0 || working) return;
    setWorking(true);
    setError(undefined);
    try {
      const sanitizedSourceUrl =
        draft?.sourceKind === 'url' && sourceUrl.trim()
          ? sanitizeMealUrl(sourceUrl.trim())
          : undefined;
      const durableImageUri =
        draft?.sourceKind === 'image' && imageUri
          ? await persistRecipeImage(imageUri, `${listId}-recipe`)
          : undefined;
      const recipe = addRecipe(listId, {
        name,
        sourceKind: (draft?.sourceKind ?? 'url') as ChecklistRecipeSourceKind,
        sourceUrl: sanitizedSourceUrl,
        sourceImageUri: durableImageUri,
        originalServings: asPositiveNumber(Number(sourceServings)),
        targetServings: asPositiveNumber(Number(targetServings)),
        ingredients: validIngredients.map((ingredient) => ({
          name: ingredient.name,
          canonicalKey: ingredient.canonicalKey,
          quantityValue: ingredient.quantityValue ?? undefined,
          quantityText: ingredient.quantityText ?? undefined,
          unit: ingredient.unit ?? undefined,
          preparation: ingredient.preparation ?? undefined,
          originalText: ingredient.originalText,
          confidence: ingredient.confidence,
        })),
      });
      if (!recipe) throw new Error('The reviewed recipe could not be saved.');
      if (sharedImport) clearSharedPayloads();
      allowLeave.current = true;
      haptics.success();
      router.replace(`/(tabs)/to-do/${listId}` as never);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : 'The reviewed recipe could not be saved.',
      );
      setWorking(false);
    }
  };

  return (
    <Screen contentStyle={styles.screen} refresh={false}>
      <View style={styles.header}>
        <View style={styles.headerCopy}>
          <AppText variant="overline" color="accent">
            {draft ? 'Review Before Saving' : 'Grocery Recipe Import'}
          </AppText>
          <AppText variant="display">
            {draft ? 'Review Recipe' : 'Add a Recipe'}
          </AppText>
          <AppText variant="body" color="secondary">
            {draft
              ? 'Check the meal name, servings, and every ingredient.'
              : 'Use one public recipe URL, camera photo, or screenshot.'}
          </AppText>
        </View>
        <Button
          variant="ghost"
          testID={AgentUiIds.recipeImport.cancel}
          onPress={() => confirmDiscard()}>
          Cancel
        </Button>
      </View>

      {working || sharedLoading ? (
        <Card variant="sunken" style={styles.analyzing}>
          <ActivityIndicator color={theme.accentPrimary} />
          <View style={styles.analyzingCopy}>
            <AppText variant="subheading">Reading the recipe…</AppText>
            <AppText variant="caption" color="secondary">
              This analysis runs once and is not automatically retried.
            </AppText>
          </View>
          <Button
            variant="ghost"
            testID={AgentUiIds.recipeImport.stop}
            onPress={() => {
              controllerRef.current?.abort();
              setWorking(false);
            }}>
            Stop
          </Button>
        </Card>
      ) : null}

      {error ? <ErrorMessage message={error} /> : null}

      {!draft && !sharedLoading ? (
        <View style={styles.sourceSection}>
          <Card style={styles.urlCard}>
            <Symbol name="open-external" size={24} color={theme.accentPrimary} />
            <View style={styles.flex}>
              <Input
                label="Recipe URL"
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
                onChangeText={setUrl}
                onSubmitEditing={() => void runUrlAnalysis()}
                placeholder="https://example.com/recipe"
                value={url}
                testID={AgentUiIds.recipeImport.url}
              />
            </View>
            <Button
              disabled={!url.trim() || working}
              testID={AgentUiIds.recipeImport.analyze}
              onPress={() => void runUrlAnalysis()}>
              Analyze
            </Button>
          </Card>
          <View style={styles.pickerActions}>
            {Platform.OS !== 'web' ? (
              <Button
                variant="secondary"
                icon="camera"
                disabled={working}
                testID={AgentUiIds.recipeImport.camera}
                onPress={() => void pickCamera()}>
                Camera
              </Button>
            ) : null}
            <Button
              variant="secondary"
              icon="photo"
              disabled={working}
              testID={AgentUiIds.recipeImport.library}
              onPress={() => void pickLibrary()}>
              Photo or screenshot
            </Button>
          </View>
        </View>
      ) : null}

      {draft ? (
        <RecipeImportDraftPanel
          draft={draft}
          name={name}
          setName={setName}
          sourceUrl={sourceUrl}
          setSourceUrl={setSourceUrl}
          sourceServings={sourceServings}
          setSourceServings={setSourceServings}
          targetServings={targetServings}
          setTargetServings={setTargetServings}
          ingredients={ingredients}
          setIngredients={setIngredients}
          scaleWarnings={scaleWarnings}
          working={working}
          theme={theme}
          rescale={rescale}
          onSave={save}
          listName={list.name}
        />
      ) : null}

    </Screen>
  );
}
