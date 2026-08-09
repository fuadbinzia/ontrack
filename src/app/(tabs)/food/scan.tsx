import { useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import {
  ActionChip,
  AppText,
  ErrorMessage,
  FoodImage,
  GlassIconWell,
  GlassPrimaryAction,
  LoadingBlock,
  ScreenHeader,
  Symbol,
} from '@/components/primitives';
import { radii } from '@/design-system';
import { buildFoodFixtureScanResult } from '@/features/food/fixtures';
import { FoodHeaderBackButton } from '@/features/food/food-header-back-button';
import { FoodScreen } from '@/features/food/food-screen';
import { ScanResultSheet } from '@/features/food/scan-result-sheet';
import { useResponsive } from '@/hooks/use-responsive';
import { useTheme } from '@/hooks/use-theme';
import {
  analyzeIngredientPhoto,
  shouldFallBackToFixtures,
} from '@/services/food/client';
import type { IngredientScanAnalysis } from '@/services/food/types';
import { AgentTestId, AgentUiIds } from '@/utils/agent-ui';
import { pickCameraImage, pickLibraryImage } from '@/utils/pick-image';

type Phase = 'idle' | 'analyzing' | 'done' | 'error';

/**
 * Ingredient label scanner. Capture goes through the system camera (existing
 * `expo-image-picker` dependency — flash/torch live in that camera UI; no new
 * camera dependency). The photo stays in memory only: it is re-encoded for
 * upload and never persisted.
 */
export default function FoodScanScreen() {
  const theme = useTheme();
  const { spacing, s } = useResponsive();

  const [phase, setPhase] = useState<Phase>('idle');
  const [photoUri, setPhotoUri] = useState<string | undefined>();
  const [analysis, setAnalysis] = useState<IngredientScanAnalysis | null>(null);
  const [offlineSample, setOfflineSample] = useState(false);
  const [sheetVisible, setSheetVisible] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const abortRef = useRef<AbortController | null>(null);

  const analyze = async (uri: string) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setPhase('analyzing');
    setOfflineSample(false);
    try {
      const result = await analyzeIngredientPhoto(uri, controller.signal);
      setAnalysis(result);
      setSheetVisible(true);
      setPhase('done');
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') return;
      if (shouldFallBackToFixtures(error)) {
        // Deterministic offline sample — flagged in the sheet, review required.
        setAnalysis(buildFoodFixtureScanResult());
        setOfflineSample(true);
        setSheetVisible(true);
        setPhase('done');
        return;
      }
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'The label could not be analyzed right now.',
      );
      setPhase('error');
    }
  };

  const captureFromCamera = async () => {
    const uri = await pickCameraImage({ quality: 0.9 });
    if (!uri) return;
    setPhotoUri(uri);
    await analyze(uri);
  };

  const pickFromGallery = async () => {
    if (phase === 'analyzing') return;
    const uri = await pickLibraryImage({ quality: 0.9 });
    if (!uri) return;
    setPhotoUri(uri);
    await analyze(uri);
  };

  const scanAgain = () => {
    setSheetVisible(false);
    setAnalysis(null);
    setPhotoUri(undefined);
    setPhase('idle');
  };

  return (
    <FoodScreen contentStyle={{ gap: spacing.lg }}>
      <ScreenHeader
        eyebrow="Food"
        title="Scan Ingredient"
        leading={<FoodHeaderBackButton />}
      />

      {/* Viewfinder frame — the capture launcher for the system camera. */}
      <AgentTestId
        testID={AgentUiIds.food.scan.frameSection}
        label="Scan frame">
        <View
          style={[
            styles.frame,
            {
              borderColor: theme.separator,
              borderRadius: radii.xl,
              minHeight: s(300),
              padding: spacing.md,
            },
          ]}>
          {photoUri ? (
            <FoodImage
              source={photoUri}
              aspectRatio={3 / 4}
              placeholderIcon="scan"
              accessibilityLabel="Captured label photo"
              style={styles.framePhoto}
            />
          ) : (
            <View
              style={[
                styles.frameEmpty,
                { gap: spacing.md, paddingHorizontal: spacing.lg },
              ]}>
              <GlassIconWell size={Math.max(56, s(64))}>
                <Symbol name="scan" size="lg" color={theme.textSecondary} />
              </GlassIconWell>
              <AppText variant="callout" color="secondary" align="center">
                Frame the ingredient list, not the front of the pack.
              </AppText>
              <AppText variant="caption" color="tertiary" align="center">
                Good light and a flat label read best. Flash is available in the
                camera view.
              </AppText>
            </View>
          )}
        </View>
      </AgentTestId>

      {phase === 'analyzing' ? (
        <LoadingBlock label="Reading the label…" />
      ) : null}

      {phase === 'error' ? (
        <View style={{ gap: spacing.sm, alignItems: 'flex-start' }}>
          <ErrorMessage message={errorMessage} />
          {photoUri ? (
            <ActionChip
              label="Try again"
              icon="undo"
              testID={AgentUiIds.food.scan.retry}
              onPress={() => void analyze(photoUri)}
            />
          ) : null}
        </View>
      ) : null}

      <GlassPrimaryAction
        label={photoUri ? 'Scan another label' : 'Take a label photo'}
        icon="camera"
        onPress={photoUri ? scanAgain : captureFromCamera}
        disabled={phase === 'analyzing'}
        testID={AgentUiIds.food.scan.capture}
      />
      <View style={styles.centerRow}>
        <ActionChip
          label="Choose from library"
          icon="photo"
          testID={AgentUiIds.food.scan.gallery}
          onPress={pickFromGallery}
        />
      </View>

      {phase === 'done' && analysis && !sheetVisible ? (
        <View style={styles.centerRow}>
          <ActionChip
            label="Reopen analysis"
            icon="list"
            testID={AgentUiIds.food.scan.reopen}
            onPress={() => setSheetVisible(true)}
          />
        </View>
      ) : null}

      <AppText variant="caption" color="tertiary" align="center">
        Results describe label contents against your saved profile — they are
        not medical advice.
      </AppText>

      <ScanResultSheet
        visible={sheetVisible}
        analysis={analysis}
        offlineSample={offlineSample}
        onClose={() => setSheetVisible(false)}
        onScanAgain={scanAgain}
      />
    </FoodScreen>
  );
}

const styles = StyleSheet.create({
  frame: {
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderStyle: 'dashed',
    justifyContent: 'center',
  },
  framePhoto: {
    alignSelf: 'center',
    width: '86%',
  },
  frameEmpty: {
    alignItems: 'center',
  },
  centerRow: {
    flexDirection: 'row',
    justifyContent: 'center',
  },
});
