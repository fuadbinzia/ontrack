import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import {
    ActionChip,
    AppText,
    Card,
    GlassMetaChip,
    SectionHeader,
    Symbol,
} from '@/components/primitives';
import { useResponsive } from '@/hooks/use-responsive';
import { useTheme } from '@/hooks/use-theme';
import { dietaryPreferenceLabel } from '@/services/food/labels';
import {
    assessIngredientSafety,
    profileHasSafetySignals,
    type IngredientSafetyAssessment,
} from '@/services/food/safety';
import type { IngredientScanAnalysis } from '@/services/food/types';
import { useFoodProfile } from '@/store/food-profile';
import type { IngredientKnowledge } from '@/types/food';
import { AgentTestId, AgentUiIds } from '@/utils/agent-ui';
import { formatDateKeyMedium } from '@/utils/date';
import { openHttpsUrl } from '@/utils/safe-url';

import {
    CountryRestrictionRow,
    IngredientSafetyRow,
    ingredientSafetyStatusForLevel,
} from './components';
import { FoodSheet } from './food-sheet';
import {
    findIngredientKnowledge,
    renderableJurisdictionStatuses,
} from './ingredient-knowledge';
import { ScanIngredientReview } from './scan-ingredient-review';

export interface ScanResultSheetProps {
  visible: boolean;
  analysis: IngredientScanAnalysis | null;
  /** Deterministic fixture result shown because the API was unreachable. */
  offlineSample: boolean;
  onClose: () => void;
  onScanAgain: () => void;
}

interface AssessedIngredient {
  name: string;
  assessment: IngredientSafetyAssessment;
  knowledge?: IngredientKnowledge;
}

function percent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

/**
 * Scan result sheet. When `reviewRequired` is set the user is routed through
 * an editable correction step FIRST — analysis is never presented as
 * conclusive until the ingredient list is confirmed (hard requirement).
 * Result order follows the mandated screen-reader order: product/confidence →
 * ingredients → personalized concerns → conflicts → country restrictions →
 * why used → evidence → alternatives.
 */
