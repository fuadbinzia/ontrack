import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  FadeOutLeft,
  LinearTransition,
  ReduceMotion,
} from 'react-native-reanimated';

import {
  AppText,
  Button,
  GlassIconWell,
  GlassPlate,
  IconButton,
  Symbol,
} from '@/components/primitives';
import { motion, radii, type AppIconName } from '@/design-system';
import type { EventCalendarArtwork } from '@/features/events/event-calendar-artwork';
import { useResponsive } from '@/hooks/use-responsive';
import { useTheme } from '@/hooks/use-theme';
import { AgentTestId, AgentUiIds } from '@/utils/agent-ui';
import { formatCountWithVerb } from '@/utils/grammar';
import { openHttpsUrl } from '@/utils/safe-url';

import type { CalendarEventExcitement } from './calendar-event-excitement';
import type { OverviewAttentionItem } from './overview-summary';

function OverviewHeroMark({
  artwork,
  fallback,
  tone,
  size,
}: {
  artwork?: EventCalendarArtwork;
  fallback: AppIconName;
  tone: string;
  size: number;
}) {
  const [failedUri, setFailedUri] = useState<string>();

  useEffect(() => {
    setFailedUri(undefined);
  }, [artwork?.uri]);

  const showArt = Boolean(artwork && artwork.uri !== failedUri);

  return (
    <GlassIconWell size={size} borderRadius={radii.xl}>
      {showArt && artwork ? (
        <Image
          accessibilityLabel={artwork.accessibilityLabel}
          source={artwork.uri}
          cachePolicy="memory-disk"
          style={artwork.contentFit === 'contain' ? styles.heroLogo : styles.heroArtwork}
          contentFit={artwork.contentFit}
          transition={160}
          onError={() => setFailedUri(artwork.uri)}
        />
      ) : (
        <Symbol name={fallback} size={Math.round(size * 0.43)} color={tone} />
      )}
    </GlassIconWell>
  );
}

export function OverviewHero({
  eventExcitement,
  eventArtwork,
  attentionCount,
  attentionItems,
  onAcknowledge,
}: {
  eventExcitement?: CalendarEventExcitement;
  eventArtwork?: EventCalendarArtwork;
  attentionCount: number;
  attentionItems: readonly OverviewAttentionItem[];
  onAcknowledge: (key: string) => void;
}) {
  const theme = useTheme();
  const { spacing, s } = useResponsive();
  const heroTitle =
    eventExcitement?.headline ??
    (attentionCount
      ? `${formatCountWithVerb(attentionCount, 'thing', 'needs', 'need')} your attention`
      : 'Everything is moving smoothly');
  const heroTone = eventExcitement
    ? theme.accentPrimary
    : attentionCount
      ? theme.warning
      : theme.success;

  return (
    <AgentTestId testID={AgentUiIds.overview.hero} label="Overview pulse">
      <GlassPlate
        intensity={64}
        style={[
          styles.hero,
          {
            borderRadius: radii.xl,
            borderWidth: 1,
            borderColor: heroTone,
            padding: spacing.lg,
            gap: spacing.md,
          },
        ]}
      >
        <View style={[styles.heroTop, { gap: spacing.md }]}>
          <View style={styles.heroCopy}>
            <AppText variant="overline" fit style={{ color: heroTone }}>
              {eventExcitement?.eyebrow ?? 'Right now'}
            </AppText>
            <AppText variant="title" fit fitMinimumScale={0.64}>
              {heroTitle}
            </AppText>
            <AppText variant="caption" color="secondary">
              {eventExcitement?.message ??
                (attentionCount
                  ? 'Clear what matters, then keep moving.'
                  : 'Your plans, routines, and care are in a good rhythm.')}
            </AppText>
          </View>
          <View
            style={[
              styles.pulseOrbit,
              { borderColor: heroTone, padding: s(4) },
            ]}
          >
            <OverviewHeroMark
              artwork={eventArtwork}
              fallback={
                eventExcitement ? 'event' : attentionCount ? 'warning' : 'habit'
              }
              tone={heroTone}
              size={s(56)}
            />
          </View>
        </View>
        {eventExcitement?.youtubeUrl ? (
          <Button
            variant="secondary"
            size="sm"
            icon="play"
            style={styles.eventUpdatesButton}
            accessibilityLabel={`Watch updates for ${eventExcitement.activity.title} on YouTube`}
            testID={AgentUiIds.overview.eventUpdates}
            onPress={() => void openHttpsUrl(eventExcitement.youtubeUrl)}
          >
            Watch Event Updates
          </Button>
        ) : null}
        {attentionItems.length ? (
          <View
            style={[
              styles.attentionList,
              {
                gap: spacing.xxs,
                borderTopColor: theme.separator,
                paddingTop: spacing.sm,
              },
            ]}
          >
            {attentionItems.slice(0, 3).map((item) => (
              <Animated.View
                key={item.key}
                exiting={FadeOutLeft.duration(motion.fade).reduceMotion(
                  ReduceMotion.System,
                )}
                layout={LinearTransition.duration(motion.layout).reduceMotion(
                  ReduceMotion.System,
                )}
                style={[styles.attentionRow, { gap: spacing.xs }]}
              >
                <View
                  style={[
                    styles.attentionMarker,
                    {
                      width: s(5),
                      height: s(5),
                      borderRadius: s(3),
                      backgroundColor: heroTone,
                    },
                  ]}
                />
                <AppText
                  variant="callout"
                  color="primary"
                  style={styles.attentionLabel}
                >
                  {item.label}
                </AppText>
                <IconButton
                  icon="check"
                  size={s(34)}
                  iconSize="sm"
                  color={heroTone}
                  accessibilityLabel={`Acknowledge ${item.label}`}
                  testID={AgentUiIds.overview.acknowledge(item.key)}
                  onPress={() => onAcknowledge(item.key)}
                />
              </Animated.View>
            ))}
            {attentionItems.length > 3 ? (
              <AppText variant="caption" color="secondary">
                +{attentionItems.length - 3} more across your sections
              </AppText>
            ) : null}
          </View>
        ) : null}
      </GlassPlate>
    </AgentTestId>
  );
}

const styles = StyleSheet.create({
  hero: {
    overflow: 'hidden',
  },
  heroTop: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  heroCopy: {
    flex: 1,
    minWidth: 0,
  },
  pulseOrbit: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radii.xl,
    flexShrink: 0,
  },
  attentionList: {
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  eventUpdatesButton: {
    alignSelf: 'flex-start',
  },
  attentionRow: {
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
  },
  attentionLabel: {
    flex: 1,
    minWidth: 0,
  },
  attentionMarker: {
    flexShrink: 0,
  },
  heroLogo: {
    width: '78%',
    height: '78%',
  },
  heroArtwork: {
    width: '100%',
    height: '100%',
  },
});
