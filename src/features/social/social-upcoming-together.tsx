import { ScrollView, StyleSheet, View } from 'react-native';

import {
  AppText,
  GlassIconWell,
  GlassPlate,
  Symbol,
} from '@/components/primitives';
import { radii } from '@/design-system';
import { ProfileAvatar } from '@/features/account/profile-avatar';
import { socialChrome, socialShadow } from '@/features/social/social-chrome';
import { SocialPressable } from '@/features/social/social-pressable';
import { sharedUpcomingTrips } from '@/features/social/social-trip-membership';
import { TravelTripCover } from '@/features/travel/travel-trip-cover';
import type { TravelPlan } from '@/features/travel/types';
import { useResponsive } from '@/hooks/use-responsive';
import { useTheme } from '@/hooks/use-theme';
import type { FriendProfile } from '@/services/friends';
import { AgentUiIds } from '@/utils/agent-ui';
import { formatDateLong, fromDateKey } from '@/utils/date';

export function SocialUpcomingTogether({
  plans,
  friends,
  selfName,
  onSeeAll,
  onOpenPlan,
}: {
  plans: TravelPlan[];
  friends: FriendProfile[];
  selfName: string;
  onSeeAll: () => void;
  onOpenPlan: (plan: TravelPlan) => void;
}) {
  const theme = useTheme();
  const chrome = socialChrome(theme);
  const { spacing, width, layout, s } = useResponsive();
  const cardWidth = Math.min(Math.max(246, width - layout.screenPadding * 2 - 48), 310);
  const upcoming = sharedUpcomingTrips(plans);

  return (
    <View style={{ gap: spacing.md }}>
      <View style={styles.sectionHeader}>
        <AppText variant="heading" style={{ color: chrome.ink }} bold fit>
          Upcoming Together
        </AppText>
        <SocialPressable
          testID={AgentUiIds.social.upcoming.seeAll}
          accessibilityLabel="See all shared trips"
          onPress={onSeeAll}
          style={styles.textAction}>
          <AppText variant="callout" style={{ color: chrome.primary }} fit>
            See all
          </AppText>
          <Symbol name="chevron-right" size="sm" color={chrome.primary} />
        </SocialPressable>
      </View>

      {upcoming.length === 0 ? (
        <SocialPressable
          testID={AgentUiIds.social.upcoming.empty}
          accessibilityLabel="Create a shared trip"
          onPress={onSeeAll}
          style={styles.upcomingEmptyWrap}>
          <GlassPlate
            style={[
              styles.upcomingEmpty,
              {
                minHeight: Math.max(132, s(140)),
                padding: spacing.lg,
                gap: spacing.md,
              },
            ]}>
          <GlassIconWell size={52} borderRadius={18} style={styles.emptyIcon}>
            <Symbol name="flight" size="md" color={chrome.primary} />
          </GlassIconWell>
          <View style={styles.emptyCopy}>
            <AppText variant="subheading" bold fit>
              Plan something together
            </AppText>
            <AppText variant="caption" color="secondary">
              Shared trips with friends will appear here.
            </AppText>
          </View>
          <Symbol name="chevron-right" size="sm" color={chrome.primary} />
          </GlassPlate>
        </SocialPressable>
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: spacing.md, paddingRight: spacing.lg }}>
          {upcoming.map((plan) => (
            <UpcomingCard
              key={plan.id}
              plan={plan}
              friends={friends}
              selfName={selfName}
              width={cardWidth}
              onPress={() => onOpenPlan(plan)}
            />
          ))}
        </ScrollView>
      )}
    </View>
  );
}