export function ScanResultSheet({
  visible,
  analysis,
  offlineSample,
  onClose,
  onScanAgain,
}: ScanResultSheetProps) {
  const router = useRouter();
  const theme = useTheme();
  const { spacing } = useResponsive();
  const profile = useFoodProfile((state) => state.profile);

  const [step, setStep] = useState<'review' | 'results'>('results');
  const [names, setNames] = useState<string[]>([]);
  const [userCorrected, setUserCorrected] = useState(false);

  useEffect(() => {
    if (!analysis) return;
    setNames(analysis.ingredients.map((ingredient) => ingredient.name));
    setStep(analysis.reviewRequired ? 'review' : 'results');
    setUserCorrected(false);
  }, [analysis]);

  const profileInformed = profileHasSafetySignals(profile);
  const confirmedNames = useMemo(
    () => names.map((name) => name.trim()).filter(Boolean),
    [names],
  );

  const assessed = useMemo<AssessedIngredient[]>(
    () =>
      confirmedNames.map((name) => ({
        name,
        assessment: assessIngredientSafety(name, profile),
        knowledge: findIngredientKnowledge(name),
      })),
    [confirmedNames, profile],
  );

  const allergyConcerns = assessed.filter((entry) =>
    ['mild', 'moderate', 'severe'].includes(entry.assessment.level),
  );
  const preferenceConflicts = assessed.filter(
    (entry) => entry.assessment.level === 'avoided',
  );
  const dietaryConflicts = assessed.flatMap((entry) =>
    entry.knowledge
      ? profile.dietaryPreferences
          .filter(
            (preference) =>
              entry.knowledge!.dietaryCompatibility[preference] === 'incompatible',
          )
          .map((preference) => ({
            name: entry.name,
            preference: dietaryPreferenceLabel(preference),
          }))
      : [],
  );
  const withKnowledge = assessed.filter((entry) => entry.knowledge);

  if (!analysis) return null;

  const openIngredientDetail = (knowledge: IngredientKnowledge) => {
    onClose();
    router.push(`/(tabs)/food/ingredients/${knowledge.canonicalKey}` as never);
  };

  if (step === 'review') {
    return (
      <ScanIngredientReview
        visible={visible}
        overallConfidence={analysis.overallConfidence}
        names={names}
        onChangeNames={setNames}
        onClose={onClose}
        onConfirm={() => {
          setUserCorrected(true);
          setStep('results');
        }}
        confirmDisabled={confirmedNames.length === 0}
      />
    );
  }

  return (
    <FoodSheet
      visible={visible}
      name="scan"
      eyebrow="Scan"
      title={analysis.productName ?? 'Scanned product'}
      subtitle={`Read with ${percent(analysis.overallConfidence)} confidence`}
      subtitleIcon="scan"
      onClose={onClose}
      doneLabel="Done"
      onDone={onClose}
      contentContainerStyle={{ gap: spacing.md }}>
      <AgentTestId
        testID={AgentUiIds.food.scan.resultSection}
        label="Scan analysis"
        style={{ gap: spacing.md }}>
        {/* 1 — detected product + confidence context */}
        <View style={[styles.chipRow, { gap: spacing.xs }]}>
          <GlassMetaChip accessibilityLabel={`Product confidence ${percent(analysis.productConfidence)}`}>
            <Symbol name="scan" size="sm" color={theme.textSecondary} />
            <AppText variant="caption" color="secondary" numberOfLines={1}>
              {`Product ${percent(analysis.productConfidence)}`}
            </AppText>
          </GlassMetaChip>
          {userCorrected ? (
            <GlassMetaChip accessibilityLabel="Ingredient list corrected by you">
              <Symbol name="check" size="sm" color={theme.success} />
              <AppText variant="caption" color="secondary" numberOfLines={1}>
                Corrected by you
              </AppText>
            </GlassMetaChip>
          ) : null}
          {offlineSample ? (
            <GlassMetaChip accessibilityLabel="Offline sample result">
              <Symbol name="warning" size="sm" color={theme.warning} />
              <AppText variant="caption" color="secondary" numberOfLines={1}>
                Offline sample
              </AppText>
            </GlassMetaChip>
          ) : null}
        </View>
        {analysis.observations.map((observation) => (
          <AppText key={observation} variant="caption" color="tertiary">
            {observation}
          </AppText>
        ))}

        {/* 2 — ingredient list */}
        <SectionHeader flush title="Ingredients" />
        {!profileInformed ? (
          <AppText variant="caption" color="tertiary">
            No allergies or preferences saved — this list is not checked against
            personal restrictions.
          </AppText>
        ) : null}
        <View style={{ gap: spacing.xs }}>
          {assessed.map((entry) => {
            const status = ingredientSafetyStatusForLevel(entry.assessment.level);
            const onPress = entry.knowledge
              ? () => openIngredientDetail(entry.knowledge!)
              : undefined;
            if (!status) {
              return (
                <Card key={entry.name} padded={false} onPress={onPress} accessibilityLabel={entry.name}>
                  <View style={[styles.plainRow, { padding: spacing.md, gap: spacing.sm }]}>
                    <AppText variant="body" numberOfLines={1} style={styles.shrinkText}>
                      {entry.name}
                    </AppText>
                    {onPress ? (
                      <Symbol name="chevron-right" size="sm" color={theme.textTertiary} />
                    ) : null}
                  </View>
                </Card>
              );
            }
            return (
              <IngredientSafetyRow
                key={entry.name}
                name={entry.name}
                status={status}
                reason={entry.assessment.reason}
                onPress={onPress}
              />
            );
          })}
        </View>

        {/* 3 — personalized concerns */}
        <SectionHeader flush title="Personalized concerns" />
        {allergyConcerns.length > 0 ? (
          allergyConcerns.map((entry) => (
            <AppText key={entry.name} variant="callout" color="secondary">
              {`${entry.name} — ${entry.assessment.reason}`}
            </AppText>
          ))
        ) : (
          <AppText variant="caption" color="tertiary">
            {profileInformed
              ? 'No allergy conflicts found in this list.'
              : 'Add allergies in Diet & Preferences to see personalized concerns.'}
          </AppText>
        )}

        {/* 4 — allergy/preference conflicts */}
        {preferenceConflicts.length > 0 || dietaryConflicts.length > 0 ? (
          <>
            <SectionHeader flush title="Preference conflicts" />
            {preferenceConflicts.map((entry) => (
              <AppText key={entry.name} variant="callout" color="secondary">
                {`${entry.name} — ${entry.assessment.reason}`}
              </AppText>
            ))}
            {dietaryConflicts.map((conflict) => (
              <AppText
                key={`${conflict.name}-${conflict.preference}`}
                variant="callout"
                color="secondary">
                {`${conflict.name} — listed as incompatible with ${conflict.preference}.`}
              </AppText>
            ))}
          </>
        ) : null}

        {/* 5 — country restrictions */}
        {withKnowledge.some(
          (entry) => renderableJurisdictionStatuses(entry.knowledge!).length > 0,
        ) ? (
          <>
            <SectionHeader flush title="Country restrictions" />
            {withKnowledge.map((entry) =>
              renderableJurisdictionStatuses(entry.knowledge!).map((status) => (
                <CountryRestrictionRow
                  key={`${entry.knowledge!.canonicalKey}-${status.countryCode}`}
                  status={status}
                  onPress={() => void openHttpsUrl(status.sourceUrl)}
                />
              )),
            )}
            <AppText variant="caption" color="tertiary">
              A status describes one jurisdiction&apos;s rules for a specific use —
              &ldquo;Banned&rdquo; does not by itself mean dangerous.
            </AppText>
          </>
        ) : null}

        {/* 6 — why the ingredient is used */}
        {withKnowledge.some((entry) => entry.knowledge!.functionalPurpose) ? (
          <>
            <SectionHeader flush title="Why it's used" />
            {withKnowledge
              .filter((entry) => entry.knowledge!.functionalPurpose)
              .map((entry) => (
                <AppText key={entry.name} variant="callout" color="secondary">
                  {`${entry.knowledge!.name} — ${entry.knowledge!.functionalPurpose}`}
                </AppText>
              ))}
          </>
        ) : null}

        {/* 7 — evidence category */}
        <SectionHeader flush title="Evidence" />
        <AppText variant="caption" color="tertiary">
          {`AI label reading (${percent(analysis.overallConfidence)} confidence)${userCorrected ? ', corrected by you' : ''}.`}
        </AppText>
        {withKnowledge.flatMap((entry) =>
          entry.knowledge!.sources.map((source) => (
            <AppText
              key={`${entry.knowledge!.canonicalKey}-${source.url}`}
              variant="caption"
              color="tertiary">
              {`${source.title} — reviewed ${formatDateKeyMedium(entry.knowledge!.lastReviewedAt.slice(0, 10))}`}
            </AppText>
          )),
        )}

        {/* 8 — safer alternatives */}
        {withKnowledge.some((entry) => entry.knowledge!.alternatives.length > 0) ? (
          <>
            <SectionHeader flush title="Safer alternatives" />
            {withKnowledge
              .filter((entry) => entry.knowledge!.alternatives.length > 0)
              .map((entry) => (
                <AppText key={entry.name} variant="callout" color="secondary">
                  {`Instead of ${entry.knowledge!.name.toLowerCase()}: ${entry.knowledge!.alternatives.join(', ')}`}
                </AppText>
              ))}
            <AppText variant="caption" color="tertiary">
              Preference-compatible options — not medical guarantees.
            </AppText>
          </>
        ) : null}

        <AppText variant="caption" color="tertiary">
          {analysis.disclaimer}
        </AppText>

        <View style={styles.chipRow}>
          <ActionChip
            label="Scan another label"
            icon="camera"
            testID={AgentUiIds.food.scan.retake}
            onPress={onScanAgain}
          />
        </View>
      </AgentTestId>
    </FoodSheet>
  );
}

const styles = StyleSheet.create({
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  plainRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  shrinkText: {
    flexShrink: 1,
    minWidth: 0,
  },
});
