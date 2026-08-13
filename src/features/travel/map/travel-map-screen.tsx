import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  StyleSheet,
  useWindowDimensions,
  View,
  type ModalProps,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  AppText,
  Button,
  GlassPlate,
  appPrompt,
  useSafeAreaChrome,
} from '@/components/primitives';
import { resolveSelfDisplayName } from '@/features/account/self-display-name';
import { useAuthSession } from '@/features/auth/auth-provider';
import { useRouteIsActive } from '@/hooks/use-app-activity';
import { usePreferences } from '@/store/preferences';
import { useTravel } from '@/store/travel';
import { useTravelMap } from '@/store/travel-map';
import { AgentTestId, AgentUiIds } from '@/utils/agent-ui';
import { getCurrentDeviceCoordinate } from '@/utils/device-location';
import { newUuid } from '@/utils/id';

import { canonicalTravelTripId } from '../trip-roster';
import {
  atlasCountryByCode,
  atlasCountryContainsCoordinate,
  TRAVEL_MAP_OCEAN_BOTTOM,
} from './country-data';
import { nearestAtlasCity, type TravelMapCity } from './city-data';
import {
  createTravelMapVisit,
  createStandaloneTravelMapVisit,
  syncTravelMapVisitSummary,
  TRAVEL_MAP_SELF_COLOR,
} from './model';
import {
  optionalScreenOrientation,
  TravelMapOrientationLock,
} from './optional-screen-orientation';
import {
  TRAVEL_MAP_COUNTRY_OCEAN_TOP,
  TravelMapCanvas,
  type TravelMapPlaceSelection,
} from './travel-map-canvas';
import { TravelMapCityPicker } from './travel-map-city-picker';
import { TravelMapCountryPicker } from './travel-map-country-picker';
import { TravelMapPinSheet } from './travel-map-pin-sheet';
import {
  TravelMapIconButton,
  TravelMapLayerControls,
  TravelMapPeoplePicker,
  TravelMapSelectionPreview,
  TravelMapSuggestionCard,
} from './travel-map-screen-chrome';
import { TRAVEL_MAP_WORLD_BACKDROP_TOP } from './travel-map-world-globe';
import { useTravelMapCollaboration } from './use-travel-map-collaboration';
import { useTravelMapUnpin } from './use-travel-map-unpin';
import {
  useRenderedTravelMapVisits,
  useTravelMapSuggestion,
} from './use-travel-map-screen-data';

