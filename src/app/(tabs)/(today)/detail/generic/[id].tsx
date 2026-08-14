import { useEffect } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { AppState, StyleSheet, useWindowDimensions, View } from 'react-native';

import {
  AppText,
  Button,
  GlassIconWell,
  GlassPlate,
  SheetScaffold,
  StatusBadge,
  Symbol,
} from '@/components/primitives';
import { findCategory } from '@/constants/categories';
import { radii, spacing } from '@/design-system';
import { UfcFightCard } from '@/features/events/ufc-fight-card';
import { useResponsive } from '@/hooks/use-responsive';
import { useTheme } from '@/hooks/use-theme';
import {
  refreshLiveUfcEventDetails,
  refreshUfcEventDetails,
  shouldPollUfcLiveUpdates,
  UFC_LIVE_POLL_MS,
} from '@/services/events/sync';
import { useSchedule } from '@/store/schedule';
import { AgentTestId, AgentUiIds } from '@/utils/agent-ui';
import { activityTimingLabel } from '@/utils/activity-time';
import { openHttpsUrl } from '@/utils/safe-url';

export default function GenericDetailScreen() {
  const router = useRouter();
  const theme = useTheme();
  const { layout, spacing: responsiveSpacing } = useResponsive();
  const { height: windowHeight } = useWindowDimensions();
  const params = useLocalSearchParams<{ id: string }>();
  const activityId = params.id;

  const activity = useSchedule((s) => s.activities.find((a) => a.id === activityId));
  const categories = useSchedule((s) => s.categories);
  const setStatus = useSchedule((s) => s.setStatus);
  const eventDetails = useSchedule((s) => s.eventDetails.find((item) => item.activityId === activityId));
  const liveDate = activity?.date;
  const liveStartMinutes = activity?.startMinutes;
  const liveTitle = activity?.title;
  const liveStatus = eventDetails?.status;

  useEffect(() => {
    if (!eventDetails || eventDetails.bouts?.length) return;
    const controller = new AbortController();
    void refreshUfcEventDetails(activityId, controller.signal).catch(() => undefined);
    return () => controller.abort();
  }, [activityId, eventDetails, eventDetails?.bouts?.length]);

  useEffect(() => {
    if (!liveDate || liveStartMinutes == null || !liveTitle || !liveStatus
      || !shouldPollUfcLiveUpdates({
        date: liveDate,
        startMinutes: liveStartMinutes,
        title: liveTitle,
      }, liveStatus)) {
      return;
    }
    let disposed = false;
    let generation = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let controller: AbortController | undefined;

    const schedule = (currentGeneration: number) => {
      if (disposed || currentGeneration !== generation || AppState.currentState !== 'active') {
        return;
      }
      timer = setTimeout(() => run(currentGeneration), UFC_LIVE_POLL_MS);
    };
    const run = async (currentGeneration: number) => {
      if (disposed || currentGeneration !== generation || AppState.currentState !== 'active') {
        return;
      }
      controller = new AbortController();
      try {
        await refreshLiveUfcEventDetails(activityId, controller.signal);
      } catch (error) {
        if (!(error instanceof Error && error.name === 'AbortError')) {
          // Saved data remains visible; the next interval retries quietly.
        }
      } finally {
        schedule(currentGeneration);
      }
    };
    const start = () => {
      generation += 1;
      if (timer) clearTimeout(timer);
      controller?.abort();
      void run(generation);
    };
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') start();
      else {
        generation += 1;
        if (timer) clearTimeout(timer);
        controller?.abort();
      }
    });
    start();
    return () => {
      disposed = true;
      generation += 1;
      if (timer) clearTimeout(timer);
      controller?.abort();
      subscription.remove();
    };
  }, [activityId, liveDate, liveStartMinutes, liveStatus, liveTitle]);

  if (!activity) {
    return (
      <SheetScaffold
        visible
        host="route"
        title="Activity Not Found"
        onClose={() => router.back()}
        closeAccessibilityLabel="Go back"
        closeTestID={AgentUiIds.eventDetail.goBack}
        fitContent
        surface="glass">
        <AppText variant="body" color="secondary">
          This activity is no longer available.
        </AppText>
      </SheetScaffold>
    );
  }

  const category = findCategory(categories, activity.categoryId);

  return (
    <SheetScaffold
      visible
      host="route"
      eyebrow={category.name}
      title={activity.title}
      subtitle={activityTimingLabel(activity)}
      subtitleIcon="clock"
      onClose={() => router.back()}
      closeAccessibilityLabel="Dismiss event details"
      closeTestID={AgentUiIds.eventDetail.close}
      backdropTestID={AgentUiIds.eventDetail.backdrop}
      maxHeight={Math.round(windowHeight * 0.9)}
      surface="glass">
      <View style={[styles.metaActions, { gap: responsiveSpacing.sm }]}>
        {eventDetails ? (
          <View style={[styles.statusSlot, { minHeight: layout.minTapTarget }]}>
            <StatusBadge
              label={eventDetails.status === 'in-progress'
                ? 'Live'
                : eventDetails.status.replace('-', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())}
              tone={eventDetails.status === 'in-progress' || eventDetails.status === 'cancelled'
                ? 'danger'
                : eventDetails.status === 'postponed'
                  ? 'warning'
                  : 'neutral'}
            />
          </View>
        ) : null}
        <Button
          variant="secondary"
          size="sm"
          shape="pill"
          icon="edit"
          onPress={() => router.push({ pathname: '/activity-form', params: { id: activity.id } })}
          accessibilityLabel={`Edit ${activity.title}`}
          testID={AgentUiIds.eventDetail.edit}>
          Edit event
        </Button>
      </View>

      {activity.summary && !eventDetails ? (
        <AppText variant="body" color="secondary">
          {activity.summary}
        </AppText>
      ) : null}

      {eventDetails?.venue?.name ? (
        <AgentTestId testID={AgentUiIds.eventDetail.metadata} label="Event details">
          <GlassPlate intensity={64} style={styles.eventCard}>
            <View style={styles.eventCardHeader}>
              <AppText variant="overline" color="accent" bold>Event details</AppText>
              <AppText variant="caption" color="secondary">
                Venue information
              </AppText>
            </View>

            <View style={styles.infoRow}>
              <GlassIconWell size={40} borderRadius={radii.md}>
                <Symbol name="location" size="sm" color={theme.accentPrimary} />
              </GlassIconWell>
              <View style={styles.infoCopy}>
                <AppText variant="caption" color="secondary">Venue</AppText>
                <AppText variant="bodyMedium">{eventDetails.venue.name}</AppText>
                {[eventDetails.venue.city, eventDetails.venue.region].filter(Boolean).length > 0 ? (
                  <AppText variant="caption" color="secondary">
                    {[eventDetails.venue.city, eventDetails.venue.region].filter(Boolean).join(', ')}
                  </AppText>
                ) : null}
              </View>
            </View>
          </GlassPlate>
        </AgentTestId>
      ) : null}

      {eventDetails && (eventDetails.participants.length > 0 || eventDetails.card?.length) ? (
        <AgentTestId testID={AgentUiIds.eventDetail.fightCard} label="Fight card">
          <UfcFightCard
            bouts={eventDetails.bouts}
            participants={eventDetails.participants}
            legacyCard={eventDetails.card}
            eventTitle={activity.title}
            eventTiming={activityTimingLabel(activity)}
          />
        </AgentTestId>
      ) : null}

      {eventDetails?.ticketUrl ? (
        <View style={styles.externalActions}>
          <Button variant="secondary" icon="event" onPress={() => void openHttpsUrl(eventDetails.ticketUrl)} testID={AgentUiIds.eventDetail.ticket}>Tickets</Button>
        </View>
      ) : null}

      {activity.notes ? (
        <View style={styles.notes}>
          <AppText variant="overline" color="tertiary">
            Notes
          </AppText>
          <AppText variant="body">{activity.notes}</AppText>
        </View>
      ) : null}

      <View style={styles.actions}>
        <Button
          onPress={() =>
            setStatus(activity.id, activity.status === 'completed' ? 'upcoming' : 'completed')
          }
          accessibilityLabel="Toggle complete"
          testID={AgentUiIds.eventDetail.toggleComplete}>
          {activity.status === 'completed' ? 'Mark Incomplete' : 'Mark Complete'}
        </Button>
      </View>
    </SheetScaffold>
  );
}

const styles = StyleSheet.create({
  metaActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  statusSlot: {
    flex: 1,
    minWidth: 0,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  notes: { gap: spacing.sm },
  actions: { gap: spacing.sm },
  eventCard: {
    borderWidth: 1,
    borderRadius: radii.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  eventCardHeader: {
    gap: spacing.xxs,
    paddingVertical: spacing.sm,
  },
  infoRow: {
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
  },
  infoCopy: {
    flex: 1,
    minWidth: 0,
    gap: spacing.xxs,
  },
  externalActions: { gap: spacing.sm },
});
