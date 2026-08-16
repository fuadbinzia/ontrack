import { Image } from 'expo-image';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import {
  AppText,
  Button,
  Dropdown,
  EmptyState,
  ErrorMessage,
  GlassPlate,
  Input,
  LoadingBlock,
  SegmentedControl,
  appPrompt,
} from '@/components/primitives';
import { spacing } from '@/design-system';
import { useResponsive } from '@/hooks/use-responsive';
import {
  asEventBroadcasts,
  asEventFollowTargetsResponse,
  asEventSearchResponse,
  asEventStringList,
  searchEventFollowTargets,
  searchEvents,
  type EventDetails,
  type EventFollowMode,
  type EventFollowTarget,
  type EventSearchResult,
  type EventSport,
} from '@/services/events';
import { refreshEventFollows } from '@/services/events/sync';
import { useSchedule } from '@/store/schedule';
import { AgentTestId, AgentUiIds } from '@/utils/agent-ui';
import { deviceLocale, formatDateKey } from '@/utils/date';
import { userVisibleError } from '@/utils/operational-error';

type DiscoveryTab = 'sports' | 'concert' | 'following';

const TABS: { value: DiscoveryTab; label: string }[] = [
  { value: 'sports', label: 'Sports' },
  { value: 'concert', label: 'Music' },
  { value: 'following', label: 'Following' },
];

const SPORT_OPTIONS: { value: EventSport; label: string }[] = [
  { value: 'all', label: 'All sports' },
  { value: 'basketball', label: 'Basketball' },
  { value: 'football', label: 'Football' },
  { value: 'baseball', label: 'Baseball' },
  { value: 'hockey', label: 'Hockey' },
  { value: 'soccer', label: 'Soccer' },
  { value: 'combat', label: 'Combat sports' },
  { value: 'motorsport', label: 'Motorsports' },
];

