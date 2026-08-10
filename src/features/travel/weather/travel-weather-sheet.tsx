import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/primitives';
import { fontFamilies, radii } from '@/design-system';
import { itinerarySheetChrome } from '@/features/travel/travel-itinerary-sheet-chrome';
import { TravelSheetModal } from '@/features/travel/travel-sheet';
import type { TravelPlan } from '@/features/travel/types';
import { useResponsive } from '@/hooks/use-responsive';
import { useTheme } from '@/hooks/use-theme';
import { AgentTestId, AgentUiIds } from '@/utils/agent-ui';
import type { DateDisplayFormat } from '@/utils/date';
import { haptics } from '@/utils/haptics';

import { TravelWeatherCard } from './travel-weather-card';

export function TravelWeatherSheet({
  plan,
  visible,
  onClose,
  dateDisplayFormat,
}: {
  plan: TravelPlan;
  visible: boolean;
  onClose: () => void;
  dateDisplayFormat: DateDisplayFormat;
}) {
  const theme = useTheme();
  const chrome = itinerarySheetChrome(theme);
  const { s, layout } = useResponsive();
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const light = theme.name === 'light';

  const destinationLabel = plan.destination.trim() || undefined;
  const sheetMinHeight = Math.round(
    Math.max(320, windowHeight - insets.top - s(16)) * 0.92,
  );
  const doneMinHeight = Math.max(layout.minTapTarget, s(52));
  const doneColors = light
    ? (['#E0B45A', '#C48A2E', '#9A6520'] as const)
    : ([chrome.ctaFrom, chrome.ctaTo] as const);

  return (
    <TravelSheetModal
      visible={visible}
      eyebrow="WEATHER"
      title="Destination Weather"
      subtitle={destinationLabel}
      subtitleIcon={destinationLabel ? 'location' : undefined}
      onClose={onClose}
      closeAccessibilityLabel="Close weather"
      closeTestID={AgentUiIds.travel.weather.close}
      minHeight={sheetMinHeight}
      scrollKey={`${plan.id}-${visible ? 'open' : 'closed'}`}
      footer={
        <AgentTestId
          testID={AgentUiIds.travel.weather.done}
          label="Done"
          onPress={() => {
            haptics.tap();
            onClose();
          }}
          style={[
            styles.doneButton,
            {
              minHeight: doneMinHeight,
              borderRadius: radii.pill,
              boxShadow: light
                ? '0 4px 14px rgba(160, 110, 40, 0.35), 0 1px 3px rgba(51, 39, 28, 0.12)'
                : '0 8px 18px rgba(0, 0, 0, 0.35)',
            },
          ]}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Done"
            onPress={() => {
              haptics.tap();
              onClose();
            }}
            style={({ pressed }) => [{ opacity: pressed ? 0.88 : 1 }]}>
            <LinearGradient
              colors={[...doneColors]}
              locations={light ? [0, 0.45, 1] : undefined}
              start={{ x: 0, y: 0.5 }}
              end={{ x: 1, y: 0.5 }}
              style={[
                styles.doneGradient,
                {
                  minHeight: doneMinHeight,
                  borderRadius: radii.pill,
                },
              ]}>
              <AppText
                variant="callout"
                fit
                numberOfLines={1}
                style={{
                  color: chrome.ctaText,
                  fontFamily: fontFamilies.serif,
                  fontSize: s(20),
                  lineHeight: s(25),
                  fontWeight: '400',
                }}>
                Done
              </AppText>
            </LinearGradient>
          </Pressable>
        </AgentTestId>
      }>
      <View style={{ paddingTop: s(16) }}>
        <TravelWeatherCard
          destination={plan.destination}
          startDate={plan.startDate}
          endDate={plan.endDate}
          dateDisplayFormat={dateDisplayFormat}
        />
      </View>
    </TravelSheetModal>
  );
}

const styles = StyleSheet.create({
  doneButton: {
    width: '100%',
    overflow: 'hidden',
    borderCurve: 'continuous',
  },
  doneGradient: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    borderCurve: 'continuous',
  },
});
