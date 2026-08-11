import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    NativeScrollEvent,
    NativeSyntheticEvent,
    ScrollView,
    StyleSheet,
    View,
    useWindowDimensions,
} from 'react-native';

import { travelHomeScreenStyles as styles } from '@/features/travel/travel-home-screen-styles';
import { useTravelHomeScreen } from '@/features/travel/use-travel-home-screen';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
    Screen,
    appPrompt,
    useSafeAreaChrome,
    useSafeAreaChromeOverlay,
} from '@/components/primitives';
import { spacing } from '@/design-system';
import { resolveSelfDisplayName } from '@/features/account/self-display-name';
import { useAuthSession } from '@/features/auth/auth-provider';
import { isTravelPlanOnCalendar, travelCalendarDrafts } from '@/features/travel/calendar';
import { validateTravelDateRange } from '@/features/travel/date-range';
import {
    persistTravelCoverPhotos,
    uploadedTripCoverUris,
} from '@/features/travel/destination-cover';
import { currencyFromLocale } from '@/features/travel/expenses/format-money';
import { repairTravelPlansChatAccess } from '@/features/travel/travel-chat-roster';
import { TravelFriendsSheet } from '@/features/travel/travel-friends-sheet';
import { travelHomeAtmosphereHeaderScrimColors } from '@/features/travel/travel-home-atmosphere-ink';
import {
    TravelHomeAtmosphereScrim,
    travelHomeAtmosphereScrimHeight,
} from '@/features/travel/travel-home-atmosphere-scrim';
import {
    TravelHomeBackground,
    travelHomeAtmosphereHeight,
} from '@/features/travel/travel-home-background';
import { TravelHomeEmpty } from '@/features/travel/travel-home-empty';
import { TravelHomeHeader } from '@/features/travel/travel-home-header';
import { filterTravelPlansByQuery } from '@/features/travel/travel-home-plan-search';
import {
    TravelHomeYourTrips,
    isTravelHomeTripSearchActive,
} from '@/features/travel/travel-home-your-trips';
import { TravelNewTripSheet } from '@/features/travel/travel-new-trip-sheet';
import {
    stripTripCoverUploads,
    tripCoverUploadFields,
    validateTravelPlanDetails,
} from '@/features/travel/travel-plan-details';
import { TravelPlanDetailsEditor } from '@/features/travel/travel-plan-details-editor';
import { useTravelPageStyle } from '@/features/travel/travel-surface';
import type { TravelPlan, TravelPlanMode } from '@/features/travel/types';
import { useTravelHomeAtmosphereImage } from '@/features/travel/use-travel-home-atmosphere-image';
import { useResponsive } from '@/hooks/use-responsive';
import { FeatureThemeProvider, useTheme } from '@/hooks/use-theme';
import { usePreferences } from '@/store/preferences';
import { useSchedule } from '@/store/schedule';
import {
    orderTravelPlansByRecency,
    orderTravelPlansForLauncher,
    useTravel,
} from '@/store/travel';
import { toDateKey } from '@/utils/date';
import { deferAfterPageTransition } from '@/utils/defer-after-page-transition';
import { newId } from '@/utils/id';
import { warmHrefsAfterTransition } from '@/utils/warm-navigation';


