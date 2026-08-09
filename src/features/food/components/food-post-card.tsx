import { Pressable, StyleSheet, View } from 'react-native';

import {
  ActionChip,
  AppText,
  Card,
  FoodImage,
  GlassMetaChip,
  IconButton,
  Symbol,
  fieldTitleCase,
} from '@/components/primitives';
import type { AppIconName } from '@/design-system';
import { ProfileAvatar } from '@/features/account/profile-avatar';
import { foodPostImageSource } from '@/features/food/food-image-source';
import { useResponsive } from '@/hooks/use-responsive';
import { useTheme } from '@/hooks/use-theme';
import type { FoodPost } from '@/types/food';
import { AgentUiIds, useAgentUiTarget } from '@/utils/agent-ui';
import { formatDateLong, todayKey } from '@/utils/date';
import { haptics } from '@/utils/haptics';

const HOUR_MS = 60 * 60 * 1000;

/** "Just now" → "5h" → "3d" → "Jan 1" — quiet feed chrome. */
export function postTimeLabel(createdAtIso: string, now = new Date()): string {
  const created = new Date(createdAtIso);
  const elapsedMs = now.getTime() - created.getTime();
  if (!Number.isFinite(elapsedMs) || elapsedMs < 0) {
    return formatDateLong(createdAtIso.slice(0, 10) || todayKey());
  }
  if (elapsedMs < HOUR_MS) return 'Just now';
  if (elapsedMs < 24 * HOUR_MS) return `${Math.floor(elapsedMs / HOUR_MS)}h`;
  const days = Math.floor(elapsedMs / (24 * HOUR_MS));
  if (days <= 6) return `${days}d`;
  return formatDateLong(createdAtIso.slice(0, 10));
}

export interface FoodPostCardProps {
  post: FoodPost;
  liked: boolean;
  likeCount: number;
  saved: boolean;
  /** Resolved saved-recipe title when the post links one. */
  recipeTitle?: string;
  onToggleLike: () => void;
  onToggleSave: () => void;
  onShare: () => void;
  onOpenRecipe?: () => void;
  onReport: () => void;
}

/** Community post card — avatar/name/time, media, caption, tags, actions. */
export function FoodPostCard({
  post,
  liked,
  likeCount,
  saved,
  recipeTitle,
  onToggleLike,
  onToggleSave,
  onShare,
  onOpenRecipe,
  onReport,
}: FoodPostCardProps) {
  const theme = useTheme();
  const { spacing, s } = useResponsive();
  const title = recipeTitle?.trim();
  const mediaSource = foodPostImageSource(post);

  return (
    <Card style={{ gap: spacing.md }} testID={AgentUiIds.food.community.post(post.id)}>
      <View style={[styles.headerRow, { gap: spacing.sm }]}>
        <ProfileAvatar
          displayName={post.authorName}
          userId={post.authorId}
          size={Math.max(36, s(38))}
        />
        <View style={styles.headerCopy}>
          <AppText variant="callout" fit numberOfLines={1}>
            {post.authorName}
          </AppText>
          <AppText variant="caption" color="tertiary" numberOfLines={1}>
            {postTimeLabel(post.createdAt)}
          </AppText>
        </View>
        <IconButton
          icon="more"
          size={40}
          background="transparent"
          accessibilityLabel="Report content"
          testID={AgentUiIds.food.community.options(post.id)}
          onPress={onReport}
        />
      </View>

      {title ? (
        <AppText variant="subheading" numberOfLines={2}>
          {title}
        </AppText>
      ) : null}

      {mediaSource ? (
        <FoodImage
          source={mediaSource}
          accessibilityLabel={title ?? 'Food photo'}
          placeholderIcon="food"
        />
      ) : null}

      <AppText variant="body">{post.caption}</AppText>

      {post.dietaryTags.length > 0 ? (
        <View style={[styles.tagRow, { gap: spacing.xs }]}>
          {post.dietaryTags.map((tag) => (
            <GlassMetaChip key={tag} accessibilityLabel={tag}>
              <AppText variant="caption" color="secondary" fit>
                {fieldTitleCase(tag)}
              </AppText>
            </GlassMetaChip>
          ))}
        </View>
      ) : null}

      <View style={[styles.actionRow, { gap: spacing.lg }]}>
        <PostAction
          icon={liked ? 'favorite-filled' : 'favorite'}
          color={liked ? theme.danger : theme.textSecondary}
          count={likeCount}
          label={liked ? 'Unlike' : 'Like'}
          testID={AgentUiIds.food.community.like(post.id)}
          onPress={onToggleLike}
        />
        {/* Comments are read-only until a food social backend exists. */}
        <View
          accessible
          accessibilityLabel={`${post.commentCount} comments`}
          style={[styles.metaPair, { gap: spacing.xs }]}>
          <Symbol name="chat" size="sm" color={theme.textTertiary} />
          <AppText variant="caption" color="tertiary">
            {`${post.commentCount}`}
          </AppText>
        </View>
        <PostAction
          icon="bookmark"
          color={saved ? theme.accentPrimary : theme.textSecondary}
          label={saved ? 'Remove from saved' : 'Save post'}
          testID={AgentUiIds.food.community.save(post.id)}
          onPress={onToggleSave}
        />
        <PostAction
          icon="share"
          color={theme.textSecondary}
          label="Share post"
          testID={AgentUiIds.food.community.share(post.id)}
          onPress={onShare}
        />
        <View style={styles.spacer} />
        {onOpenRecipe ? (
          <ActionChip
            label="View Recipe"
            icon="recipe"
            testID={AgentUiIds.food.community.viewRecipe(post.id)}
            onPress={onOpenRecipe}
          />
        ) : null}
      </View>
    </Card>
  );
}

function PostAction({
  icon,
  color,
  count,
  label,
  testID,
  onPress,
}: {
  icon: AppIconName;
  color: string;
  count?: number;
  label: string;
  testID: string;
  onPress: () => void;
}) {
  const { spacing, layout } = useResponsive();
  const handlePress = () => {
    haptics.select();
    onPress();
  };
  const agent = useAgentUiTarget(testID, { label, onPress: handlePress });

  return (
    <Pressable
      ref={agent.ref}
      testID={agent.testID}
      onLayout={agent.onLayout}
      accessibilityRole="button"
      accessibilityLabel={count == null ? label : `${label}. ${count}`}
      onPress={handlePress}
      hitSlop={6}
      style={({ pressed }) => [
        styles.metaPair,
        {
          gap: spacing.xs,
          minHeight: layout.minTapTarget,
          opacity: pressed ? 0.72 : 1,
        },
      ]}>
      <Symbol name={icon} size="sm" color={color} />
      {count == null ? null : (
        <AppText variant="caption" color="secondary">
          {`${count}`}
        </AppText>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerCopy: {
    flex: 1,
    minWidth: 0,
  },
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  metaPair: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  spacer: {
    flex: 1,
  },
});
