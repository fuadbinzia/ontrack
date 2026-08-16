import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/primitives';
import { glassMaterials, radii, spacing } from '@/design-system';
import { useTheme } from '@/hooks/use-theme';
import type { Activity } from '@/types/models';
import { AgentUiIds, useAgentUiTarget } from '@/utils/agent-ui';
import { dayIndicator } from '@/utils/completion';
import { isToday, monthGrid } from '@/utils/date';
import { haptics } from '@/utils/haptics';

const WEEKDAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

interface MonthGridProps {
  year: number;
  month: number;
  selected: string;
  activitiesByDate: Record<string, Activity[]>;
  holidayDates?: ReadonlySet<string>;
  onSelect: (dateKey: string) => void;
}

function MonthDayCell({
  cellKey,
  day,
  inMonth,
  isSelected,
  today,
  holiday,
  dot,
  onSelect,
}: {
  cellKey: string;
  day: number;
  inMonth: boolean;
  isSelected: boolean;
  today: boolean;
  holiday: boolean;
  dot: string | null;
  onSelect: (dateKey: string) => void;
}) {
  const theme = useTheme();
  const handlePress = () => {
    haptics.select();
    onSelect(cellKey);
  };
  const agent = useAgentUiTarget(AgentUiIds.calendar.day(cellKey), {
    label: cellKey,
    onPress: handlePress,
  });

  return (
    <Pressable
      ref={agent.ref}
      testID={AgentUiIds.calendar.day(cellKey)}
      onLayout={agent.onLayout}
      accessibilityRole="button"
      accessibilityLabel={cellKey}
      onPress={handlePress}
      style={[
        styles.cell,
        styles.dayCell,
        {
          // Reserve rim so selected/today borders don't shift the glyph.
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: 'transparent',
        },
        isSelected && {
          backgroundColor:
            theme.name === 'dark'
              ? 'rgba(255, 255, 255, 0.14)'
              : 'rgba(255, 255, 255, 0.55)',
          borderColor:
            theme.name === 'dark'
              ? glassMaterials.border.darkStrong
              : glassMaterials.border.light,
        },
        today &&
          !isSelected && {
            borderColor: theme.accentPrimary,
          },
      ]}>
      <AppText
        variant="callout"
        align="center"
        color={inMonth ? (isSelected ? 'accent' : 'primary') : 'tertiary'}>
        {day}
      </AppText>
      {inMonth && (holiday || dot) ? (
        <View style={styles.marks}>
          {holiday ? (
            <View
              style={[
                styles.holidayMark,
                { borderColor: theme.accentPrimary },
              ]}
            />
          ) : null}
          {dot ? <View style={[styles.dot, { backgroundColor: dot }]} /> : null}
        </View>
      ) : null}
    </Pressable>
  );
}

export function MonthGrid({
  year,
  month,
  selected,
  activitiesByDate,
  holidayDates,
  onSelect,
}: MonthGridProps) {
  const theme = useTheme();
  const cells = monthGrid(year, month);

  const indicatorColor = (dateKey: string): string | null => {
    const indicator = dayIndicator(activitiesByDate[dateKey] ?? []);
    switch (indicator) {
      case 'full':
        return theme.success;
      case 'partial':
        return theme.accentPrimary;
      case 'none':
        return theme.textTertiary;
      case 'empty':
        return null;
    }
  };

  return (
    <View>
      <View style={styles.weekRow}>
        {WEEKDAY_LABELS.map((label, i) => (
          <AppText key={i} variant="caption" color="tertiary" align="center" style={styles.cell}>
            {label}
          </AppText>
        ))}
      </View>
      {Array.from({ length: 6 }, (_, week) => (
        <View key={week} style={styles.weekRow}>
          {cells.slice(week * 7, week * 7 + 7).map((cell) => (
            <MonthDayCell
              key={cell.key}
              cellKey={cell.key}
              day={cell.day}
              inMonth={cell.inMonth}
              isSelected={cell.key === selected}
              today={isToday(cell.key)}
              holiday={Boolean(holidayDates?.has(cell.key))}
              dot={indicatorColor(cell.key)}
              onSelect={onSelect}
            />
          ))}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  weekRow: {
    flexDirection: 'row',
    marginBottom: spacing.xs,
  },
  cell: {
    flex: 1,
  },
  dayCell: {
    alignItems: 'center',
    justifyContent: 'center',
    aspectRatio: 0.9,
    borderRadius: radii.md,
  },
  marks: {
    position: 'absolute',
    bottom: spacing.xs,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  holidayMark: {
    width: 5,
    height: 5,
    borderRadius: 3,
    borderWidth: 1.5,
    backgroundColor: 'transparent',
  },
  // Overlay so the day digit stays optically centered in the plate.
  dot: {
    width: 5,
    height: 5,
    borderRadius: 3,
  },
});
