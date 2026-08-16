import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText, Button } from '@/components/primitives';
import { findCategory } from '@/constants/categories';
import { radii, spacing } from '@/design-system';
import { CalendarDetailSheet } from '@/features/daily-tracking/calendar-detail-sheet';
import { useDismissCalendarDetail } from '@/features/daily-tracking/dismiss-calendar-detail';
import { useSchedule } from '@/store/schedule';
import { activityTimingLabel } from '@/utils/activity-time';
import { openHttpsUrl } from '@/utils/safe-url';

export default function MovieDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const activity = useSchedule((state) => state.activities.find((item) => item.id === id));
  const movie = useSchedule((state) => state.movies.find((item) => item.activityId === id));
  const categories = useSchedule((state) => state.categories);
  const setStatus = useSchedule((state) => state.setStatus);
  const close = useDismissCalendarDetail(!activity || !movie);

  if (!activity || !movie) return null;

  const category = findCategory(categories, activity.categoryId);
  const tmdbUrl = `https://www.themoviedb.org/${movie.mediaType === 'tv' ? 'tv' : 'movie'}/${movie.tmdbId}`;

  return (
    <CalendarDetailSheet
      kind="movie"
      eyebrow={category.name}
      title={activity.title}
      subtitle={activityTimingLabel(activity)}
      subtitleIcon="clock"
      onClose={close}>
      {movie.posterUrl ? (
        <Pressable
          accessibilityRole="link"
          accessibilityLabel={`Open ${movie.title} on The Movie Database`}
          onPress={() => void openHttpsUrl(tmdbUrl)}>
          <Image source={movie.posterUrl} style={styles.poster} contentFit="cover" transition={0} cachePolicy="memory-disk" />
        </Pressable>
      ) : null}
      <AppText variant="callout" color="secondary">
        {[movie.mediaType === 'tv' ? 'TV show' : 'Movie', movie.releaseDate, movie.runtimeMinutes ? `${movie.runtimeMinutes} min` : undefined, movie.genres.join(', ') || undefined]
          .filter(Boolean)
          .join(' · ')}
      </AppText>
      {movie.overview ? <AppText variant="body" style={styles.overview}>{movie.overview}</AppText> : null}
      {activity.notes ? (
        <View style={styles.notes}>
          <AppText variant="overline" color="tertiary">Notes</AppText>
          <AppText variant="body">{activity.notes}</AppText>
        </View>
      ) : null}
      <View style={styles.actions}>
        <Button variant="secondary" icon="edit" onPress={() => router.push({ pathname: '/activity-form', params: { id: activity.id } })}>
          Edit event
        </Button>
        <Button onPress={() => setStatus(activity.id, activity.status === 'completed' ? 'upcoming' : 'completed')}>
          {activity.status === 'completed' ? 'Mark Incomplete' : 'Mark Complete'}
        </Button>
      </View>
    </CalendarDetailSheet>
  );
}

const styles = StyleSheet.create({
  poster: {
    width: '100%',
    aspectRatio: 2 / 3,
    maxHeight: 460,
    alignSelf: 'center',
    borderRadius: radii.lg,
    marginVertical: spacing.md,
  },
  overview: { marginTop: spacing.lg },
  notes: { marginTop: spacing.xl, gap: spacing.sm },
  actions: { marginTop: spacing.xl, gap: spacing.sm },
});
