import { Pressable, StyleSheet, View } from 'react-native';

import { AppText, GlassMetaChip } from '@/components/primitives';
import { spacing } from '@/design-system';
import {
  travelEditorialTextStyle,
  travelOverlineStyle,
} from '@/features/travel/travel-chrome';
import { travelItineraryInk } from '@/features/travel/travel-surface';
import type { TimelineDayPhase } from '@/features/travel/travel-timeline-progress';
import { useResponsive } from '@/hooks/use-responsive';
import { useTheme } from '@/hooks/use-theme';
import { AgentUiIds, useAgentUiTarget } from '@/utils/agent-ui';
import { fromDateKey } from '@/utils/date';

/** Per-day spine accents — blue, green, then warm/cool cycle. */
const DAY_SPINE_LIGHT = ['#2F6FE4', '#2F9B6A', '#C47A2C', '#7B5EA7', '#2F8A8A'] as const;
const DAY_SPINE_DARK = ['#6B9BE8', '#5BC48A', '#D4A05A', '#B394D0', '#5BB8B8'] as const;

export function dayNumberFor(planStartDate: string, date: string): number {
  const start = fromDateKey(planStartDate).getTime();
  const current = fromDateKey(date).getTime();
  return Math.round((current - start) / (24 * 60 * 60 * 1000)) + 1;
}

export function daySpineColor(dayIndex: number, themeName: string): string {
  const palette = themeName === 'dark' ? DAY_SPINE_DARK : DAY_SPINE_LIGHT;
  return palette[dayIndex % palette.length] ?? palette[0];
}

function mixHexChannel(a: number, b: number, t: number): number {
  return Math.round(a + (b - a) * t);
}

/** Lerp `#RRGGBB` colors for stepped dashed bridges between day spines. */
function mixSpineColor(from: string, to: string, t: number): string {
  const parse = (hex: string) => {
    const raw = hex.replace('#', '');
    return {
      r: Number.parseInt(raw.slice(0, 2), 16),
      g: Number.parseInt(raw.slice(2, 4), 16),
      b: Number.parseInt(raw.slice(4, 6), 16),
    };
  };
  const a = parse(from);
  const b = parse(to);
  const clamped = Math.min(1, Math.max(0, t));
  const r = mixHexChannel(a.r, b.r, clamped);
  const g = mixHexChannel(a.g, b.g, clamped);
  const bl = mixHexChannel(a.b, b.b, clamped);
  return `#${[r, g, bl].map((n) => n.toString(16).padStart(2, '0')).join('')}`;
}

/** View-based dashed bridge — SVG stroke gradients are unreliable on thin vertical rails. */
export function TimelineDayBridge({
  fromColor,
  toColor,
  height,
  thickness,
  dashLength,
}: {
  fromColor: string;
  toColor: string;
  height: number;
  thickness: number;
  dashLength: number;
}) {
  const count = Math.max(3, Math.floor(height / (dashLength + 2)));
  return (
    <View
      pointerEvents="none"
      style={{
        height,
        width: thickness,
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
      {Array.from({ length: count }, (_, index) => {
        const t = count === 1 ? 0 : index / (count - 1);
        return (
          <View
            key={`dash-${index}`}
            style={{
              width: thickness,
              height: dashLength,
              borderRadius: thickness / 2,
              backgroundColor: mixSpineColor(fromColor, toColor, t),
            }}
          />
        );
      })}
    </View>
  );
}

function dayPhaseChipLabel(
  phase: TimelineDayPhase,
  entryCount: number,
): string {
  if (phase === 'past') return 'Done';
  if (phase === 'current') return 'Today';
  return `${entryCount} ${entryCount === 1 ? 'Stop' : 'Stops'}`;
}

export function TimelineDayHeader({
  date,
  dayNumber,
  weekday,
  dateLabel,
  entryCount,
  dayPhase,
  dayExpanded,
  dayTap,
  overlineSize,
  overlineLineHeight,
  onToggleDay,
  /** Override “Day N” — e.g. Pre-trip / Post Trip. */
  titleLabel,
}: {
  date: string;
  dayNumber: number;
  weekday: string;
  dateLabel: string;
  entryCount: number;
  dayPhase: TimelineDayPhase;
  dayExpanded: boolean;
  dayTap: number;
  overlineSize: number;
  overlineLineHeight: number;
  onToggleDay: (date: string) => void;
  titleLabel?: string;
}) {
  const theme = useTheme();
  const { spacing: rs } = useResponsive();
  const primaryInk = travelItineraryInk(theme);
  const secondaryInk = travelItineraryInk(theme, 'secondary');
  // Pre-trip / Post Trip use `titleLabel` — no phase pill (Done / Today / N Stops).
  const chipLabel = titleLabel
    ? undefined
    : dayPhaseChipLabel(dayPhase, entryCount);
  const heading = titleLabel ?? `Day ${dayNumber}`;
  const dayTitle = chipLabel
    ? `${heading} · ${dateLabel} · ${chipLabel}`
    : `${heading} · ${dateLabel}`;
  const dayAgent = useAgentUiTarget(AgentUiIds.travel.timelineDay.toggle(date), {
    label: dayTitle,
    onPress: () => onToggleDay(date),
  });
  return (
    <Pressable
      ref={dayAgent.ref}
      testID={dayAgent.testID}
      onLayout={dayAgent.onLayout}
      accessibilityRole="button"
      accessibilityState={{ expanded: dayExpanded }}
      onPress={() => onToggleDay(date)}
      hitSlop={6}
      accessibilityLabel={dayTitle}
      style={[styles.dayHeader, { minHeight: dayTap, gap: rs.xs }]}>
      <View style={styles.dayTitleBlock}>
        <AppText
          variant="callout"
          fit
          style={[styles.dayNumber, { color: primaryInk }]}>
          {heading}
        </AppText>
        <AppText
          variant="caption"
          fit
          style={[
            travelOverlineStyle,
            styles.dayMeta,
            {
              color: secondaryInk,
              fontSize: overlineSize,
              lineHeight: overlineLineHeight,
            },
          ]}>
          {weekday} · {dateLabel}
        </AppText>
      </View>
      {chipLabel ? (
        <GlassMetaChip accessibilityLabel={chipLabel}>
          <AppText
            variant="caption"
            fit
            style={{ fontSize: overlineSize, color: primaryInk }}>
            {chipLabel}
          </AppText>
        </GlassMetaChip>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  dayHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dayTitleBlock: {
    flex: 1,
    flexShrink: 1,
    minWidth: 0,
    gap: spacing.xxs,
  },
  dayNumber: {
    ...travelEditorialTextStyle,
    flexShrink: 1,
    minWidth: 0,
  },
  dayMeta: {
    ...travelEditorialTextStyle,
    flexShrink: 1,
    minWidth: 0,
    textTransform: 'none',
  },
});
