import type { Activity, ActivityCategory } from '@/types/models';

export type ActivityDetailPath =
  | '/detail/food/[id]'
  | '/detail/gym/[id]'
  | '/detail/work/[id]'
  | '/detail/movie/[id]'
  | '/detail/sleep/[id]'
  | '/detail/plant/[id]'
  | '/detail/generic/[id]';

/** Resolve the detail sheet shared by Today and Calendar activity cards. */
export function activityDetailPath(
  activity: Pick<Activity, 'plantId'>,
  category: Pick<ActivityCategory, 'detailKind'>,
): ActivityDetailPath {
  switch (category.detailKind) {
    case 'food':
      return '/detail/food/[id]';
    case 'gym':
      return '/detail/gym/[id]';
    case 'work':
      return '/detail/work/[id]';
    case 'movie':
      return '/detail/movie/[id]';
    case 'sleep':
      return '/detail/sleep/[id]';
    case 'plant':
      return activity.plantId ? '/detail/plant/[id]' : '/detail/generic/[id]';
    default:
      return '/detail/generic/[id]';
  }
}
