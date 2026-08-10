import { StyleSheet, View } from 'react-native';
import Animated, { FadeInDown, ReduceMotion } from 'react-native-reanimated';

import {
    AppText,
    Card,
    GlassIconWell,
    SheetScaffold,
    Symbol,
} from '@/components/primitives';
import { springs } from '@/design-system';
import { kindChrome, kindIcon } from '@/features/travel/travel-kind-chrome';
import type { TravelItemKind } from '@/features/travel/types';
import { useResponsive } from '@/hooks/use-responsive';
import { useTheme } from '@/hooks/use-theme';
import { AgentUiIds } from '@/utils/agent-ui';

const CHOICE_ENTER_STAGGER_MS = 48;
const CHOICE_ENTER_BASE_DELAY_MS = 70;

type TimelineChoice = {
  kind: TravelItemKind;
  label: string;
  description: string;
};

const TIMELINE_CHOICES: TimelineChoice[] = [
  { kind: 'moment', label: 'Moment', description: 'Capture a memory or trip highlight.' },
  { kind: 'activity', label: 'Activity', description: 'Add a tour or something you plan to do.' },
  { kind: 'event', label: 'Event', description: 'Add a show, concert, ticket, or other booked event.' },
  { kind: 'flight', label: 'Flights', description: 'Add flight details and travel information.' },
  { kind: 'stay', label: 'Stays', description: 'Add a hotel, hostel, or accommodation.' },
  { kind: 'rental', label: 'Rental', description: 'Add a rental car or transportation details.' },
  { kind: 'transport', label: 'Transit', description: 'Add driving, rail, transit, taxi, or ferry travel.' },
];

function TimelineKindChoice({
  choice,
  index,
  onSelect,
}: {
  choice: TimelineChoice;
  index: number;
  onSelect: (kind: TravelItemKind) => void;
}) {
  const theme = useTheme();
  const colors = kindChrome(choice.kind, theme);
  const { spacing, s } = useResponsive();
  const iconSize = Math.max(46, s(48));
  return (
    <Animated.View
      entering={FadeInDown.delay(CHOICE_ENTER_BASE_DELAY_MS + index * CHOICE_ENTER_STAGGER_MS)
        .springify()
        .damping(springs.bouncy.damping)
        .stiffness(springs.bouncy.stiffness)
        .mass(springs.bouncy.mass)
        .reduceMotion(ReduceMotion.System)}>
      <Card
        airy
        onPress={() => onSelect(choice.kind)}
        testID={AgentUiIds.travel.timelineAdd.kind(choice.kind)}
        accessibilityLabel={choice.label}
        style={[
          styles.choice,
          {
            gap: spacing.md,
            borderColor: theme.separator,
          },
        ]}>
        <GlassIconWell size={iconSize} borderRadius={iconSize / 2}>
          <Symbol name={kindIcon(choice.kind)} size="lg" color={colors.accent} />
        </GlassIconWell>
        <View style={[styles.choiceCopy, { gap: spacing.xxs }]}>
          <AppText variant="subheading" fit>{choice.label}</AppText>
          <AppText variant="caption" color="secondary" numberOfLines={2}>
            {choice.description}
          </AppText>
        </View>
        <Symbol name="chevron-right" size="sm" color={colors.accent} />
      </Card>
    </Animated.View>
  );
}

export function TravelTimelineAddModal({
  visible,
  onClose,
  onSelect,
}: {
  visible: boolean;
  onClose: () => void;
  onSelect: (kind: TravelItemKind) => void;
}) {
  const { spacing } = useResponsive();
  return (
    <SheetScaffold
      visible={visible}
      eyebrow="Itinerary"
      title="Add to Timeline"
      subtitle="Choose what you’d like to add."
      onClose={onClose}
      closeAccessibilityLabel="Close add to timeline"
      closeTestID={AgentUiIds.travel.timelineAdd.close}
      surface="glass">
      <View style={{ gap: spacing.sm }}>
        {TIMELINE_CHOICES.map((choice, index) => (
          <TimelineKindChoice
            key={choice.kind}
            choice={choice}
            index={index}
            onSelect={onSelect}
          />
        ))}
      </View>
    </SheetScaffold>
  );
}

const styles = StyleSheet.create({
  choice: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
  },
  choiceCopy: { flex: 1, flexShrink: 1, minWidth: 0 },
});