function eventWhen(event: EventSearchResult) {
  if (!event.startDateTime) return `${formatDateKey(event.date, deviceLocale())} · Time TBA`;
  const date = new Date(event.startDateTime);
  if (Number.isNaN(date.getTime())) return formatDateKey(event.date, deviceLocale());
  return new Intl.DateTimeFormat(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}

function resultMeta(event: EventSearchResult) {
  const broadcasts = asEventBroadcasts(event.broadcasts);
  return [
    eventWhen(event),
    event.venue?.name,
    broadcasts.map((item) => item.name).join(', ') || undefined,
  ].filter(Boolean).join(' · ');
}

function EventResultRow({ event, onPress }: { event: EventSearchResult; onPress: () => void }) {
  const { s } = useResponsive();
  const testID = AgentUiIds.activityForm.event.result(event.provider, event.providerEventId);
  return (
    <AgentTestId testID={testID} label={`Select ${event.title}`} onPress={onPress}>
      <Pressable accessibilityRole="button" accessibilityLabel={`Select ${event.title}`} onPress={onPress}>
        <GlassPlate airy style={styles.resultCard}>
          {event.imageUrl ? (
            <Image source={event.imageUrl} contentFit="cover" style={{ width: s(64), height: s(64), borderRadius: s(16) }} />
          ) : null}
          <View style={styles.flex}>
            <AppText variant="bodyMedium" fit>{event.title}</AppText>
            <AppText variant="caption" color="secondary" numberOfLines={2}>{resultMeta(event)}</AppText>
          </View>
        </GlassPlate>
      </Pressable>
    </AgentTestId>
  );
}

function FollowTargetRow({ target, onFollow }: { target: EventFollowTarget; onFollow: () => void }) {
  const { s } = useResponsive();
  const testID = AgentUiIds.activityForm.event.followTarget(target.provider, target.providerTargetId);
  return (
    <AgentTestId testID={testID} label={`Follow ${target.name}`} onPress={onFollow}>
      <Pressable accessibilityRole="button" accessibilityLabel={`Follow ${target.name}`} onPress={onFollow}>
        <GlassPlate airy style={styles.followTarget}>
          {target.imageUrl ? (
            <Image source={target.imageUrl} contentFit="contain" style={{ width: s(44), height: s(44) }} />
          ) : null}
          <View style={styles.flex}>
            <AppText variant="bodyMedium" fit>{target.name}</AppText>
            <AppText variant="caption" color="secondary" fit>{target.subtitle ?? 'Follow upcoming events'}</AppText>
          </View>
          <AppText variant="callout" color="accent" fit>Follow</AppText>
        </GlassPlate>
      </Pressable>
    </AgentTestId>
  );
}

export function EventDiscoveryEditor({
  selected,
  onSelect,
}: {
  selected?: EventDetails;
  onSelect: (event: EventSearchResult) => void;
}) {
  const [tab, setTab] = useState<DiscoveryTab>('sports');
  const [sport, setSport] = useState<EventSport>('all');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(0);
  const [results, setResults] = useState<EventSearchResult[]>([]);
  const [selectedResult, setSelectedResult] = useState<EventSearchResult>();
  const [targets, setTargets] = useState<EventFollowTarget[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState<string>();
  const [retryKey, setRetryKey] = useState(0);

  const follows = useSchedule((state) => state.eventFollows);
  const suggestions = useSchedule((state) => state.eventSuggestions);
  const addEventFollow = useSchedule((state) => state.addEventFollow);
  const removeEventFollow = useSchedule((state) => state.removeEventFollow);
  const acceptSuggestion = useSchedule((state) => state.acceptEventSuggestion);
  const dismissSuggestion = useSchedule((state) => state.dismissEventSuggestion);
  const isFollowing = useMemo(() => new Set(follows.map((item) => `${item.provider}:${item.providerTargetId}`)), [follows]);
  const availableTargets = targets.filter((target) =>
    !isFollowing.has(`${target.provider}:${target.providerTargetId}`),
  );
  const sportLabel = SPORT_OPTIONS.find((option) => option.value === sport)?.label ?? 'Sports';

  const selectResult = (event: EventSearchResult) => {
    setSelectedResult(event);
    onSelect(event);
  };

  useEffect(() => {
    if (tab === 'following') return;
    const normalized = query.trim();
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true);
      setError(undefined);
      try {
        const [eventResponse, targetResponse] = await Promise.all([
          searchEvents(tab, normalized, 0, controller.signal, sport),
          searchEventFollowTargets(tab, normalized, controller.signal, sport)
            .catch(() => ({ results: [] })),
        ]);
        const normalizedEventResponse = asEventSearchResponse(eventResponse);
        const normalizedTargetResponse = asEventFollowTargetsResponse(targetResponse);
        setResults(normalizedEventResponse.results);
        setTargets(normalizedTargetResponse.results);
        setHasMore(normalizedEventResponse.hasMore);
        setPage(normalizedEventResponse.page);
      } catch (caught) {
        if (caught instanceof Error && caught.name === 'AbortError') return;
        setResults([]);
        setTargets([]);
        setError(caught instanceof Error ? caught.message : 'Event discovery failed.');
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, normalized ? 350 : 0);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, retryKey, sport, tab]);

  const chooseFollowMode = (target: EventFollowTarget) => {
    if (isFollowing.has(`${target.provider}:${target.providerTargetId}`)) return;
    const add = (mode: EventFollowMode) => {
      const follow = addEventFollow(target, mode);
      void refreshEventFollows({ force: true, followIds: [follow.id] }).catch(() => undefined);
    };
    appPrompt.alert(
      `Follow ${target.name}?`,
      target.targetKind === 'league'
        ? 'League follows can add many events. Review first is recommended.'
        : 'Choose how new events should enter your schedule.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Review First', style: 'secondary', testID: AgentUiIds.activityForm.event.followModeReview, onPress: () => add('review') },
        { text: 'Auto-add', style: 'primary', testID: AgentUiIds.activityForm.event.followModeAuto, onPress: () => add('auto') },
      ],
    );
  };

  const loadMore = async () => {
    if (tab !== 'concert' || loadingMore) return;
    setLoadingMore(true);
    setError(undefined);
    try {
      const response = await searchEvents(tab, query, page + 1, undefined, sport);
      const normalized = asEventSearchResponse(response);
      setResults((current) => [...current, ...normalized.results]);
      setPage(normalized.page);
      setHasMore(normalized.hasMore);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'More events could not be loaded.');
    } finally {
      setLoadingMore(false);
    }
  };

  const refresh = async () => {
    setRefreshing(true);
    setError(undefined);
    try {
      await refreshEventFollows({ force: true });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Follows could not be refreshed.');
    } finally {
      setRefreshing(false);
    }
  };

  const unfollow = (id: string, name: string) => appPrompt.alert(
    `Unfollow ${name}?`,
    'Choose whether future events already added by this follow should stay on your schedule.',
    [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Keep Events', style: 'secondary', onPress: () => removeEventFollow(id, false) },
      { text: 'Remove Future', style: 'destructive', onPress: () => removeEventFollow(id, true) },
    ],
  );

  const visibleError = userVisibleError(error);

  return (
    <View style={styles.root}>
      <AgentTestId testID={AgentUiIds.activityForm.event.tabs} label="Event discovery tabs">
        <SegmentedControl
          label="Discover"
          value={tab}
          options={TABS.map((item) => ({ ...item, testID: AgentUiIds.activityForm.choice('event-tab', item.value) }))}
          onChange={(value) => {
            setTab(value);
            setQuery('');
            setSelectedResult(undefined);
          }}
          wrap
        />
      </AgentTestId>

      {selectedResult ? (
        <AgentTestId testID={AgentUiIds.activityForm.event.selected} label="Selected event">
          <GlassPlate style={styles.selectedCard}>
            <AppText variant="overline" color="accent">Selected event</AppText>
            <AppText variant="bodyMedium">{selectedResult.title}</AppText>
            <AppText variant="caption" color="secondary">{resultMeta(selectedResult)}</AppText>
            <Button
              variant="secondary"
              onPress={() => setSelectedResult(undefined)}
              testID={AgentUiIds.activityForm.event.changeSelection}>
              Change event
            </Button>
          </GlassPlate>
        </AgentTestId>
      ) : tab === 'following' ? (
        <View style={styles.section}>
          <View style={styles.sectionHeading}>
            <View style={styles.flex}>
              <AppText variant="bodyMedium" fit>Following</AppText>
              <AppText variant="caption" color="secondary">Schedules refresh when onTrack opens.</AppText>
            </View>
            <Button
              variant="secondary"
              onPress={() => void refresh()}
              disabled={refreshing || follows.length === 0}
              testID={AgentUiIds.activityForm.event.refresh}>
              {refreshing ? 'Refreshing…' : 'Refresh'}
            </Button>
          </View>
          <AgentTestId testID={AgentUiIds.activityForm.event.following} label="Event follows">
            <View style={styles.section}>
              {follows.length === 0 ? <EmptyState icon="event" title="Nothing followed yet" message="Find a team, league, promotion, or artist and choose Follow." /> : null}
              {follows.map((follow) => (
                <GlassPlate key={follow.id} airy style={styles.followRow}>
                  <View style={styles.flex}>
                    <AppText variant="bodyMedium" fit>{follow.name}</AppText>
                    <AppText variant="caption" color="secondary" fit>
                      {follow.mode === 'auto' ? 'Auto-add' : 'Review first'}
                      {follow.lastSyncError ? ` · ${follow.lastSyncError}` : ''}
                    </AppText>
                  </View>
                  <Button
                    variant="ghost"
                    onPress={() => unfollow(follow.id, follow.name)}
                    testID={AgentUiIds.activityForm.event.unfollow(follow.id)}>
                    Unfollow
                  </Button>
                </GlassPlate>
              ))}
            </View>
          </AgentTestId>

          {suggestions.length > 0 ? (
            <AgentTestId testID={AgentUiIds.activityForm.event.suggestions} label="Event suggestions">
              <View style={styles.section}>
                <AppText variant="bodyMedium" fit>Ready for review</AppText>
                {suggestions.map((suggestion) => (
                  <AgentTestId key={suggestion.id} testID={AgentUiIds.activityForm.event.suggestion(suggestion.id)} label={suggestion.event.title}>
                    <GlassPlate airy style={styles.suggestionCard}>
                      <AppText variant="bodyMedium">{suggestion.event.title}</AppText>
                      <AppText variant="caption" color="secondary">{resultMeta(suggestion.event)}</AppText>
                      <View style={styles.suggestionActions}>
                        <Button variant="secondary" onPress={() => acceptSuggestion(suggestion.id)} testID={AgentUiIds.activityForm.event.acceptSuggestion(suggestion.id)}>Add</Button>
                        <Button variant="ghost" onPress={() => dismissSuggestion(suggestion.id)} testID={AgentUiIds.activityForm.event.dismissSuggestion(suggestion.id)}>Dismiss</Button>
                      </View>
                    </GlassPlate>
                  </AgentTestId>
                ))}
              </View>
            </AgentTestId>
          ) : null}
        </View>
      ) : (
        <View style={styles.section}>
          {tab === 'sports' ? (
            <Dropdown
              label="Sport"
              value={sport}
              options={SPORT_OPTIONS.map((option) => ({
                ...option,
                testID: AgentUiIds.activityForm.event.sportOption(option.value),
              }))}
              onChange={(value) => {
                setSport(value);
                setQuery('');
              }}
              icon="event"
              testID={AgentUiIds.activityForm.event.sportFilter}
            />
          ) : null}
          <Input
            label={tab === 'concert' ? 'Search artists or concerts' : 'Search sports'}
            value={query}
            onChangeText={setQuery}
            placeholder={tab === 'concert'
              ? 'Artist, tour, or venue…'
              : 'Team, league, fight, race, or event…'}
            returnKeyType="search"
            testID={AgentUiIds.activityForm.event.search}
          />
          {visibleError ? (
            <View style={styles.section}>
              <ErrorMessage message={visibleError} />
              <Button variant="secondary" onPress={() => setRetryKey((value) => value + 1)}>Try Again</Button>
            </View>
          ) : null}
          {loading ? <LoadingBlock compact /> : null}
          {!loading && results.length > 0 ? (
            <AgentTestId testID={AgentUiIds.activityForm.event.upcoming} label="Upcoming event suggestions">
              <View style={styles.section}>
                <View>
                  <AppText variant="bodyMedium" fit>
                    {query.trim()
                      ? 'Matching events'
                      : tab === 'concert'
                        ? 'Upcoming music'
                        : `Upcoming ${sportLabel.toLowerCase()}`}
                  </AppText>
                  {!query.trim() ? (
                    <AppText variant="caption" color="secondary">
                      Select one to prefill your schedule.
                    </AppText>
                  ) : null}
                </View>
                {results.map((event) => (
                  <EventResultRow
                    key={`${event.provider}:${event.providerEventId}`}
                    event={event}
                    onPress={() => selectResult(event)}
                  />
                ))}
              </View>
            </AgentTestId>
          ) : null}
          {!loading && availableTargets.length > 0 ? (
            <AgentTestId testID={AgentUiIds.activityForm.event.followTargets} label="Suggested event follows">
              <View style={styles.section}>
                <AppText variant="bodyMedium" fit>Follow for future suggestions</AppText>
                {availableTargets.map((target) => (
                  <FollowTargetRow
                    key={`${target.provider}:${target.providerTargetId}`}
                    target={target}
                    onFollow={() => chooseFollowMode(target)}
                  />
                ))}
              </View>
            </AgentTestId>
          ) : null}
          {!loading && !error && results.length === 0 && targets.length === 0 ? (
            <EmptyState
              icon="event"
              title={query.trim() ? 'No events found' : 'No upcoming events found'}
              message={query.trim()
                ? 'Try another team, event, or artist.'
                : 'Try again shortly or search for something specific.'}
            />
          ) : null}
          {hasMore ? (
            <Button variant="secondary" disabled={loadingMore} onPress={() => void loadMore()} testID={AgentUiIds.activityForm.event.loadMore}>
              {loadingMore ? 'Loading…' : 'More Events'}
            </Button>
          ) : null}
        </View>
      )}

      {selected && !selectedResult ? (
        <AgentTestId testID={AgentUiIds.activityForm.event.selected} label="Selected event">
          <GlassPlate style={styles.selectedCard}>
            <AppText variant="overline" color="accent">Selected event</AppText>
            <AppText variant="bodyMedium">{asEventStringList(selected.participants).join(' vs ') || selected.sourceName}</AppText>
            <AppText variant="caption" color="secondary">
              {[
                selected.venue?.name,
                asEventBroadcasts(selected.broadcasts).map((item) => item.name).join(', '),
              ].filter(Boolean).join(' · ') || 'Details will stay attached to this event.'}
            </AppText>
          </GlassPlate>
        </AgentTestId>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: spacing.md },
  section: { gap: spacing.sm },
  sectionHeading: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  flex: { flex: 1, minWidth: 0 },
  resultCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  followTarget: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  followRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  suggestionCard: { gap: spacing.sm },
  suggestionActions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  selectedCard: { gap: spacing.xs },
});
