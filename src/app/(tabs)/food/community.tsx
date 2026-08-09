import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Share, StyleSheet, View } from 'react-native';

import {
    ActionChip,
    AppText,
    Card,
    EmptyState,
    HeaderBackButton,
    IconButton,
    ScreenHeader,
    SegmentedControl,
} from '@/components/primitives';
import { ProfileAvatar } from '@/features/account/profile-avatar';
import {
    filterFollowingPosts,
    isFoodPostReported,
    loadFoodFeed,
    suggestedCreators,
    type CommunityTab,
} from '@/features/food/community-data';
import {
    PostComposerSheet,
    ReportContentSheet,
} from '@/features/food/community-sheets';
import { FoodPostCard } from '@/features/food/components';
import { FoodScreen } from '@/features/food/food-screen';
import { useResponsive } from '@/hooks/use-responsive';
import { selectRecipeById, useRecipes } from '@/store/food-recipes';
import { usePreferences } from '@/store/preferences';
import type { FoodPost } from '@/types/food';
import { AgentTestId, AgentUiIds } from '@/utils/agent-ui';

const TABS: readonly { value: CommunityTab; label: string }[] = [
  { value: 'forYou', label: 'For You' },
  { value: 'following', label: 'Following' },
];

/** Community feed — SCREENS.md §8; fixture-backed until a social backend exists. */
export default function FoodCommunityScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ compose?: string }>();
  const { spacing } = useResponsive();
  const recipes = useRecipes((state) => state.recipes);
  const name = usePreferences((state) => state.name);

  const [tab, setTab] = useState<CommunityTab>('forYou');
  const [posts, setPosts] = useState<FoodPost[]>(() => loadFoodFeed());
  const [likedOverrides, setLikedOverrides] = useState<Record<string, boolean>>({});
  const [savedOverrides, setSavedOverrides] = useState<Record<string, boolean>>({});
  const [followedIds, setFollowedIds] = useState<ReadonlySet<string>>(new Set());
  const [composerVisible, setComposerVisible] = useState(false);
  const [composeRecipeId, setComposeRecipeId] = useState<string | undefined>();
  const [reportPostId, setReportPostId] = useState<string | undefined>();

  // Share Recipe sheet hands off here with `?compose=<recipeId>`.
  useEffect(() => {
    if (typeof params.compose !== 'string' || !params.compose) return;
    setComposeRecipeId(params.compose);
    setComposerVisible(true);
    router.setParams({ compose: '' });
  }, [params.compose, router]);

  const visiblePosts = useMemo(
    () => posts.filter((post) => !isFoodPostReported(post.id)),
    [posts],
  );
  const feedPosts = useMemo(
    () =>
      tab === 'forYou'
        ? visiblePosts
        : filterFollowingPosts(visiblePosts, followedIds),
    [tab, visiblePosts, followedIds],
  );
  const creators = useMemo(() => suggestedCreators(visiblePosts), [visiblePosts]);

  const toggleOverride = (
    setter: typeof setLikedOverrides,
    post: FoodPost,
    base: boolean,
  ) =>
    setter((current) => ({
      ...current,
      [post.id]: !(current[post.id] ?? base),
    }));

  const sharePost = (post: FoodPost, recipeTitle?: string) => {
    // Caption + recipe title only — never profile data.
    void Share.share({
      message: [recipeTitle, post.caption].filter(Boolean).join('\n'),
    });
  };

  return (
    <FoodScreen contentStyle={{ gap: spacing.lg }}>
      <ScreenHeader
        eyebrow="Food"
        title="Community"
        subtitle="What friends and creators are cooking"
        leading={<HeaderBackButton compact />}
        trailing={
          <IconButton
            icon="add"
            accessibilityLabel="Share with the community"
            testID={AgentUiIds.food.community.compose}
            onPress={() => {
              setComposeRecipeId(undefined);
              setComposerVisible(true);
            }}
          />
        }
      />

      <SegmentedControl
        value={tab}
        onChange={setTab}
        options={TABS.map((item) => ({
          ...item,
          testID: AgentUiIds.food.community.tab(item.value),
        }))}
      />

      <AgentTestId
        testID={AgentUiIds.food.community.feedSection}
        label="Community feed"
        style={{ gap: spacing.lg }}>
        {feedPosts.length > 0 ? (
          feedPosts.map((post) => {
            const liked = likedOverrides[post.id] ?? post.likedByMe;
            const likeCount =
              post.likeCount +
              (liked === post.likedByMe ? 0 : liked ? 1 : -1);
            const recipe = post.recipeId
              ? selectRecipeById(recipes, post.recipeId)
              : undefined;
            return (
              <FoodPostCard
                key={post.id}
                post={post}
                liked={liked}
                likeCount={likeCount}
                saved={savedOverrides[post.id] ?? post.savedByMe}
                recipeTitle={recipe?.title}
                onToggleLike={() =>
                  toggleOverride(setLikedOverrides, post, post.likedByMe)
                }
                onToggleSave={() =>
                  toggleOverride(setSavedOverrides, post, post.savedByMe)
                }
                onShare={() => sharePost(post, recipe?.title)}
                onOpenRecipe={
                  recipe
                    ? () =>
                        router.push(`/(tabs)/food/recipes/${recipe.id}` as never)
                    : undefined
                }
                onReport={() => setReportPostId(post.id)}
              />
            );
          })
        ) : tab === 'following' ? (
          <View style={{ gap: spacing.md }}>
            <EmptyState
              icon="people"
              title="You're not following anyone yet"
              message="Follow a creator and their posts collect here."
            />
            {creators.map((creator) => {
              const following = followedIds.has(creator.id);
              return (
                <Card key={creator.id} style={[styles.creatorRow, { gap: spacing.md }]}>
                  <ProfileAvatar displayName={creator.name} userId={creator.id} size={36} />
                  <AppText variant="callout" fit numberOfLines={1} style={styles.creatorName}>
                    {creator.name}
                  </AppText>
                  <ActionChip
                    label={following ? 'Following' : 'Follow'}
                    icon={following ? 'check' : 'invite'}
                    selected={following}
                    testID={AgentUiIds.food.community.follow(creator.id)}
                    onPress={() =>
                      setFollowedIds((current) => {
                        const next = new Set(current);
                        if (next.has(creator.id)) next.delete(creator.id);
                        else next.add(creator.id);
                        return next;
                      })
                    }
                  />
                </Card>
              );
            })}
          </View>
        ) : (
          // Header + already hosts compose — no second CTA for the same outcome.
          <EmptyState
            icon="food"
            title="No posts yet"
            message="Tap + above to share a recipe or meal and start the feed."
          />
        )}
      </AgentTestId>

      <PostComposerSheet
        visible={composerVisible}
        recipes={recipes}
        initialRecipeId={composeRecipeId}
        authorName={name.trim() || 'You'}
        onClose={() => setComposerVisible(false)}
        onPosted={() => setPosts(loadFoodFeed())}
      />
      <ReportContentSheet
        visible={reportPostId != null}
        postId={reportPostId}
        onClose={() => setReportPostId(undefined)}
        onReported={() => setPosts(loadFoodFeed())}
      />
    </FoodScreen>
  );
}

const styles = StyleSheet.create({
  creatorRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  creatorName: {
    flex: 1,
    flexShrink: 1,
    minWidth: 0,
  },
});