export function TravelMapScreen() {
  const router = useRouter();
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const landscape = width > height;
  const atlasModalOrientations: ModalProps['supportedOrientations'] = landscape
    ? ['landscape-left', 'landscape-right']
    : ['portrait'];
  const { phase, user } = useAuthSession();
  const preferencesName = usePreferences((state) => state.name);
  const plans = useTravel((state) => state.plans);
  const visits = useTravelMap((state) => state.visits);
  const settings = useTravelMap((state) => state.settings);
  const pendingCount = useTravelMap((state) => state.pendingMutations.length);
  const saveVisit = useTravelMap((state) => state.saveVisit);
  const addPlace = useTravelMap((state) => state.addPlace);
  const dismissSuggestion = useTravelMap((state) => state.dismissSuggestion);
  const setSelectedFriendIds = useTravelMap(
    (state) => state.setSelectedFriendIds,
  );
  const [countryCode, setCountryCode] = useState<string>();
  const [selected, setSelected] = useState<TravelMapPlaceSelection>();
  const [countryPickerOpen, setCountryPickerOpen] = useState(false);
  const [cityPickerOpen, setCityPickerOpen] = useState(false);
  const [highlightedCity, setHighlightedCity] = useState<TravelMapCity>();
  const [pinSheetOpen, setPinSheetOpen] = useState(false);
  const [peoplePickerOpen, setPeoplePickerOpen] = useState(false);
  const [placingPin, setPlacingPin] = useState(false);
  const [draftTripId, setDraftTripId] = useState<string>();
  const [draftCoordinate, setDraftCoordinate] = useState<{
    latitude: number;
    longitude: number;
    label?: string;
  }>();
  const [initialGlobeCoordinate, setInitialGlobeCoordinate] = useState<{
    latitude: number;
    longitude: number;
  }>();
  const unpinPlace = useTravelMapUnpin(setSelected);

  useEffect(() => {
    let cancelled = false;
    void getCurrentDeviceCoordinate().then((result) => {
      if (!cancelled && result.status === 'suggested') {
        setInitialGlobeCoordinate(result.coordinate);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const selfName = resolveSelfDisplayName({
    preferencesName,
    user,
    fallback: 'Me',
  });
  const selfId = user?.id ?? 'local-self';
  const selectedCountry = atlasCountryByCode(countryCode);
  const routeIsActive = useRouteIsActive();
  const { friendProfiles, friendLayers } = useTravelMapCollaboration({
    authenticated: phase === 'authenticated' && routeIsActive,
    pendingCount,
    selectedFriendIds: settings.selectedFriendIds,
    onChangeSelectedFriendIds: setSelectedFriendIds,
  });
  const { suggestion, setSuggestion } = useTravelMapSuggestion({
    plans,
    visits,
    dismissedFingerprints: settings.dismissedSuggestionFingerprints,
  });
  const selfPerson = useMemo(
    () => ({
      userId: selfId,
      displayName: selfName,
      color: TRAVEL_MAP_SELF_COLOR,
      isSelf: true as const,
    }),
    [selfId, selfName],
  );
  const renderedVisits = useRenderedTravelMapVisits({
    plans,
    visits,
    friendLayers,
    self: selfPerson,
  });

  useSafeAreaChrome(
    selectedCountry
      ? TRAVEL_MAP_COUNTRY_OCEAN_TOP
      : TRAVEL_MAP_WORLD_BACKDROP_TOP,
    { priority: 2 },
  );

  useEffect(() => {
    const screenOrientation = optionalScreenOrientation();
    if (!screenOrientation?.lockAsync) return;
    void screenOrientation
      .lockAsync(TravelMapOrientationLock.all)
      .catch(() => undefined);
    return () => {
      void screenOrientation
        .lockAsync?.(TravelMapOrientationLock.portraitUp)
        .catch(() => undefined);
    };
  }, []);

  useEffect(() => {
    for (const visit of visits) {
      const plan = plans.find((entry) => entry.id === visit.tripId);
      if (!plan) continue;
      const next = syncTravelMapVisitSummary(visit, plan);
      if (next !== visit) saveVisit(next);
    }
  }, [plans, saveVisit, visits]);

  const savePin = useCallback(
    (input: {
      tripId?: string;
      label: string;
      latitude: number;
      longitude: number;
    }) => {
      if (!selectedCountry) return;
      const plan = input.tripId
        ? plans.find((entry) => entry.id === input.tripId)
        : undefined;
      if (input.tripId && !plan) return;
      const now = new Date().toISOString();
      const pin = {
        id: newUuid(),
        label: input.label,
        latitude: input.latitude,
        longitude: input.longitude,
        createdAt: now,
        updatedAt: now,
      };
      const existing = visits.find(
        (visit) =>
          visit.tripId === plan?.id &&
          visit.countryCode === selectedCountry.code,
      );
      if (existing) addPlace(existing.id, pin);
      else {
        const visit = plan
          ? createTravelMapVisit({
              plan,
              countryCode: selectedCountry.code,
              countryName: selectedCountry.name,
            })
          : createStandaloneTravelMapVisit({
              countryCode: selectedCountry.code,
              countryName: selectedCountry.name,
            });
        saveVisit({ ...visit, places: [pin] });
      }
      setPinSheetOpen(false);
      setDraftCoordinate(undefined);
      setDraftTripId(undefined);
      setPlacingPin(false);
    },
    [addPlace, plans, saveVisit, selectedCountry, visits],
  );

  const confirmSuggestion = () => {
    if (!suggestion) return;
    const country = atlasCountryByCode(suggestion.location.countryCode);
    if (!country) return;
    const visit = createTravelMapVisit({
      plan: suggestion.plan,
      countryCode: country.code,
      countryName: country.name,
      place: {
        label: suggestion.location.label || suggestion.plan.destination,
        latitude: suggestion.location.latitude,
        longitude: suggestion.location.longitude,
      },
    });
    saveVisit(visit);
    setCountryCode(country.code);
    setHighlightedCity(undefined);
    setSuggestion(undefined);
  };

  const returnToWorld = useCallback(() => {
    setCountryCode(undefined);
    setSelected(undefined);
    setDraftTripId(undefined);
    setPlacingPin(false);
    setCityPickerOpen(false);
    setHighlightedCity(undefined);
  }, []);

  const selectedLocalPlan = selected
    ? plans.find((plan) =>
        selected.rendered.person.isSelf
          ? plan.id === selected.rendered.visit.tripId
          : canonicalTravelTripId(plan) ===
            (selected.rendered.visit.canonicalTripId ??
              selected.rendered.visit.tripId),
      )
    : undefined;

  return (
    <AgentTestId
      testID={
        landscape
          ? AgentUiIds.travel.map.landscape
          : AgentUiIds.travel.map.portrait
      }
      label={`Travel atlas ${landscape ? 'landscape' : 'portrait'} layout`}
      style={styles.root}
    >
      <StatusBar
        animated
        style={!landscape && !selectedCountry ? 'light' : 'dark'}
      />
      <View style={styles.mapArea}>
        <AgentTestId
          testID={
            countryCode
              ? AgentUiIds.travel.map.country
              : AgentUiIds.travel.map.world
          }
          label={
            countryCode
              ? `${selectedCountry?.name ?? 'Country'} map`
              : 'World travel map'
          }
          style={styles.mapArea}
        >
          <TravelMapCanvas
            renderedVisits={renderedVisits}
            initialGlobeCoordinate={initialGlobeCoordinate}
            selectedCountryCode={countryCode}
            selectedPinId={selected?.pin.id}
            highlightedCity={highlightedCity}
            placing={placingPin}
            worldMotionPaused={countryPickerOpen}
            onCountryPress={(code) => {
              setCountryCode(code);
              setSelected(undefined);
              setHighlightedCity(undefined);
            }}
            onPlacePress={setSelected}
            onCoordinatePress={(coordinate) => {
              if (!countryCode) return;
              if (!atlasCountryContainsCoordinate(
                countryCode,
                coordinate.latitude,
                coordinate.longitude,
              )) {
                appPrompt.alert(
                  'Choose inside the country',
                  `Place the pin within ${selectedCountry?.name ?? 'the selected country'}.`,
                );
                return;
              }
              const nearestCity = nearestAtlasCity(
                countryCode,
                coordinate.latitude,
                coordinate.longitude,
              );
              const pinCoordinate = nearestCity
                ? {
                    latitude: nearestCity.latitude,
                    longitude: nearestCity.longitude,
                    label: nearestCity.name,
                  }
                : coordinate;
              setPlacingPin(false);
              setSelected(undefined);
              setHighlightedCity(nearestCity);
              setDraftCoordinate(pinCoordinate);
              setPinSheetOpen(true);
            }}
          />
        </AgentTestId>

        {landscape ? null : (
          <View style={[styles.topChrome, { left: 12, right: 12 }]}>
            <View style={styles.titleRow}>
              {countryCode ? (
                <TravelMapIconButton
                  testID={AgentUiIds.travel.map.backToWorld}
                  label="Back to world map"
                  icon="chevron-left"
                  onPress={returnToWorld}
                />
              ) : (
                <TravelMapIconButton
                  testID={AgentUiIds.travel.map.close}
                  label="Close travel atlas"
                  icon="close"
                  onPress={() => router.back()}
                />
              )}
              <GlassPlate intensity={68} style={styles.titlePlate}>
                <AppText
                  variant="heading"
                  numberOfLines={1}
                  style={styles.titleText}
                >
                  {selectedCountry?.name ?? 'My Travel Atlas'}
                </AppText>
              </GlassPlate>
              {countryCode ? (
                <TravelMapIconButton
                  testID={AgentUiIds.travel.map.citySearchOpen}
                  label={`Find a city in ${selectedCountry?.name ?? 'this country'}`}
                  icon="search"
                  onPress={() => setCityPickerOpen(true)}
                />
              ) : (
                <TravelMapIconButton
                  testID={AgentUiIds.travel.map.countryPicker}
                  label="Find a country"
                  icon="search"
                  onPress={() => setCountryPickerOpen(true)}
                />
              )}
            </View>

            <TravelMapLayerControls
              self={selfPerson}
              friendLayers={friendLayers}
              selectedFriendIds={settings.selectedFriendIds}
              onChangeSelectedFriendIds={setSelectedFriendIds}
              onOpenPeoplePicker={() => setPeoplePickerOpen(true)}
            />
          </View>
        )}

        {landscape ? (
          <View
            style={[
              styles.layerChromeLandscape,
              {
                left: 12,
                bottom: Math.max(12, insets.bottom + 6),
              },
            ]}
          >
            {countryCode ? (
              <TravelMapIconButton
                testID={AgentUiIds.travel.map.backToWorld}
                label="Back to world map"
                icon="chevron-left"
                onPress={returnToWorld}
              />
            ) : null}
            {countryCode ? (
              <TravelMapIconButton
                testID={AgentUiIds.travel.map.citySearchOpen}
                label={`Find a city in ${selectedCountry?.name ?? 'this country'}`}
                icon="search"
                onPress={() => setCityPickerOpen(true)}
              />
            ) : null}
            <TravelMapIconButton
              testID={AgentUiIds.travel.map.people}
              label="Choose friend maps"
              icon="people"
              onPress={() => setPeoplePickerOpen(true)}
            />
          </View>
        ) : null}

        {landscape && selectedCountry ? (
          <View
            pointerEvents="none"
            style={[
              styles.countryNameLandscape,
              {
                left: 128,
                right: selected ? 308 : 128,
                bottom: Math.max(12, insets.bottom + 6),
              },
            ]}
          >
            <GlassPlate intensity={65} style={styles.countryNameLandscapePlate}>
              <AppText
                variant="callout"
                fit
                numberOfLines={1}
                style={styles.countryNameLandscapeText}
              >
                {selectedCountry.name}
              </AppText>
            </GlassPlate>
          </View>
        ) : null}

        {placingPin ? (
          <GlassPlate
            intensity={72}
            style={[
              styles.placingHint,
              {
                bottom: landscape
                  ? Math.max(76, insets.bottom + 68)
                  : Math.max(14, insets.bottom + 8),
              },
            ]}
          >
            <AppText variant="callout" align="center">
              Tap inside {selectedCountry?.name} to place the pin
            </AppText>
            <Button
              size="sm"
              variant="secondary"
              onPress={() => {
                setDraftTripId(undefined);
                setPlacingPin(false);
              }}
            >
              Cancel
            </Button>
          </GlassPlate>
        ) : null}

        {countryCode && !placingPin ? (
          <View
            style={[
              styles.pinButton,
              {
                bottom: landscape
                  ? Math.max(76, insets.bottom + 70)
                  : Math.max(16, insets.bottom + 10),
              },
              landscape && selected ? { right: 322 } : undefined,
            ]}
          >
            <Button
              icon="map-pin"
              testID={AgentUiIds.travel.map.pinPlace}
              onPress={() => {
                setDraftCoordinate(
                  highlightedCity
                    ? {
                        latitude: highlightedCity.latitude,
                        longitude: highlightedCity.longitude,
                        label: highlightedCity.name,
                      }
                    : undefined,
                );
                setDraftTripId(undefined);
                setPinSheetOpen(true);
              }}
            >
              {highlightedCity ? `Pin ${highlightedCity.name}` : 'Pin a Place'}
            </Button>
          </View>
        ) : null}

        {suggestion ? (
          <TravelMapSuggestionCard
            title={suggestion.plan.title}
            locationLabel={suggestion.location.label}
            landscape={landscape}
            bottom={Math.max(74, insets.bottom + 68)}
            onSkip={() => {
              dismissSuggestion(suggestion.fingerprint);
              setSuggestion(undefined);
            }}
            onConfirm={confirmSuggestion}
          />
        ) : null}
      </View>

      {selected ? (
        <TravelMapSelectionPreview
          selection={selected}
          landscape={landscape}
          bottomInset={insets.bottom}
          onClose={() => setSelected(undefined)}
          onUnpin={
            selected.rendered.person.isSelf
              ? () => unpinPlace(selected)
              : undefined
          }
          onOpenTrip={
            selectedLocalPlan
              ? () =>
                  router.push({
                    pathname: '/travel/[id]',
                    params: { id: selectedLocalPlan.id },
                  } as never)
              : undefined
          }
        />
      ) : null}

      <TravelMapCountryPicker
        visible={countryPickerOpen}
        supportedOrientations={atlasModalOrientations}
        onClose={() => setCountryPickerOpen(false)}
        onSelect={(code) => {
          setCountryCode(code);
          setSelected(undefined);
          setHighlightedCity(undefined);
        }}
      />
      {selectedCountry ? (
        <>
          <TravelMapCityPicker
            visible={cityPickerOpen}
            countryCode={selectedCountry.code}
            countryName={selectedCountry.name}
            supportedOrientations={atlasModalOrientations}
            onClose={() => setCityPickerOpen(false)}
            onSelect={(city) => {
              setSelected(undefined);
              setHighlightedCity(city);
            }}
          />
          <TravelMapPinSheet
            visible={pinSheetOpen}
            countryCode={selectedCountry.code}
            countryName={selectedCountry.name}
            plans={plans}
            initialTripId={draftTripId}
            supportedOrientations={atlasModalOrientations}
            initialCoordinate={draftCoordinate}
            onClose={() => {
              setPinSheetOpen(false);
              setDraftCoordinate(undefined);
              setDraftTripId(undefined);
            }}
            onPlaceOnMap={(tripId) => {
              setPinSheetOpen(false);
              setDraftTripId(tripId);
              setPlacingPin(true);
            }}
            onSave={savePin}
          />
        </>
      ) : null}
      <TravelMapPeoplePicker
        visible={peoplePickerOpen}
        authenticated={phase === 'authenticated'}
        shareWithFriends={settings.shareWithFriends}
        friendProfiles={friendProfiles}
        selectedFriendIds={settings.selectedFriendIds}
        supportedOrientations={atlasModalOrientations}
        onClose={() => setPeoplePickerOpen(false)}
        onChangeSelectedFriendIds={setSelectedFriendIds}
      />
    </AgentTestId>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: TRAVEL_MAP_OCEAN_BOTTOM },
  mapArea: { flex: 1 },
  topChrome: { position: 'absolute', top: 10, gap: 8 },
  layerChromeLandscape: {
    position: 'absolute',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  countryNameLandscape: { position: 'absolute', alignItems: 'center' },
  countryNameLandscapePlate: {
    minHeight: 46,
    maxWidth: '100%',
    borderRadius: 23,
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
  countryNameLandscapeText: { textAlign: 'center', minWidth: 0 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  titlePlate: {
    flex: 1,
    minHeight: 46,
    borderRadius: 23,
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  titleText: { textAlign: 'center' },
  pinButton: { position: 'absolute', right: 16 },
  placingHint: {
    position: 'absolute',
    alignSelf: 'center',
    maxWidth: 430,
    borderRadius: 24,
    padding: 12,
    gap: 8,
  },
});
