import type { FoodPostPayload } from '@/services/food/community';
import type { FoodPost } from '@/types/food';
import { newId } from '@/utils/id';

import { buildFoodFixturePosts } from './fixtures';

/**
 * Feed access for the Food community screen. There is no food social backend
 * yet — the feed is fixture posts plus session-local published posts, and
 * every read/write goes through this module so a real service can replace it
 * without touching the screens.
 */

export type CommunityTab = 'forYou' | 'following';

export interface CommunityCreator {
  id: string;
  name: string;
}

let localPosts: FoodPost[] = [];
let reportedPostIds: string[] = [];

export function loadFoodFeed(): FoodPost[] {
  return [...localPosts, ...buildFoodFixturePosts()];
}

/** Session-local publish — the payload is already privacy-filtered upstream. */
export function publishFoodPost(
  payload: FoodPostPayload,
  author: CommunityCreator,
): FoodPost {
  const post: FoodPost = {
    id: newId('post'),
    authorId: author.id,
    authorName: author.name,
    createdAt: new Date().toISOString(),
    caption: payload.caption,
    mediaUris: payload.mediaUris,
    recipeId: payload.recipeId,
    dietaryTags: payload.sharedDietaryPreferences ?? [],
    likeCount: 0,
    commentCount: 0,
    likedByMe: false,
    savedByMe: false,
  };
  localPosts = [post, ...localPosts];
  return post;
}

export function filterFollowingPosts(
  posts: readonly FoodPost[],
  followedAuthorIds: ReadonlySet<string>,
): FoodPost[] {
  return posts.filter((post) => followedAuthorIds.has(post.authorId));
}

/** Unique post authors — the "suggested creators" empty-state list. */
export function suggestedCreators(posts: readonly FoodPost[]): CommunityCreator[] {
  const seen = new Set<string>();
  const creators: CommunityCreator[] = [];
  for (const post of posts) {
    if (seen.has(post.authorId)) continue;
    seen.add(post.authorId);
    creators.push({ id: post.authorId, name: post.authorName });
  }
  return creators;
}

/** Records the report locally until a moderation backend exists. */
export function reportFoodPost(postId: string): void {
  if (!reportedPostIds.includes(postId)) {
    reportedPostIds = [...reportedPostIds, postId];
  }
}

export function isFoodPostReported(postId: string): boolean {
  return reportedPostIds.includes(postId);
}

export function resetFoodCommunityLocalState(): void {
  localPosts = [];
  reportedPostIds = [];
}
