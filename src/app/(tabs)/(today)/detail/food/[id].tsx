import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Platform, StyleSheet, View } from 'react-native';

import { AppText, appPrompt, Button, EmptyState, ErrorMessage, Input, SectionHeader } from '@/components/primitives';
import { findCategory } from '@/constants/categories';
import { radii, spacing } from '@/design-system';
import { CalendarDetailSheet } from '@/features/daily-tracking/calendar-detail-sheet';
import { MealAnalysisReview } from '@/features/nutrition/analysis-review';
import { usePendingImagePickerResult } from '@/hooks/use-pending-image-picker';
import {
  analyzeMealLink,
  analyzeMealPhoto,
  confirmMealAnalysis,
  persistMealPhoto,
  resolveMealLink,
  type MealLinkCandidate,
  NutritionServiceError,
} from '@/services/nutrition';
import { usePreferences } from '@/store/preferences';
import { useSchedule } from '@/store/schedule';
import type { Meal, MealAnalysis } from '@/types/models';
import { AgentUiIds } from '@/utils/agent-ui';
import { activityTimingLabel } from '@/utils/activity-time';
import { pickCameraImage, pickLibraryImage } from '@/utils/pick-image';

export default function FoodDetailScreen() {
  const router = useRouter();
  const { id: activityId } = useLocalSearchParams<{ id: string }>();
  const aiEnabled = usePreferences((state) => state.aiEnabled);
  const activity = useSchedule((state) => state.activities.find((item) => item.id === activityId));
  const meal = useSchedule((state) => state.meals.find((item) => item.activityId === activityId));
  const categories = useSchedule((state) => state.categories);
  const upsertMeal = useSchedule((state) => state.upsertMeal);
  const updateActivity = useSchedule((state) => state.updateActivity);

  const [analyzing, setAnalyzing] = useState(false);
  const [pendingAnalysis, setPendingAnalysis] = useState<MealAnalysis | null>(null);
  const [pendingPhoto, setPendingPhoto] = useState<string | null>(null);
  const [pendingOriginalPhoto, setPendingOriginalPhoto] = useState<string>();
  const [pendingPhotoProcessingVersion, setPendingPhotoProcessingVersion] = useState<number>();
  const [draftId, setDraftId] = useState<string>();
  const [linkInput, setLinkInput] = useState('');
  const [showLinkInput, setShowLinkInput] = useState(false);
  const [candidates, setCandidates] = useState<MealLinkCandidate[]>([]);
  const [pendingSourceUrl, setPendingSourceUrl] = useState<string>();
  const [error, setError] = useState<string | null>(null);

  const displayAnalysis = pendingAnalysis ?? meal?.aiAnalysis;
  const displayPhoto = pendingPhoto ?? meal?.photo;

  const analyzeAsset = async (photoUri: string) => {
    setPendingPhoto(photoUri);
    setPendingOriginalPhoto(undefined);
    setPendingPhotoProcessingVersion(undefined);
    setAnalyzing(true);
    setPendingAnalysis(null);
    setCandidates([]);
    try {
      const response = await analyzeMealPhoto(photoUri, activity?.title);
      if (response.processedPhotoUri) {
        setPendingPhoto(response.processedPhotoUri);
        setPendingOriginalPhoto(photoUri);
      }
      setPendingPhotoProcessingVersion(response.photoProcessingVersion);
      setPendingAnalysis(response.analysis);
      setDraftId(response.draftId);
      setPendingSourceUrl(undefined);
    } catch (caught) {
      setError(caught instanceof NutritionServiceError ? caught.message : 'Meal analysis failed.');
    } finally {
      setAnalyzing(false);
    }
  };

  const persistAndAnalyzeAsset = async (uri: string) => {
    try {
      const durableUri = await persistMealPhoto(uri, `${activityId}-original`);
      await analyzeAsset(durableUri);
    } catch {
      setError('The selected photo could not be saved. Please choose it again.');
    }
  };

  // Android may destroy this screen while the system camera/picker is open;
  // recover the photo and resume analysis when the screen is recreated.
  usePendingImagePickerResult((uri) => {
    void persistAndAnalyzeAsset(uri);
  });

  const takePhoto = async () => {
    setError(null);
    const uri = await pickCameraImage({
      allowsEditing: true,
      aspect: [4, 3],
      onDenied: () => setError('Camera access is required to photograph a meal.'),
    });
    if (uri) await persistAndAnalyzeAsset(uri);
  };

  const choosePhoto = async () => {
    setError(null);
    const uri = await pickLibraryImage({
      allowsEditing: true,
      aspect: [4, 3],
      onDenied: () =>
        setError('Photo library access is required to choose a meal photo.'),
    });
    if (uri) await persistAndAnalyzeAsset(uri);
  };

  const showMealSources = () => {
    const select = (index: number) => {
      if (index === 0) void takePhoto();
      if (index === 1) void choosePhoto();
      if (index === 2) setShowLinkInput(true);
      if (index === 3 && activity) router.push({ pathname: '/activity-form', params: { id: activity.id } });
    };
    if (Platform.OS === 'ios') {
      appPrompt.actionSheet({
        options: ['Take Photo', 'Choose Photo', 'Paste Meal Link', 'Enter Manually', 'Cancel'],
        cancelButtonIndex: 4,
        title: 'Add Meal Nutrition',
      }, select);
    } else {
      appPrompt.alert('Add Meal Nutrition', undefined, [
        { text: 'Take Photo', onPress: takePhoto },
        { text: 'Choose Photo', onPress: choosePhoto },
        { text: 'Paste Meal Link', onPress: () => setShowLinkInput(true) },
        { text: 'Enter Manually', onPress: () => activity && router.push({ pathname: '/activity-form', params: { id: activity.id } }) },
        { text: 'Cancel', style: 'cancel' },
      ]);
    }
  };

  const resolveLink = async () => {
    setError(null);
    setAnalyzing(true);
    try {
      const resolution = await resolveMealLink(linkInput);
      setPendingSourceUrl(resolution.sanitizedUrl);
      setCandidates(resolution.candidates);
      if (!resolution.candidates.length) setError(resolution.fallbackMessage ?? 'No meal was found at that link.');
    } catch (caught) {
      setError(caught instanceof NutritionServiceError ? caught.message : 'That link could not be analyzed.');
    } finally {
      setAnalyzing(false);
    }
  };

  const chooseCandidate = async (candidate: MealLinkCandidate) => {
    setAnalyzing(true);
    setError(null);
    try {
      const response = await analyzeMealLink(candidate);
      setPendingAnalysis(response.analysis);
      setDraftId(response.draftId);
      setCandidates([]);
      setShowLinkInput(false);
    } catch (caught) {
      setError(caught instanceof NutritionServiceError ? caught.message : 'That meal could not be analyzed.');
    } finally {
      setAnalyzing(false);
    }
  };

  const saveAnalysis = async () => {
    if (!activity || !pendingAnalysis || !draftId) return;
    setAnalyzing(true);
    try {
      const confirmed = await confirmMealAnalysis(draftId, pendingAnalysis);
      const savedMeal: Meal = {
        activityId: activity.id,
        mealType: meal?.mealType ?? 'lunch',
        name: activity.title,
        photo: pendingPhoto ?? meal?.photo,
        originalPhoto: pendingPhoto !== null ? pendingOriginalPhoto : meal?.originalPhoto,
        photoProcessingVersion: pendingPhoto !== null ? pendingPhotoProcessingVersion : meal?.photoProcessingVersion,
        sourceKind: pendingSourceUrl ? 'link' : 'photo',
        sourceUrl: pendingSourceUrl,
        aiAnalysis: confirmed.analysis,
        items: confirmed.analysis.items,
        notes: meal?.notes,
      };
      upsertMeal(savedMeal);
      updateActivity(activity.id, {
        summary: `${confirmed.analysis.totalCalories} kcal · ${confirmed.analysis.proteinG}g protein`,
        photo: savedMeal.photo,
        photoProcessingVersion: savedMeal.photoProcessingVersion,
      });
      setPendingAnalysis(null);
      setPendingPhoto(null);
      setPendingOriginalPhoto(undefined);
      setPendingPhotoProcessingVersion(undefined);
      setDraftId(undefined);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'The analysis could not be saved.');
    } finally {
      setAnalyzing(false);
    }
  };

  if (!activity) {
    return (
      <CalendarDetailSheet kind="food" title="Meal Not Found" onClose={() => router.back()}>
        <AppText variant="body" color="secondary">
          This meal is no longer available.
        </AppText>
      </CalendarDetailSheet>
    );
  }
  const category = findCategory(categories, activity.categoryId);

  return (
    <CalendarDetailSheet
      kind="food"
      eyebrow={category.name}
      title={meal?.name ?? activity.title}
      subtitle={activityTimingLabel(activity)}
      subtitleIcon="clock"
      onClose={() => router.back()}>
      {displayPhoto ? (
        <Image
          source={displayPhoto}
          style={styles.photo}
          contentFit={(pendingPhoto !== null ? pendingPhotoProcessingVersion : meal?.photoProcessingVersion) ? 'contain' : 'cover'}
          transition={160}
        />
      ) : null}

      {!displayAnalysis && !analyzing ? (
        <EmptyState
          icon="camera"
          title="Analyze This Meal"
          message="Take a photo, choose one, paste a restaurant link, or enter nutrition manually."
          actionLabel={aiEnabled ? 'Add Meal Nutrition' : 'AI disabled in settings'}
          onAction={aiEnabled ? showMealSources : undefined}
          actionTestID={AgentUiIds.food.analyze}
        />
      ) : null}

      {showLinkInput ? (
        <View style={styles.linkCard}>
          <SectionHeader title="Restaurant or Delivery Link" />
          <Input
            label="Meal Link"
            testID={AgentUiIds.food.link}
            autoCapitalize="none"
            keyboardType="url"
            value={linkInput}
            onChangeText={setLinkInput}
            placeholder="https://…"
          />
          <Button
            testID={AgentUiIds.food.findMeal}
            onPress={resolveLink}
            disabled={!linkInput.trim() || analyzing}>
            Find Meal
          </Button>
          <AppText variant="caption" color="secondary">Blocked or ambiguous links will ask you to confirm the item or provide menu text/photo.</AppText>
        </View>
      ) : null}

      {candidates.length ? <SectionHeader title="Confirm the Meal" /> : null}
      {candidates.map((candidate) => (
        <Button
          key={candidate.id}
          variant="secondary"
          testID={AgentUiIds.food.candidate(candidate.id)}
          onPress={() => chooseCandidate(candidate)}
          accessibilityLabel={`Choose ${candidate.itemName}`}>
          {[candidate.restaurant, candidate.itemName, candidate.size].filter(Boolean).join(' · ')}
        </Button>
      ))}

      {analyzing ? <View style={styles.loading}><ActivityIndicator /><AppText variant="callout" color="secondary">Analyzing your meal…</AppText></View> : null}
      {error ? <ErrorMessage message={error} style={styles.error} /> : null}
      {displayAnalysis ? (
        <MealAnalysisReview
          analysis={displayAnalysis}
          editable={Boolean(pendingAnalysis)}
          onChange={pendingAnalysis ? setPendingAnalysis : () => undefined}
        />
      ) : null}

      <View style={styles.actions}>
        {pendingAnalysis ? (
          <Button
            testID={AgentUiIds.food.confirmSave}
            onPress={saveAnalysis}
            disabled={analyzing}>
            Confirm and Save
          </Button>
        ) : null}
        {aiEnabled && displayAnalysis ? (
          <Button
            variant="secondary"
            testID={AgentUiIds.food.analyzeAnother}
            onPress={showMealSources}>
            Analyze Another Source
          </Button>
        ) : null}
        <Button
          variant="secondary"
          icon="edit"
          testID={AgentUiIds.food.edit}
          onPress={() => router.push({ pathname: '/activity-form', params: { id: activity.id } })}>
          Edit Meal Manually
        </Button>
      </View>
    </CalendarDetailSheet>
  );
}

const styles = StyleSheet.create({
  photo: { width: '100%', height: 220, borderRadius: radii.lg, marginBottom: spacing.lg },
  loading: { alignItems: 'center', gap: spacing.md, marginVertical: spacing.xl },
  error: { marginVertical: spacing.md },
  actions: { gap: spacing.sm, marginTop: spacing.lg },
  linkCard: { gap: spacing.sm, marginVertical: spacing.md },
});
