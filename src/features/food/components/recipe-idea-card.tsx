import { StyleSheet, View } from 'react-native';

import {
    ActionChip,
    AppText,
    Card,
    GlassMetaChip,
    Symbol,
} from '@/components/primitives';
import type { AppIconName } from '@/design-system';
import { useResponsive } from '@/hooks/use-responsive';
import { useTheme } from '@/hooks/use-theme';
import type { RecipeIdeaSuggestion } from '@/services/food/types';
import { AgentUiIds } from '@/utils/agent-ui';

export interface RecipeIdeaCardProps {
  suggestion: RecipeIdeaSuggestion;
  saved: boolean;
  onSave: () => void;
}

/** "2 servings · 25 min" meta line (parts omitted when unknown). */
export function recipeIdeaMeta(suggestion: RecipeIdeaSuggestion): string {
  const parts = [
    `${suggestion.servings} ${suggestion.servings === 1 ? 'serving' : 'servings'}`,
  ];
  if (suggestion.totalMinutes) parts.push(`${suggestion.totalMinutes} min`);
  return parts.join(' · ');
}

/** Caveat shown for low-confidence ideas even when the model sent none. */
export function recipeIdeaCaveat(suggestion: RecipeIdeaSuggestion): string | undefined {
  if (suggestion.caveat) return suggestion.caveat;
  if (suggestion.confidence < 0.7) {
    return 'Lower confidence — double-check the ingredients before cooking.';
  }
  return undefined;
}

function DetailLine({
  icon,
  color,
  text,
  testID,
}: {
  icon: AppIconName;
  color: string;
  text: string;
  testID?: string;
}) {
  const { spacing } = useResponsive();
  return (
    <View style={[styles.detailRow, { gap: spacing.xs }]}>
      <Symbol name={icon} size="sm" color={color} />
      <AppText
        variant="caption"
        color="secondary"
        style={styles.shrinkText}
        testID={testID}>
        {text}
      </AppText>
    </View>
  );
}

/** One AI suggestion: why it fits, ingredient match, gaps, and Save. */
export function RecipeIdeaCard({ suggestion, saved, onSave }: RecipeIdeaCardProps) {
  const theme = useTheme();
  const { spacing } = useResponsive();
  const cardId = AgentUiIds.food.aiIdeas.result(suggestion.id);
  const caveat = recipeIdeaCaveat(suggestion);

  return (
    <Card testID={cardId} accessibilityLabel={suggestion.title}>
      <View style={{ gap: spacing.sm }}>
        <View style={[styles.titleRow, { gap: spacing.sm }]}>
          <AppText variant="subheading" numberOfLines={2} style={styles.shrinkText}>
            {suggestion.title}
          </AppText>
          <ActionChip
            label={saved ? 'Saved' : 'Save'}
            icon="bookmark"
            selected={saved}
            testID={AgentUiIds.food.aiIdeas.save(suggestion.id)}
            onPress={onSave}
          />
        </View>

        <AppText variant="callout" color="secondary">
          {suggestion.whyItFits}
        </AppText>

        <View style={[styles.metaRow, { gap: spacing.xs }]}>
          <GlassMetaChip accessibilityLabel={recipeIdeaMeta(suggestion)}>
            <Symbol name="timer" size="sm" color={theme.textSecondary} />
            <AppText variant="caption" color="secondary" numberOfLines={1}>
              {recipeIdeaMeta(suggestion)}
            </AppText>
          </GlassMetaChip>
        </View>

        <View style={{ gap: spacing.xs }}>
          {suggestion.usesFromAvailable.length > 0 ? (
            <DetailLine
              icon="check"
              color={theme.success}
              text={`Uses what you have: ${suggestion.usesFromAvailable.join(', ')}`}
            />
          ) : null}
          {suggestion.missingIngredients.length > 0 ? (
            <DetailLine
              icon="add"
              color={theme.textTertiary}
              text={`Missing: ${suggestion.missingIngredients.join(', ')}`}
            />
          ) : null}
          {suggestion.conflictsAvoided.length > 0 ? (
            <DetailLine
              icon="shield"
              color={theme.success}
              text={`Avoided: ${suggestion.conflictsAvoided.join(', ')}`}
            />
          ) : null}
          {suggestion.substitutions.length > 0 ? (
            <DetailLine
              icon="edit"
              color={theme.textTertiary}
              text={`Swaps: ${suggestion.substitutions.join(', ')}`}
            />
          ) : null}
          {caveat ? (
            <DetailLine icon="warning" color={theme.warning} text={caveat} />
          ) : null}
        </View>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  shrinkText: {
    flexShrink: 1,
    minWidth: 0,
  },
});
