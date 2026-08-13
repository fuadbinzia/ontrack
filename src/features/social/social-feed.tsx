import { Image } from 'expo-image';
import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText, Button, EmptyState, GlassPlate, Symbol } from '@/components/primitives';
import { radii } from '@/design-system';
import { ProfileAvatar } from '@/features/account/profile-avatar';
import { formatSocialActivityTime } from '@/features/social/social-feed-model';
import { socialChrome, socialShadow } from '@/features/social/social-chrome';
import { SocialPressable } from '@/features/social/social-pressable';
import type { SocialFeedItem, SocialFeedScope } from '@/features/social/social-types';
import { useResponsive } from '@/hooks/use-responsive';
import { useTheme } from '@/hooks/use-theme';
import { AgentUiIds } from '@/utils/agent-ui';
import { formatCount } from '@/utils/grammar';

type FeedFilter = 'all' | 'friends' | 'groups';

export function SocialActivityFeed({
  items,
  onOpenItem,
}: {
  items: SocialFeedItem[];
  onOpenItem: (item: SocialFeedItem) => void;
}) {
  const theme = useTheme();
  const chrome = socialChrome(theme);
  const { spacing } = useResponsive();
  const [filter, setFilter] = useState<FeedFilter>('all');
  const [visibleCount, setVisibleCount] = useState(3);
  const filtered = useMemo(() => {
    const scope: SocialFeedScope | undefined =
      filter === 'friends' ? 'friend' : filter === 'groups' ? 'group' : undefined;
    return scope ? items.filter((item) => item.scope === scope) : items;
  }, [filter, items]);
  const visible = filtered.slice(0, visibleCount);

  return (
    <View style={{ gap: spacing.md }}>
      <View style={styles.feedHeader}>
        <AppText variant="heading" style={{ color: chrome.ink }} bold fit>
          Activity Feed
        </AppText>
        <View style={[styles.filters, { gap: spacing.xs }]}>
          {(['all', 'friends', 'groups'] as const).map((value) => {
            const selected = filter === value;
            return (
              <SocialPressable
                key={value}
                testID={AgentUiIds.social.feedFilter(value)}
                accessibilityLabel={`Show ${value} activity`}
                accessibilityState={{ selected }}
                onPress={() => {
                  setFilter(value);
                  setVisibleCount(3);
                }}
                style={[
                  styles.filter,
                  {
                    backgroundColor: selected ? chrome.mint : chrome.surfaceMuted,
                    borderColor: selected ? chrome.mintStrong : chrome.border,
                    paddingHorizontal: spacing.md,
                  },
                ]}>
                <AppText
                  variant="caption"
                  bold={selected}
                  fit
                  style={{ color: selected ? chrome.primaryDeep : chrome.secondaryInk }}>
                  {value[0].toUpperCase() + value.slice(1)}
                </AppText>
              </SocialPressable>
            );
          })}
        </View>
      </View>

      {visible.length === 0 ? (
        <GlassPlate
          style={[
            styles.empty,
            {
              padding: spacing.lg,
            },
          ]}>
          <EmptyState
            icon="people"
            title={filter === 'all' ? 'Your feed is ready' : `No ${filter} updates yet`}
            message="Trips, shared photos, workouts, polls, and stories from your circle will appear here."
          />
        </GlassPlate>
      ) : (
        <View style={{ gap: spacing.sm }}>
          {visible.map((item) => (
            <SocialFeedCard key={item.id} item={item} onOpen={() => onOpenItem(item)} />
          ))}
        </View>
      )}

      {visibleCount < filtered.length ? (
        <Button
          testID={AgentUiIds.social.feedLoadMore}
          variant="secondary"
          onPress={() => setVisibleCount((count) => count + 3)}>
          Load more activity
        </Button>
      ) : null}
    </View>
  );
}

