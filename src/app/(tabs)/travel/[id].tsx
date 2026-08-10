import { Stack, useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';

import type { TravelImportResult } from '@/features/travel/travel-import-result-modal';
import { TravelPlanDetail } from '@/features/travel/travel-plan-detail';
import type { TravelItemKind } from '@/features/travel/types';
import { usePreferences, type ThemePreference } from '@/store/preferences';

const ADD_KINDS = new Set<TravelItemKind>([
  'moment',
  'activity',
  'event',
  'flight',
  'transport',
  'stay',
  'rental',
]);

const THEME_PREFS = new Set<ThemePreference>(['system', 'light', 'dark']);

export default function TravelPlanScreen() {
  const {
    id,
    add,
    theme: themeParam,
    openStayBooking,
    reservationEmail,
    previewModal,
    importFlight,
  } = useLocalSearchParams<{
    id: string;
    add?: string;
    theme?: string;
    openStayBooking?: string;
    reservationEmail?: string;
    previewModal?: string;
    importFlight?: string;
  }>();
  const setThemePreference = usePreferences((s) => s.setThemePreference);
  const initialAddKind =
    typeof add === 'string' && ADD_KINDS.has(add as TravelItemKind)
      ? (add as TravelItemKind)
      : undefined;
  const initialOpenAddPicker = __DEV__ && add === 'timeline';
  const autoOpenStayBooking =
    __DEV__ &&
    (openStayBooking === '1' || openStayBooking === 'true');
  const autoOpenReservationEmail =
    __DEV__ && typeof reservationEmail === 'string'
      ? reservationEmail
      : undefined;
  const initialOpenExpenses = __DEV__ && previewModal === 'expense';
  const initialImportResult: TravelImportResult | undefined =
    __DEV__ && previewModal === 'import'
      ? { stage: 'imported', kindLabel: 'Flight', duplicateItinerary: false }
      : __DEV__ && previewModal === 'expense-saved'
        ? { stage: 'expense-saved' }
        : undefined;
  const initialFlightImportFixture =
    __DEV__ &&
    (importFlight === 'roundtrip' ||
      importFlight === 'connecting' ||
      importFlight === 'jetblue')
      ? (importFlight as 'roundtrip' | 'connecting' | 'jetblue')
      : undefined;

  // DEV-only: deep-link `?theme=dark|light|system` for simulator QA of themed sheets.
  useEffect(() => {
    if (!__DEV__) return;
    if (typeof themeParam !== 'string' || !THEME_PREFS.has(themeParam as ThemePreference)) {
      return;
    }
    setThemePreference(themeParam as ThemePreference);
  }, [themeParam, setThemePreference]);

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: false,
          // Transparent so itinerary sky chrome (status bar + header) shows
          // through; page wash starts below the sky band in plan detail body.
          contentStyle: { backgroundColor: 'transparent', paddingTop: 0 },
        }}
      />
      <TravelPlanDetail
        key={`${id}:${previewModal ?? ''}:${importFlight ?? ''}`}
        planId={id}
        initialAddKind={initialAddKind}
        initialOpenAddPicker={initialOpenAddPicker}
        autoOpenStayBooking={autoOpenStayBooking}
        autoOpenReservationEmail={autoOpenReservationEmail}
        initialOpenExpenses={initialOpenExpenses}
        initialImportResult={initialImportResult}
        initialFlightImportFixture={initialFlightImportFixture}
      />
    </>
  );
}
