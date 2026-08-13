import { Image } from 'expo-image';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import {
  AppText,
  Button,
  DateField,
  ErrorMessage,
  GlassPlate,
  Input,
  SectionHeader,
  TimeField,
} from '@/components/primitives';
import { radii, spacing } from '@/design-system';
import type { Meal } from '@/types/models';
import { AgentUiIds } from '@/utils/agent-ui';

export const activityFormGlassCardStyle = {
  gap: spacing.md,
  padding: spacing.lg,
  borderRadius: radii.lg,
} as const;

export function ActivityFormScheduleCard({
  date,
  onDateChange,
  allDay,
  duration,
  onDurationChange,
  startMinutes,
  onStartMinutesChange,
  notes,
  onNotesChange,
  fieldFill,
  fieldBorder,
}: {
  date: string;
  onDateChange: (value: string) => void;
  allDay?: boolean;
  duration: string;
  onDurationChange: (value: string) => void;
  startMinutes: number;
  onStartMinutesChange: (value: number) => void;
  notes: string;
  onNotesChange: (value: string) => void;
  fieldFill: string;
  fieldBorder: string;
}) {
  return (
    <GlassPlate airy style={activityFormGlassCardStyle}>
      <SectionHeader title="Schedule" />
      <View style={[allDay ? styles.singleColumn : styles.twoColumns, { zIndex: 1 }]}>
        <View style={styles.flex}>
          <DateField
            label="Date"
            value={date}
            onChange={onDateChange}
            fieldBackground={fieldFill}
            fieldBorderColor={fieldBorder}
            testID={AgentUiIds.activityForm.date}
          />
        </View>
        {!allDay ? <View style={styles.flex}>
          <Input
            label="Duration (min)"
            value={duration}
            onChangeText={onDurationChange}
            keyboardType="number-pad"
            fieldBackground={fieldFill}
            fieldBorderColor={fieldBorder}
            testID={AgentUiIds.activityForm.duration}
          />
        </View> : null}
      </View>
      {allDay ? (
        <AppText variant="callout" color="secondary" fit>
          All-day event
        </AppText>
      ) : <TimeField
        label="Start Time"
        value={startMinutes}
        onChange={onStartMinutesChange}
        fieldBackground={fieldFill}
        fieldBorderColor={fieldBorder}
        testID={AgentUiIds.activityForm.startTime}
      />}
      <Input
        label="Notes"
        value={notes}
        onChangeText={onNotesChange}
        placeholder="Optional context"
        multiline
        style={styles.multiline}
        fieldBackground={fieldFill}
        fieldBorderColor={fieldBorder}
        testID={AgentUiIds.activityForm.notes}
      />
    </GlassPlate>
  );
}

export function ActivityFormPhotoCard({
  kind,
  photo,
  meal,
  analyzing,
  aiEnabled,
  analysisError,
  onPickPhoto,
  onAnalyze,
  onRemovePhoto,
}: {
  kind: 'food' | 'generic';
  photo: string | number | undefined;
  meal: Meal;
  analyzing: boolean;
  aiEnabled: boolean;
  analysisError?: string;
  onPickPhoto: (analyzeAfterPick: boolean) => void;
  onAnalyze: () => void;
  onRemovePhoto: () => void;
}) {
  if (kind === 'food') {
    return (
      <GlassPlate airy style={activityFormGlassCardStyle}>
        <SectionHeader title="Meal Photo Analysis" />
        <AppText variant="body" color="secondary" style={{ zIndex: 1 }}>
          Upload a clear photo to identify foods and estimate portions and nutrients. You can edit
          every result before saving.
        </AppText>
        {photo ? (
          <Image
            source={photo}
            style={styles.photo}
            contentFit={meal.photoProcessingVersion ? 'contain' : 'cover'}
            transition={160}
          />
        ) : null}
        <View style={[styles.twoColumns, { zIndex: 1 }]}>
          <Button
            onPress={() => onPickPhoto(aiEnabled)}
            disabled={analyzing}
            style={styles.flex}
            accessibilityLabel={
              photo ? 'Replace and analyze meal photo' : 'Upload and analyze meal photo'
            }
            testID={AgentUiIds.activityForm.pickPhoto}>
            {analyzing ? 'Analyzing meal…' : photo ? 'Replace & analyze' : 'Upload & analyze'}
          </Button>
          {photo ? (
            <Button
              variant="secondary"
              onPress={onAnalyze}
              disabled={analyzing || !aiEnabled}
              style={styles.flex}
              accessibilityLabel="Analyze meal photo again"
              testID={AgentUiIds.activityForm.analyzePhoto}>
              Analyze again
            </Button>
          ) : null}
        </View>
        {analyzing ? <ActivityIndicator style={styles.loader} /> : null}
        {!aiEnabled ? (
          <AppText variant="caption" color="secondary" style={{ zIndex: 1 }}>
            AI summaries are disabled in Profile. The image will be attached without analysis.
          </AppText>
        ) : null}
        {analysisError ? <ErrorMessage message={analysisError} /> : null}
        {meal.aiAnalysis ? (
          <GlassPlate airy style={[styles.analysisReady, { zIndex: 1 }]}>
            <AppText variant="bodyMedium">Analysis Ready</AppText>
            <AppText variant="caption" color="secondary">
              {meal.items.length} food item{meal.items.length === 1 ? '' : 's'} identified
              {meal.aiAnalysis.overallConfidence === undefined
                ? ''
                : ` · ${Math.round(meal.aiAnalysis.overallConfidence * 100)}% confidence`}
              . Review the values below before saving.
            </AppText>
          </GlassPlate>
        ) : null}
        {photo ? (
          <Button
            variant="ghost"
            onPress={onRemovePhoto}
            accessibilityLabel="Remove meal photo"
            testID={AgentUiIds.activityForm.removePhoto}>
            Remove photo
          </Button>
        ) : null}
      </GlassPlate>
    );
  }

  return (
    <GlassPlate airy style={activityFormGlassCardStyle}>
      <SectionHeader title="Photo" />
      {photo ? <Image source={photo} style={styles.photo} contentFit="cover" /> : null}
      <View style={[styles.twoColumns, { zIndex: 1 }]}>
        <Button
          variant="secondary"
          onPress={() => onPickPhoto(false)}
          style={styles.flex}
          accessibilityLabel="Choose photo"
          testID={AgentUiIds.activityForm.pickPhoto}>
          {photo ? 'Replace Photo' : 'Choose Photo'}
        </Button>
        {photo ? (
          <Button
            variant="ghost"
            onPress={onRemovePhoto}
            style={styles.flex}
            accessibilityLabel="Remove photo"
            testID={AgentUiIds.activityForm.removePhoto}>
            Remove
          </Button>
        ) : null}
      </View>
    </GlassPlate>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  singleColumn: { width: '100%' },
  twoColumns: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  multiline: { minHeight: 96, textAlignVertical: 'top' },
  photo: { width: '100%', height: 220, borderRadius: radii.lg, zIndex: 1 },
  analysisReady: { padding: spacing.md, gap: spacing.xs, borderRadius: radii.md },
  loader: { padding: spacing.md },
});