function SocialFeedCard({ item, onOpen }: { item: SocialFeedItem; onOpen: () => void }) {
  const theme = useTheme();
  const chrome = socialChrome(theme);
  const { spacing, s } = useResponsive();
  const [pollChoice, setPollChoice] = useState<string>();
  const avatarSize = Math.max(42, s(46));
  const cardShellStyle = [
    styles.card,
    {
      padding: spacing.md,
      gap: spacing.md,
      ...socialShadow(chrome.shadow, 'raised'),
    },
  ];
  const header = (
    <View style={styles.actorRow}>
      <View style={[styles.avatarRing, { borderColor: chrome.primary, borderRadius: avatarSize / 2 + 2 }]}>
        <ProfileAvatar
          displayName={item.actor.displayName}
          userId={item.actor.userId}
          size={avatarSize}
        />
      </View>
      <View style={styles.actorCopy}>
        <AppText variant="callout" bold fit>
          {item.actor.displayName}
        </AppText>
        <AppText variant="caption" color="secondary" fit>
          {formatSocialActivityTime(item.createdAt)}
        </AppText>
      </View>
      <Symbol name="chevron-right" size="sm" color={chrome.secondaryInk} />
    </View>
  );

  if (item.kind === 'poll') {
    const total = item.choices.reduce((sum, choice) => sum + choice.votes, 0) + (pollChoice ? 1 : 0);
    return (
      <GlassPlate style={cardShellStyle}>
        {header}
        <AppText variant="caption" color="secondary" fit>
          Poll in {item.groupName}
        </AppText>
        <AppText variant="subheading" bold>
          {item.question}
        </AppText>
        <View style={{ gap: spacing.sm }}>
          {item.choices.map((choice) => {
            const selected = pollChoice === choice.id;
            const votes = choice.votes + (selected ? 1 : 0);
            const percent = total > 0 ? Math.round((votes / total) * 100) : 0;
            return (
              <SocialPressable
                key={choice.id}
                testID={AgentUiIds.social.feedPollChoice(item.id, choice.id)}
                accessibilityLabel={`Vote for ${choice.label}`}
                accessibilityState={{ selected }}
                onPress={() => setPollChoice(choice.id)}
                style={[
                  styles.pollChoice,
                  {
                    borderColor: selected ? chrome.primary : chrome.border,
                    backgroundColor: selected ? chrome.mint : chrome.surfaceMuted,
                    padding: spacing.sm,
                  },
                ]}>
                <AppText variant="callout" fit style={styles.pollLabel}>
                  {choice.label}
                </AppText>
                <AppText variant="caption" color="secondary" fit>
                  {percent}%
                </AppText>
              </SocialPressable>
            );
          })}
        </View>
      </GlassPlate>
    );
  }

  return (
    <SocialPressable
      testID={AgentUiIds.social.feedItem(item.id)}
      accessibilityLabel={feedItemLabel(item)}
      onPress={onOpen}
      style={styles.cardWrap}>
      <GlassPlate style={cardShellStyle}>
      {header}
      <FeedCardBody item={item} />
      </GlassPlate>
    </SocialPressable>
  );
}

