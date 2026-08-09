import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import {
  ActionChip,
  AppText,
  GlassMetaChip,
  Input,
  appPrompt,
  fieldTitleCase,
} from '@/components/primitives';
import { FoodSheet } from '@/features/food/food-sheet';
import {
  publishFoodPost,
  reportFoodPost,
} from '@/features/food/community-data';
import { useResponsive } from '@/hooks/use-responsive';
import {
  buildFoodPostPayload,
  buildShareProfilePreview,
} from '@/services/food/community';
import { useFoodProfile } from '@/store/food-profile';
import type { FoodPost, Recipe } from '@/types/food';
import { AgentTestId, AgentUiIds } from '@/utils/agent-ui';
import { haptics } from '@/utils/haptics';

const RECIPE_CHIP_LIMIT = 8;

/** Composer author — session-local until a food social backend exists. */
const LOCAL_AUTHOR_ID = 'user-local-me';

export function PostComposerSheet({
  visible,
  recipes,
  initialRecipeId,
  authorName,
  onClose,
  onPosted,
}: {
  visible: boolean;
  recipes: readonly Recipe[];
  initialRecipeId?: string;
  authorName: string;
  onClose: () => void;
  onPosted: (post: FoodPost) => void;
}) {
  const { spacing } = useResponsive();
  const profile = useFoodProfile((state) => state.profile);
  const [caption, setCaption] = useState('');
  const [recipeId, setRecipeId] = useState<string | undefined>(initialRecipeId);

  useEffect(() => {
    if (!visible) return;
    setCaption('');
    setRecipeId(initialRecipeId);
  }, [visible, initialRecipeId]);

  const preview = buildShareProfilePreview(profile);
  const sharedTags = [...preview.dietaryPreferences, ...preview.allergies];
  const recipeChips = (() => {
    const recent = [...recipes]
      .sort((a, b) => b.savedAt.localeCompare(a.savedAt))
      .slice(0, RECIPE_CHIP_LIMIT);
    const selected = recipes.find((recipe) => recipe.id === recipeId);
    return selected && !recent.some((recipe) => recipe.id === selected.id)
      ? [selected, ...recent]
      : recent;
  })();

  const publish = () => {
    const selected = recipes.find((recipe) => recipe.id === recipeId);
    const payload = buildFoodPostPayload(
      { caption, recipeId: selected?.id, recipeTitle: selected?.title },
      profile,
    );
    const post = publishFoodPost(payload, {
      id: LOCAL_AUTHOR_ID,
      name: authorName,
    });
    haptics.success();
    onPosted(post);
    onClose();
  };

  return (
    <FoodSheet
      visible={visible}
      name="postComposer"
      title="Share with the Community"
      subtitle="Recipes and meals only — health data stays private"
      subtitleIcon="shield"
      onClose={onClose}
      doneLabel="Post"
      doneIcon="send"
      onDone={publish}
      doneDisabled={!caption.trim()}
      contentContainerStyle={{ gap: spacing.lg }}>
      <Input
        stackedLabel="Caption"
        placeholder="What did you cook?"
        value={caption}
        onChangeText={setCaption}
        multiline
        maxLength={400}
        testID={AgentUiIds.food.community.composerCaption}
      />

      {recipeChips.length > 0 ? (
        <View style={{ gap: spacing.sm }}>
          <AppText variant="overline" color="tertiary" fit>
            Attach a Recipe (Optional)
          </AppText>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: spacing.sm }}>
            {recipeChips.map((recipe) => (
              <ActionChip
                key={recipe.id}
                label={recipe.title}
                icon="recipe"
                selected={recipeId === recipe.id}
                testID={AgentUiIds.food.community.composerRecipe(recipe.id)}
                onPress={() =>
                  setRecipeId((current) =>
                    current === recipe.id ? undefined : recipe.id,
                  )
                }
              />
            ))}
          </ScrollView>
        </View>
      ) : null}

      <AgentTestId
        testID={AgentUiIds.food.community.composerPrivacy}
        label="Post privacy"
        style={{ gap: spacing.sm }}>
        <AppText variant="overline" color="tertiary" fit>
          Privacy
        </AppText>
        {sharedTags.length > 0 ? (
          <View style={[styles.tagRow, { gap: spacing.xs }]}>
            {sharedTags.map((tag) => (
              <GlassMetaChip key={tag} accessibilityLabel={tag}>
                <AppText variant="caption" color="secondary" fit>
                  {fieldTitleCase(tag)}
                </AppText>
              </GlassMetaChip>
            ))}
          </View>
        ) : null}
        <AppText variant="caption" color="secondary">
          {sharedTags.length > 0
            ? 'These profile tags ride along because you turned sharing on in Diet & Preferences.'
            : 'Health data is private by default — allergies and diet preferences never join a post unless you turn sharing on in Diet & Preferences.'}
        </AppText>
      </AgentTestId>
    </FoodSheet>
  );
}

const REPORT_REASONS = [
  { key: 'spam', label: 'Spam or ads' },
  { key: 'unsafe', label: 'Unsafe food advice' },
  { key: 'inappropriate', label: 'Inappropriate content' },
  { key: 'other', label: 'Something else' },
] as const;

export function ReportContentSheet({
  visible,
  postId,
  onClose,
  onReported,
}: {
  visible: boolean;
  postId?: string;
  onClose: () => void;
  /** Fires only on submit so the feed can hide the post right away. */
  onReported?: (postId: string) => void;
}) {
  const { spacing } = useResponsive();
  const [reason, setReason] = useState<string | undefined>();
  const [note, setNote] = useState('');

  useEffect(() => {
    if (!visible) return;
    setReason(undefined);
    setNote('');
  }, [visible]);

  const submit = () => {
    if (!postId || !reason) return;
    reportFoodPost(postId);
    onReported?.(postId);
    onClose();
    appPrompt.alert(
      'Thanks for the report',
      'We will review this post. It stays hidden from your feed in the meantime.',
    );
  };

  return (
    <FoodSheet
      visible={visible}
      name="reportContent"
      title="Report Content"
      subtitle="Tell us what's wrong with this post"
      subtitleIcon="warning"
      onClose={onClose}
      doneLabel="Submit Report"
      doneIcon="warning"
      onDone={submit}
      doneDisabled={!reason}
      contentContainerStyle={{ gap: spacing.lg }}>
      <View style={[styles.tagRow, { gap: spacing.sm }]}>
        {REPORT_REASONS.map((item) => (
          <ActionChip
            key={item.key}
            label={item.label}
            selected={reason === item.key}
            testID={AgentUiIds.food.community.reportReason(item.key)}
            onPress={() => setReason(item.key)}
          />
        ))}
      </View>
      <Input
        stackedLabel="Details (Optional)"
        placeholder="Anything that helps us review faster"
        value={note}
        onChangeText={setNote}
        multiline
        maxLength={300}
        testID={AgentUiIds.food.community.reportNote}
      />
    </FoodSheet>
  );
}

const styles = StyleSheet.create({
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
  },
});