export function TravelScreenContent() {
  const {
    showForm,
    title,
    mode,
    destination,
    destinationLocation,
    setDestinationLocation,
    startDate,
    endDate,
    notes,
    setNotes,
    error,
    editingDetailsPlanId,
    setEditingDetailsPlanId,
    editTitle,
    setEditTitle,
    editDestination,
    setEditDestination,
    editDestinationLocation,
    setEditDestinationLocation,
    editNotes,
    setEditNotes,
    editStartDate,
    setEditStartDate,
    editEndDate,
    setEditEndDate,
    editCoverUris,
    setEditCoverUris,
    detailsError,
    friendsPlanId,
    friendsVisible,
    pendingCreatedTripId,
    pendingFollowTripId,
    scrollTargetOffset,
    activeTripId,
    tripSearchQuery,
    setTripSearchQuery,
    tripSearchOpen,
    setTripSearchOpen,
    theme,
    travelStyle,
    insets,
    router,
    plans,
    recentPlanIds,
    recordPlanInteraction,
    savePlan,
    removePlan,
    activities,
    replaceTravelActivities,
    dateLocale,
    preferencesName,
    selfDisplayName,
    today,
    scrollRef,
    editScrollRef,
    tripOffsets,
    focusedTripId,
    scrollTargetTripId,
    sortedPlans,
    currentPlans,
    launcherPlans,
    collapseTripSearch,
    tripSearchActive,
    visibleLauncherPlans,
    hasCurrentTrips,
    interactWithPlan,
    rememberTripOffset,
    updateActiveTripFromScroll,
    friendsPlan,
    openFriends,
    closeFriends,
    openItinerary,
    warmTripIds,
    creatingPlanRef,
    createPlan,
    beginEditingDetails,
    openCoverPickerOnEdit,
    saveEditedDetails,
    editingPlan,
    openCreateTrip,
    closeCreateTrip,
    atmosphereImage,
    hasNoTrips,
    atmosphereHeight,
    atmosphereHeaderInk,
    atmosphereScrim,
    atmosphereScrimHeight,
    setTitle,
    setDestination,
    setStartDate,
    setEndDate,
    editCover,
    tripId,
    rs,
    user,
  } = useTravelHomeScreen();

  if (editingPlan) {
    return (
      <Screen
        key={`edit-trip-${editingPlan.id}`}
        scrollRef={editScrollRef}
        style={travelStyle}
        contentStyle={styles.screen}
        refresh={false}>
        <TravelPlanDetailsEditor
          plan={editingPlan}
          title={editTitle}
          destination={editDestination}
          notes={editNotes}
          onNotesChange={setEditNotes}
          startDate={editStartDate}
          endDate={editEndDate}
          coverUris={editCoverUris}
          error={detailsError}
          initialCoverPickerOpen={openCoverPickerOnEdit}
          onTitleChange={setEditTitle}
          onDestinationChange={(value) => {
            setEditDestination(value);
            setEditDestinationLocation(undefined);
          }}
          onDestinationSuggestionSelect={(suggestion) => {
            if (
              suggestion.countryName &&
              suggestion.countryCode &&
              suggestion.latitude !== undefined &&
              suggestion.longitude !== undefined
            ) {
              setEditDestinationLocation({
                label: [suggestion.label, suggestion.secondary].filter(Boolean).join(', '),
                countryName: suggestion.countryName,
                countryCode: suggestion.countryCode,
                latitude: suggestion.latitude,
                longitude: suggestion.longitude,
              });
            }
          }}
          onStartDateChange={setEditStartDate}
          onEndDateChange={setEditEndDate}
          onCoverUrisChange={setEditCoverUris}
          onSave={() => void saveEditedDetails(editingPlan)}
          onCancel={() => setEditingDetailsPlanId(undefined)}
          onDelete={() => {
            removePlan(editingPlan.id);
            setEditingDetailsPlanId(undefined);
          }}
        />
      </Screen>
    );
  }

  return (
    <View style={styles.fill}>
      <TravelHomeBackground enabled empty={hasNoTrips} />
      <Screen
        scrollRef={scrollRef}
        style={styles.transparentScreen}
        refresh={!showForm}
        onScroll={updateActiveTripFromScroll}
        contentStyle={{
          // The trips section begins immediately after the Travel title/subtitle.
          gap: 0,
          // Sit the Travel header flush under the safe-area chrome (no cream gap).
          paddingTop: 0,
        }}>
        <TravelHomeHeader
          onOpenMap={() => router.push('/travel-map' as never)}
          onAddTrip={!showForm && !hasNoTrips ? openCreateTrip : undefined}
          locationLabel={atmosphereImage.label}
          headerInk={atmosphereImage.headerInk}
          onPressAway={tripSearchActive ? collapseTripSearch : undefined}
        />

        {hasNoTrips ? (
          <TravelHomeEmpty onAddTrip={openCreateTrip} />
        ) : (
          <TravelHomeYourTrips
            plans={visibleLauncherPlans}
            searchQuery={tripSearchQuery}
            onSearchQueryChange={setTripSearchQuery}
            searchOpen={tripSearchOpen}
            onSearchOpenChange={setTripSearchOpen}
            onDismissSearch={collapseTripSearch}
            selfDisplayName={selfDisplayName}
            atmosphereAverageColor={atmosphereImage.averageColor}
            onOpenTrip={openItinerary}
            onEditTrip={(id) => {
              const next = sortedPlans.find((item) => item.id === id);
              if (next) beginEditingDetails(next);
            }}
            onViewTravelers={openFriends}
            onLayoutY={rememberTripOffset}
          />
        )}

        {friendsPlan ? (
          <TravelFriendsSheet
            plan={friendsPlan}
            visible={friendsVisible}
            onClose={closeFriends}
            onSavePlan={savePlan}
          />
        ) : null}
      </Screen>

      <TravelNewTripSheet
        visible={showForm}
        title={title}
        destination={destination}
        startDate={startDate}
        endDate={endDate}
        notes={notes}
        error={error}
        onTitleChange={setTitle}
        onDestinationChange={(value) => {
          setDestination(value);
          setDestinationLocation(undefined);
        }}
        onDestinationSuggestionSelect={(suggestion) => {
          if (
            suggestion.countryName &&
            suggestion.countryCode &&
            suggestion.latitude !== undefined &&
            suggestion.longitude !== undefined
          ) {
            setDestinationLocation({
              label: [suggestion.label, suggestion.secondary].filter(Boolean).join(', '),
              countryName: suggestion.countryName,
              countryCode: suggestion.countryCode,
              latitude: suggestion.latitude,
              longitude: suggestion.longitude,
            });
          }
        }}
        onStartDateChange={setStartDate}
        onEndDateChange={setEndDate}
        onNotesChange={setNotes}
        onCreate={createPlan}
        onClose={closeCreateTrip}
      />
    </View>
  );
}

/** Primary travel planning tab — trip launcher (tools live on trip hub). */
export default function TravelHomeScreen() {
  return (
    <FeatureThemeProvider feature="travel">
      <TravelScreenContent />
    </FeatureThemeProvider>
  );
}