function FeedCardBody({ item }: { item: Exclude<SocialFeedItem, { kind: 'poll' }> }) {
  const theme = useTheme();
  const chrome = socialChrome(theme);
  const { spacing, s } = useResponsive();

  if (item.kind === 'connection') {
    return (
      <View style={[styles.connectionRow, { backgroundColor: chrome.mint, padding: spacing.md }]}>
        <Symbol name="people" size="sm" color={chrome.primary} />
        <AppText variant="callout" style={styles.bodyCopy}>
          You’re connected. Start a trip, challenge, or shared list together.
        </AppText>
      </View>
    );
  }

  if (item.kind === 'trip') {
    return (
      <View style={{ gap: spacing.xs }}>
        <AppText variant="body" bold>
          Updated the shared plan “{item.tripTitle}”
        </AppText>
        <View style={styles.metaRow}>
          <Symbol name="location" size="sm" color={chrome.primary} />
          <AppText variant="caption" color="secondary" fit style={styles.bodyCopy}>
            {item.destination} · {item.dateRange}
          </AppText>
        </View>
      </View>
    );
  }

  if (item.kind === 'photos') {
    return (
      <View style={{ gap: spacing.sm }}>
        <AppText variant="body" bold>
          Added {item.photoUris.length} {item.photoUris.length === 1 ? 'photo' : 'photos'} to “{item.tripTitle}”
        </AppText>
        <View style={[styles.photoRow, { gap: spacing.xs }]}>
          {item.photoUris.map((uri) => (
            <Image
              key={uri}
              source={{ uri }}
              style={{ width: Math.max(54, s(60)), height: Math.max(48, s(54)), borderRadius: radii.sm }}
              contentFit="cover"
              transition={160}
              recyclingKey={uri}
            />
          ))}
        </View>
      </View>
    );
  }

  if (item.kind === 'workout') {
    return (
      <View style={{ gap: spacing.sm }}>
        <AppText variant="body">
          Completed a workout
        </AppText>
        <AppText variant="subheading" bold style={{ color: chrome.primary }} fit>
          {item.workoutTitle}
        </AppText>
        <View style={[styles.metaRow, { gap: spacing.lg }]}>
          <Metric icon="clock" label={`${item.durationMinutes} min`} />
          {item.calories ? <Metric icon="smart" label={`${item.calories} cal`} /> : null}
          {item.achievement ? <Metric icon="important" label={item.achievement} /> : null}
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.story, { backgroundColor: chrome.surfaceMuted }]}>
      {item.previewUri ? (
        <Image source={{ uri: item.previewUri }} style={StyleSheet.absoluteFill} contentFit="cover" />
      ) : (
        <Symbol name="photo" size="lg" color={chrome.primary} />
      )}
      <View style={[styles.storyCaption, { backgroundColor: chrome.mint }]}>
        <AppText variant="caption" bold fit>
          Story · {formatCount(item.viewerCount ?? 0, 'view')}
        </AppText>
      </View>
    </View>
  );
}

function Metric({ icon, label }: { icon: 'clock' | 'smart' | 'important'; label: string }) {
  const theme = useTheme();
  const chrome = socialChrome(theme);
  return (
    <View style={styles.metric}>
      <Symbol name={icon} size="sm" color={chrome.primary} />
      <AppText variant="caption" fit>
        {label}
      </AppText>
    </View>
  );
}

function feedItemLabel(item: Exclude<SocialFeedItem, { kind: 'poll' }>): string {
  if (item.kind === 'connection') return `Open ${item.actor.displayName}'s friend details`;
  if (item.kind === 'trip') return `Open shared trip ${item.tripTitle}`;
  if (item.kind === 'photos') return `Open photos from ${item.tripTitle}`;
  if (item.kind === 'workout') return `Open ${item.actor.displayName}'s workout`;
  return `Open ${item.actor.displayName}'s story`;
}

const styles = StyleSheet.create({
  feedHeader: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  filters: {
    flexDirection: 'row',
    flexShrink: 1,
  },
  filter: {
    minHeight: 36,
    minWidth: 48,
    borderRadius: radii.pill,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  empty: {
    minHeight: 190,
    borderRadius: radii.xl,
    borderCurve: 'continuous',
  },
  cardWrap: {
    width: '100%',
  },
  card: {
    borderRadius: radii.xl,
    borderCurve: 'continuous',
  },
  actorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  avatarRing: {
    padding: 2,
    borderWidth: 1.5,
  },
  actorCopy: {
    flex: 1,
    minWidth: 0,
    gap: 1,
  },
  connectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radii.md,
    borderCurve: 'continuous',
    gap: 10,
  },
  bodyCopy: {
    flex: 1,
    minWidth: 0,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  photoRow: {
    flexDirection: 'row',
    overflow: 'hidden',
  },
  pollChoice: {
    minHeight: 44,
    borderRadius: radii.md,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  pollLabel: {
    flex: 1,
    minWidth: 0,
  },
  metric: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    minWidth: 0,
  },
  story: {
    height: 150,
    borderRadius: radii.lg,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  storyCaption: {
    position: 'absolute',
    left: 10,
    bottom: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radii.pill,
  },
});
