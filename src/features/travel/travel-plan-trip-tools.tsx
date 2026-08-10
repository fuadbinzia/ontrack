import { useRouter } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { appPrompt } from '@/components/primitives';
import { isTravelPlanOnCalendar, travelCalendarDrafts } from '@/features/travel/calendar';
import { TravelCollapsibleSection } from '@/features/travel/travel-collapsible-section';
import {
  TravelCalendarUpdatedModal,
  type TravelCalendarUpdatedPayload,
} from '@/features/travel/travel-calendar-updated-modal';
import { TravelCurrencySheet } from '@/features/travel/travel-currency-sheet';
import { TravelFriendsSheet } from '@/features/travel/travel-friends-sheet';
import { travelAccent } from '@/features/travel/travel-surface';
import { TravelTripActionGrid } from '@/features/travel/travel-trip-action-grid';
import type { TravelPlan } from '@/features/travel/types';
import { TravelWeatherSheet } from '@/features/travel/weather/travel-weather-sheet';
import { useResponsive } from '@/hooks/use-responsive';
import { useTheme } from '@/hooks/use-theme';
import { usePreferences } from '@/store/preferences';
import { useSchedule } from '@/store/schedule';
import { useTravel } from '@/store/travel';
import { useUI } from '@/store/ui';
import { AgentUiIds } from '@/utils/agent-ui';
import { deferAfterPageTransition } from '@/utils/defer-after-page-transition';

type TravelPlanTripToolsProps = {
  plan: TravelPlan;
  expanded: boolean;
  onToggle: () => void;
  onOpenExpenses: () => void;
  onAddTransport: () => void;
};

/**
 * Collapsible Trip Tools on plan detail — glass action grid inside the
 * section; weather/currency/friends sheets stay mounted as siblings so
 * collapsing the header does not tear down an open sheet.
 */
export function TravelPlanTripTools({
  plan,
  expanded,
  onToggle,
  onOpenExpenses,
  onAddTransport,
}: TravelPlanTripToolsProps) {
  const router = useRouter();
  const theme = useTheme();
  const { spacing: rs } = useResponsive();
  const savePlan = useTravel((state) => state.savePlan);
  const recordPlanInteraction = useTravel((state) => state.recordPlanInteraction);
  const activities = useSchedule((state) => state.activities);
  const replaceTravelActivities = useSchedule(
    (state) => state.replaceTravelActivities,
  );
  const dateDisplayFormat = usePreferences((state) => state.dateDisplayFormat);
  const setSelectedDate = useUI((state) => state.setSelectedDate);
  const isOnCalendar = isTravelPlanOnCalendar(activities, plan.id);

  const [weatherVisible, setWeatherVisible] = useState(false);
  const [currencyVisible, setCurrencyVisible] = useState(false);
  const [friendsVisible, setFriendsVisible] = useState(false);
  const [calendarUpdated, setCalendarUpdated] =
    useState<TravelCalendarUpdatedPayload | null>(null);

  return (
    <>
      <TravelCollapsibleSection
        title="Trip Tools"
        icon="settings"
        accentColor={travelAccent(theme)}
        card
        compact
        tightHeader
        expanded={expanded}
        onToggle={onToggle}
        toggleTestID={AgentUiIds.travel.planDetail.toolsSection}
        titleVariant="subheading">
        <View
          style={{
            paddingHorizontal: rs.sm,
            paddingTop: rs.xs,
            paddingBottom: rs.sm,
          }}>
          <TravelTripActionGrid
            tripId={plan.id}
            tripTitle={plan.title}
            destination={plan.destination}
            mode={plan.mode ?? 'flight'}
            isOnCalendar={isOnCalendar}
            showItineraryAction={false}
            onOpenCalendar={() => {
              const nextActivities = replaceTravelActivities(
                plan.id,
                travelCalendarDrafts(plan),
              );
              setCalendarUpdated({
                title: plan.title,
                eventCount: nextActivities.length,
                startDate: plan.startDate,
              });
              deferAfterPageTransition(() => recordPlanInteraction(plan.id));
            }}
            onSearchFlights={() => {
              router.push({
                pathname: '/travel/[id]/flights',
                params: { id: plan.id },
              } as never);
              deferAfterPageTransition(() => recordPlanInteraction(plan.id));
            }}
            onAddTransport={() => {
              onAddTransport();
              deferAfterPageTransition(() => recordPlanInteraction(plan.id));
            }}
            onSearchStays={() => {
              router.push({
                pathname: '/travel/[id]/stays',
                params: { id: plan.id },
              } as never);
              deferAfterPageTransition(() => recordPlanInteraction(plan.id));
            }}
            onOpenWeather={() => {
              setWeatherVisible(true);
              deferAfterPageTransition(() => recordPlanInteraction(plan.id));
            }}
            onOpenCurrency={() => {
              setCurrencyVisible(true);
              deferAfterPageTransition(() => recordPlanInteraction(plan.id));
            }}
            onOpenExpenses={() => {
              onOpenExpenses();
              deferAfterPageTransition(() => recordPlanInteraction(plan.id));
            }}
            onOpenChat={() => {
              router.push({
                pathname: '/travel/[id]/chat',
                params: { id: plan.id },
              } as never);
              deferAfterPageTransition(() => recordPlanInteraction(plan.id));
            }}
            onOpenCoTravelers={() => {
              setFriendsVisible(true);
              deferAfterPageTransition(() => recordPlanInteraction(plan.id));
            }}
          />
        </View>
      </TravelCollapsibleSection>

      <TravelWeatherSheet
        plan={plan}
        visible={weatherVisible}
        onClose={() => {
          appPrompt.dismiss();
          setWeatherVisible(false);
        }}
        dateDisplayFormat={dateDisplayFormat}
      />
      <TravelCurrencySheet
        plan={plan}
        visible={currencyVisible}
        onClose={() => {
          appPrompt.dismiss();
          setCurrencyVisible(false);
        }}
      />
      <TravelFriendsSheet
        plan={plan}
        visible={friendsVisible}
        onClose={() => {
          appPrompt.dismiss();
          setFriendsVisible(false);
        }}
        onSavePlan={savePlan}
      />
      <TravelCalendarUpdatedModal
        payload={calendarUpdated}
        onGoToCalendar={(startDate) => {
          setCalendarUpdated(null);
          setSelectedDate(startDate);
          router.navigate('/(tabs)/calendar');
        }}
        onBackToTravel={() => setCalendarUpdated(null)}
      />
    </>
  );
}