function UpcomingCard({
  plan,
  friends,
  selfName,
  width,
  onPress,
}: {
  plan: TravelPlan;
  friends: FriendProfile[];
  selfName: string;
  width: number;
  onPress: () => void;
}) {
  const theme = useTheme();
  const chrome = socialChrome(theme);
  const { spacing, s } = useResponsive();
  const start = fromDateKey(plan.startDate);
  const month = start.toLocaleDateString(undefined, { month: 'short' }).toUpperCase();
  const people = [
    { id: 'self', name: selfName, isSelf: true, userId: undefined as string | undefined },
    ...plan.participants.map((participant) => ({
      id: participant.id,
      name: participant.name,
      isSelf: false,
      userId: friends.find(
        (friend) => friend.email.toLowerCase() === participant.email?.toLowerCase(),
      )?.userId,
    })),
  ];
  const visible = people.slice(0, 3);
  const extra = Math.max(0, people.length - visible.length);
  const avatarSize = Math.max(25, s(28));

  return (
    <SocialPressable
      testID={AgentUiIds.social.upcoming.trip(plan.id)}
      accessibilityLabel={`Open ${plan.title}, ${formatDateLong(plan.startDate)} to ${formatDateLong(plan.endDate)}`}
      onPress={onPress}
      style={{ width }}>
      <GlassPlate
        style={[
          styles.upcomingCard,
          {
            ...socialShadow(chrome.shadow, 'raised'),
          },
        ]}>
      <View style={[styles.coverWrap, { height: Math.max(108, s(116)) }]}>
        <TravelTripCover plan={plan} width="100%" height="100%" borderRadius={0} expandable={false} />
        <View style={[styles.avatarStack, { left: spacing.md, bottom: spacing.sm }]}>
          {visible.map((person, index) => (
            <View
              key={person.id}
              style={[
                styles.stackedAvatar,
                {
                  left: index * (avatarSize - 8),
                  width: avatarSize + 4,
                  height: avatarSize + 4,
                  borderRadius: (avatarSize + 4) / 2,
                  borderColor: chrome.surface,
                },
              ]}>
              <ProfileAvatar
                displayName={person.name}
                userId={person.userId}
                isSelf={person.isSelf}
                size={avatarSize}
              />
            </View>
          ))}
          {extra > 0 ? (
            <View
              style={[
                styles.extraPeople,
                {
                  left: visible.length * (avatarSize - 8),
                  width: avatarSize + 7,
                  height: avatarSize + 7,
                  borderRadius: (avatarSize + 7) / 2,
                  backgroundColor: chrome.primaryDeep,
                  borderColor: chrome.surface,
                },
              ]}>
              <AppText variant="caption" color="onAccent" bold fit>
                +{extra}
              </AppText>
            </View>
          ) : null}
        </View>
      </View>
      <View style={[styles.tripInfo, { padding: spacing.md, gap: spacing.sm }]}>
        <View style={[styles.dateBadge, { backgroundColor: chrome.mint }]}>
          <AppText variant="overline" style={{ color: chrome.primary }} fit>
            {month}
          </AppText>
          <AppText variant="subheading" bold fit>
            {start.getDate()}
          </AppText>
        </View>
        <View style={styles.tripCopy}>
          <AppText variant="callout" bold fit>
            {plan.title}
          </AppText>
          <AppText variant="caption" color="secondary" fit>
            {formatDateLong(plan.startDate)} – {formatDateLong(plan.endDate)}
          </AppText>
        </View>
        <View style={styles.peopleCount}>
          <Symbol name="people" size={13} color={chrome.secondaryInk} />
          <AppText variant="caption" color="secondary" fit>
            {people.length}
          </AppText>
        </View>
      </View>
      </GlassPlate>
    </SocialPressable>
  );
}

const styles = StyleSheet.create({
  avatarStack: {
    position: 'absolute',
    height: 36,
  },
  coverWrap: {
    overflow: 'hidden',
  },
  dateBadge: {
    width: 44,
    minHeight: 48,
    borderRadius: radii.sm,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyCopy: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  emptyIcon: {
    width: 52,
    height: 52,
    borderRadius: 18,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
  },
  extraPeople: {
    position: 'absolute',
    top: -1,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  peopleCount: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  sectionHeader: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  stackedAvatar: {
    position: 'absolute',
    top: 0,
    borderWidth: 2,
    overflow: 'hidden',
  },
  textAction: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  tripCopy: {
    flex: 1,
    minWidth: 0,
    gap: 1,
  },
  tripInfo: {
    minHeight: 72,
    flexDirection: 'row',
    alignItems: 'center',
  },
  upcomingCard: {
    overflow: 'hidden',
    borderRadius: radii.xl,
    borderCurve: 'continuous',
  },
  upcomingEmpty: {
    borderRadius: radii.xl,
    borderCurve: 'continuous',
    flexDirection: 'row',
    alignItems: 'center',
  },
  upcomingEmptyWrap: {
    alignSelf: 'stretch',
  }
});
