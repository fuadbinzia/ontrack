import { useLocalSearchParams } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import {
  AppText,
  Card,
  EmptyState,
  GlassIconWell,
  HeaderBackButton,
  ScreenHeader,
  SectionHeader,
  StatusBadge,
  Symbol,
} from '@/components/primitives';
import {
  CountryRestrictionRow,
  ingredientSafetyIcon,
  ingredientSafetyLabel,
  ingredientSafetyStatusForLevel,
  ingredientSafetyTone,
} from '@/features/food/components';
import { FoodScreen } from '@/features/food/food-screen';
import {
  findIngredientKnowledge,
  renderableJurisdictionStatuses,
} from '@/features/food/ingredient-knowledge';
import { useResponsive } from '@/hooks/use-responsive';
import { useTheme } from '@/hooks/use-theme';
import { dietaryPreferenceLabel } from '@/services/food/labels';
import { assessIngredientSafety } from '@/services/food/safety';
import { useFoodProfile } from '@/store/food-profile';
import { AgentTestId, AgentUiIds } from '@/utils/agent-ui';
import { formatDateKeyMedium } from '@/utils/date';
import { openHttpsUrl } from '@/utils/safe-url';

/**
 * Ingredient knowledge detail. Regulatory statuses render only when sourced
 * (`renderableJurisdictionStatuses`) and "Banned" is always framed as a
 * jurisdiction's rule for a use — never as "dangerous".
 */
export default function FoodIngredientDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const theme = useTheme();
  const { spacing, s } = useResponsive();
  const profile = useFoodProfile((state) => state.profile);

  const knowledge = findIngredientKnowledge(String(id ?? ''));

  if (!knowledge) {
    return (
      <FoodScreen contentStyle={{ gap: spacing.lg }}>
        <ScreenHeader
          eyebrow="Food"
          title="Ingredient Info"
          leading={
            <HeaderBackButton
              compact
              testID={AgentUiIds.food.ingredients.detail.back}
            />
          }
        />
        <AgentTestId
          testID={AgentUiIds.food.ingredients.detail.section}
          label="Ingredient detail"
          style={{ gap: spacing.lg }}>
          <EmptyState
            icon="search"
            title="Not in the knowledge base yet"
            message="This ingredient has no reviewed entry. Try searching for an alias or E-number."
          />
        </AgentTestId>
      </FoodScreen>
    );
  }

  const assessment = assessIngredientSafety(knowledge.name, profile);
  const status = ingredientSafetyStatusForLevel(assessment.level);
  const dietaryNotes = profile.dietaryPreferences
    .map((preference) => ({
      label: dietaryPreferenceLabel(preference),
      compatibility: knowledge.dietaryCompatibility[preference],
    }))
    .filter((note) => note.compatibility !== undefined);
  const statuses = renderableJurisdictionStatuses(knowledge);
  const hasRegulatoryFlag = statuses.some(
    (entry) => entry.status !== 'allowed',
  );

  return (
    <FoodScreen contentStyle={{ gap: spacing.lg }}>
      <ScreenHeader
        eyebrow="Food"
        title={knowledge.name}
        leading={
          <HeaderBackButton
            compact
            testID={AgentUiIds.food.ingredients.detail.back}
          />
        }
      />

      <AgentTestId
        testID={AgentUiIds.food.ingredients.detail.section}
        label="Ingredient detail"
        style={{ gap: spacing.lg }}>
        {knowledge.aliases.length > 0 ? (
          <AppText variant="callout" color="secondary">
            {`Also listed as: ${knowledge.aliases.join(', ')}`}
          </AppText>
        ) : null}

        <SectionHeader flush title="For you" />
        {status ? (
          <Card padded={false}>
            <View
              style={[
                styles.row,
                { minHeight: s(56), padding: spacing.md, gap: spacing.md },
              ]}>
              <GlassIconWell size={Math.max(36, s(38))}>
                <Symbol
                  name={ingredientSafetyIcon(status)}
                  size="sm"
                  color={theme.textSecondary}
                />
              </GlassIconWell>
              <AppText
                variant="callout"
                color="secondary"
                style={styles.shrinkText}>
                {assessment.reason}
              </AppText>
              <StatusBadge
                label={ingredientSafetyLabel(status)}
                tone={ingredientSafetyTone(status)}
              />
            </View>
          </Card>
        ) : (
          <AppText variant="caption" color="tertiary">
            {assessment.reason}
          </AppText>
        )}
        {dietaryNotes.map((note) => (
          <AppText key={note.label} variant="caption" color="secondary">
            {note.compatibility === 'compatible'
              ? `Listed as compatible with ${note.label}.`
              : note.compatibility === 'incompatible'
                ? `Listed as incompatible with ${note.label}.`
                : `Compatibility with ${note.label} depends on the source — check the label.`}
          </AppText>
        ))}

        {knowledge.functionalPurpose ? (
          <>
            <SectionHeader flush title="Why it's used" />
            <AppText variant="callout" color="secondary">
              {knowledge.functionalPurpose}
            </AppText>
          </>
        ) : null}

        {statuses.length > 0 ? (
          <>
            <SectionHeader flush title="Country by country" />
            <View style={{ gap: spacing.sm }}>
              {statuses.map((entry) => (
                <CountryRestrictionRow
                  key={entry.countryCode}
                  status={entry}
                  onPress={() => void openHttpsUrl(entry.sourceUrl)}
                />
              ))}
            </View>
            {hasRegulatoryFlag ? (
              <AppText variant="caption" color="tertiary">
                A status reflects one jurisdiction&apos;s rules for a specific
                use. &ldquo;Banned&rdquo; or &ldquo;restricted&rdquo; describes
                regulation, not danger by itself — many factors set those rules.
              </AppText>
            ) : null}
          </>
        ) : null}

        {knowledge.concerns.length > 0 ? (
          <>
            <SectionHeader flush title="Why the flags?" />
            {knowledge.concerns.map((concern) => (
              <AppText key={concern} variant="callout" color="secondary">
                {concern}
              </AppText>
            ))}
          </>
        ) : null}

        <SectionHeader flush title="Evidence" />
        {knowledge.sources.map((source, index) => (
          <Card
            key={source.url}
            padded={false}
            accessibilityLabel={`Source: ${source.title}`}
            testID={AgentUiIds.food.ingredients.detail.source(index)}
            onPress={() => void openHttpsUrl(source.url)}>
            <View
              style={[
                styles.row,
                { minHeight: s(52), padding: spacing.md, gap: spacing.md },
              ]}>
              <Symbol name="link" size="sm" color={theme.textSecondary} />
              <AppText
                variant="caption"
                color="secondary"
                numberOfLines={2}
                style={styles.shrinkText}>
                {source.title}
              </AppText>
              <Symbol name="chevron-right" size="sm" color={theme.textTertiary} />
            </View>
          </Card>
        ))}
        <AppText variant="caption" color="tertiary">
          {`Last reviewed ${formatDateKeyMedium(knowledge.lastReviewedAt.slice(0, 10))}.`}
        </AppText>

        {knowledge.alternatives.length > 0 ? (
          <>
            <SectionHeader flush title="Alternatives" />
            {knowledge.alternatives.map((alternative) => (
              <AppText key={alternative} variant="callout" color="secondary">
                {alternative}
              </AppText>
            ))}
            <AppText variant="caption" color="tertiary">
              Preference-compatible options — not medical guarantees.
            </AppText>
          </>
        ) : null}
      </AgentTestId>
    </FoodScreen>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  shrinkText: {
    flex: 1,
    minWidth: 0,
  },
});
