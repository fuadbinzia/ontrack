import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    StyleSheet,
    Pressable,
    useWindowDimensions,
    View,
    type ModalProps,
} from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
    appPrompt,
    AppText,
    Button,
    GlassPlate,
    LoadingSpinner,
    useSafeAreaChrome,
} from '@/components/primitives';
import { fadeEntering, fadeExiting, popoverEntering } from '@/design-system';
import { resolveSelfDisplayName } from '@/features/account/self-display-name';
import { useAuthSession } from '@/features/auth/auth-provider';
import { useRouteIsActive } from '@/hooks/use-app-activity';
import { useFriends } from '@/store/friends';
import { usePreferences } from '@/store/preferences';
import { useTravel } from '@/store/travel';
import { useTravelMap } from '@/store/travel-map';
import { AgentTestId, AgentUiIds } from '@/utils/agent-ui';
import { getCurrentDeviceCoordinate } from '@/utils/device-location';
import { newUuid } from '@/utils/id';

import { canonicalTravelTripId } from '../trip-roster';
import { nearestAtlasCity, type TravelMapCity } from './city-data';
import {
    atlasCountryByCode,
    atlasCountryContainsCoordinate,
    TRAVEL_MAP_OCEAN_BOTTOM,
} from './country-data';
import {
    createStandaloneTravelMapVisit,
    createTravelMapVisit,
    syncTravelMapVisitSummary,
    TRAVEL_MAP_SELF_COLOR,
    travelMapCountryClusters,
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
    TravelMapCountryList,
    type TravelMapCountryListCountry,
    TravelMapPeoplePicker,
    TravelMapSelectionPreview,
    TravelMapSuggestionCard,
} from './travel-map-screen-chrome';
import { TRAVEL_MAP_WORLD_BACKDROP_TOP } from './travel-map-world-globe';
import { useOrientationSettle } from './use-orientation-settle';
import { useTravelMapCollaboration } from './use-travel-map-collaboration';
import {
    useRenderedTravelMapVisits,
    useTravelMapSuggestion,
} from './use-travel-map-screen-data';
import { useTravelMapUnpin } from './use-travel-map-unpin';

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
  const [countryListExpanded, setCountryListExpanded] = useState(false);
  const [placingPin, setPlacingPin] = useState(false);
  const [landscapeHintOpen, setLandscapeHintOpen] = useState(false);
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

  // Orientation swaps crossfade the chrome, but page open stays at rest: the
  // enter fade only arms after the first paint (page-open-rest contract).
  const chromeSettledRef = useRef(false);
  useEffect(() => {
    chromeSettledRef.current = true;
  }, []);
  const chromeSwapEntering = chromeSettledRef.current
    ? fadeEntering()
    : undefined;

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
  const rotationSettling = useOrientationSettle(width, height, routeIsActive);
  const { friendProfiles, friendLayers, refreshFriendProfiles } =
    useTravelMapCollaboration({
      authenticated: phase === 'authenticated' && routeIsActive,
      pendingCount,
      selectedFriendIds: settings.selectedFriendIds,
      onChangeSelectedFriendIds: setSelectedFriendIds,
    });
  const openPeoplePicker = useCallback(() => {
    setPeoplePickerOpen(true);
    refreshFriendProfiles();
    void useFriends.getState().refresh().catch(() => undefined);
  }, [refreshFriendProfiles]);
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
  const countryList = useMemo<TravelMapCountryListCountry[]>(() => {
    return travelMapCountryClusters(renderedVisits)
      .map((cluster) => ({
        countryCode: cluster.countryCode,
        countryName: cluster.countryName,
        visitCount: cluster.visits.length,
        pinCount: cluster.visits.reduce(
          (count, rendered) => count + rendered.visit.places.length,
          0,
        ),
        contributors: Object.values(
          cluster.visits.reduce<
            Record<
              string,
              {
                userId: string;
                displayName: string;
                avatar?: TravelMapCountryListCountry['contributors'][number]['avatar'];
                color: string;
                isSelf: boolean;
                pinCount: number;
              }
            >
          >((acc, rendered) => {
            const person = rendered.person;
            const current = acc[person.userId];
            if (current) {
              current.pinCount += rendered.visit.places.length;
              return acc;
            }
            acc[person.userId] = {
              userId: person.userId,
              displayName: person.displayName,
              avatar: person.avatar,
              color: person.color,
              isSelf: Boolean(person.isSelf),
              pinCount: rendered.visit.places.length,
            };
            return acc;
          }, {}),
        ).sort((a, b) => {
          if (a.isSelf !== b.isSelf) return a.isSelf ? -1 : 1;
          return a.displayName.localeCompare(b.displayName);
        }),
      }))
      .sort((a, b) => a.countryName.localeCompare(b.countryName));
  }, [renderedVisits]);

  const orientationHintProgress = useSharedValue(0);
  const orientationHintStyle = useAnimatedStyle(() => ({
    width: 224 * orientationHintProgress.value,
    opacity: 0.18 + orientationHintProgress.value * 0.82,
    transform: [
      {
        scaleX: 0.94 + 0.06 * orientationHintProgress.value,
      },
      {
        scaleY: 0.96 + 0.04 * orientationHintProgress.value,
      },
      {
        translateX: (1 - orientationHintProgress.value) * 14,
      },
    ],
  }));

  const toggleLandscapeHint = useCallback(() => {
    setLandscapeHintOpen((open) => !open);
  }, []);

  const orientationHintText = useMemo(() => {
    return landscape
      ? 'This map is optimized for landscape.'
      : 'Rotate to landscape for a wider atlas view.';
  }, [landscape]);

  useEffect(() => {
    orientationHintProgress.value = withTiming(
      landscapeHintOpen ? 1 : 0,
      {
        duration: 190,
        easing: Easing.out(Easing.quad),
      },
    );
  }, [landscapeHintOpen, orientationHintProgress]);

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

  const openCountry = useCallback((code: string) => {
    setCountryCode(code);
    setSelected(undefined);
    setHighlightedCity(undefined);
  }, []);

  const selectedCountryName = selectedCountry?.name;
  const placePinAtCoordinate = useCallback(
    (coordinate: { latitude: number; longitude: number }) => {
      if (!countryCode) return;
      if (!atlasCountryContainsCoordinate(
        countryCode,
        coordinate.latitude,
        coordinate.longitude,
      )) {
        appPrompt.alert(
          'Choose inside the country',
          `Place the pin within ${selectedCountryName ?? 'the selected country'}.`,
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
    },
    [countryCode, selectedCountryName],
  );

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
            onCountryPress={openCountry}
            onPlacePress={setSelected}
            onCoordinatePress={placePinAtCoordinate}
          />
        </AgentTestId>

        {landscape ? null : (
          <Animated.View
            entering={chromeSwapEntering}
            exiting={fadeExiting()}
            style={[styles.topChrome, { left: 12, right: 12 }]}
          >
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

            {countryCode ? (
              <TravelMapLayerControls
                self={selfPerson}
                friendLayers={friendLayers}
                selectedFriendIds={settings.selectedFriendIds}
                onChangeSelectedFriendIds={setSelectedFriendIds}
                onOpenPeoplePicker={openPeoplePicker}
              />
            ) : (
              <View style={styles.topActionRow}>
                <View style={styles.topActionLayerRow}>
                  <TravelMapLayerControls
                    self={selfPerson}
                    friendLayers={friendLayers}
                    selectedFriendIds={settings.selectedFriendIds}
                    onChangeSelectedFriendIds={setSelectedFriendIds}
                    onOpenPeoplePicker={openPeoplePicker}
                  />
                </View>
                {countryList.length ? (
                  <TravelMapIconButton
                    testID={AgentUiIds.travel.map.countryListToggle}
                    icon="list"
                    label={
                      countryListExpanded
                        ? 'Hide visited countries list'
                        : 'Show visited countries list'
                    }
                    onPress={() => setCountryListExpanded((open) => !open)}
                  />
                ) : null}
              </View>
            )}
            {!countryCode && countryList.length ? (
              <TravelMapCountryList
                countries={countryList}
                expanded={countryListExpanded}
                selectedCountryCode={countryCode}
                onSelectCountry={openCountry}
              />
            ) : null}
          </Animated.View>
        )}

        {landscapeHintOpen ? (
          <Pressable
            style={styles.orientationHintDismissOverlay}
            onPress={() => setLandscapeHintOpen(false)}
          />
        ) : null}
        <Animated.View
          entering={fadeEntering()}
          style={[
            styles.orientationHint,
            {
              right: 12,
              bottom: Math.max(12, insets.bottom + 6),
            },
          ]}
        >
          <Animated.View
            pointerEvents={landscapeHintOpen ? 'auto' : 'none'}
            style={[styles.orientationHintTooltipHost, orientationHintStyle]}
          >
            <GlassPlate intensity={68} style={styles.orientationHintTooltip}>
              <AppText
                variant="caption"
                style={styles.orientationHintTooltipText}
                numberOfLines={2}
              >
                {orientationHintText}
              </AppText>
            </GlassPlate>
          </Animated.View>
          <TravelMapIconButton
            compact
            testID={AgentUiIds.travel.map.orientationHint}
            label="Rotate map hint"
            icon="tip"
            dimWhenInactive
            selected={landscapeHintOpen}
            onPress={toggleLandscapeHint}
          />
        </Animated.View>

        {landscape ? (
          <Animated.View
            entering={chromeSwapEntering}
            exiting={fadeExiting()}
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
              onPress={openPeoplePicker}
            />
          </Animated.View>
        ) : null}

        {landscape && selectedCountry ? (
          <Animated.View
            pointerEvents="none"
            entering={fadeEntering()}
            exiting={fadeExiting()}
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
          </Animated.View>
        ) : null}

        {placingPin ? (
          <Animated.View
            entering={popoverEntering()}
            exiting={fadeExiting()}
            style={[
              styles.placingHintHost,
              {
                bottom: landscape
                  ? Math.max(76, insets.bottom + 68)
                  : Math.max(14, insets.bottom + 8),
              },
            ]}
          >
            <GlassPlate intensity={72} style={styles.placingHint}>
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
          </Animated.View>
        ) : null}

        {countryCode && !placingPin ? (
          <Animated.View
            entering={fadeEntering()}
            exiting={fadeExiting()}
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
          </Animated.View>
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

      {rotationSettling ? (
        // Snap-on cover: any enter fade would let the OS stretch show through.
        // Only the reveal eases once the new layout is at rest.
        <Animated.View
          pointerEvents="none"
          exiting={fadeExiting()}
          style={styles.rotationVeil}
        >
          <LinearGradient
            colors={[TRAVEL_MAP_WORLD_BACKDROP_TOP, TRAVEL_MAP_OCEAN_BOTTOM]}
            style={StyleSheet.absoluteFill}
          />
          <GlassPlate intensity={65} style={styles.rotationSpinnerWell}>
            <LoadingSpinner size={26} accessibilityLabel="Rotating the atlas" />
          </GlassPlate>
        </Animated.View>
      ) : null}

      <TravelMapCountryPicker
        visible={countryPickerOpen}
        supportedOrientations={atlasModalOrientations}
        onClose={() => setCountryPickerOpen(false)}
        onSelect={openCountry}
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
  rotationVeil: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rotationSpinnerWell: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
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
  topActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  topActionLayerRow: { flex: 1 },
  titlePlate: {
    flex: 1,
    minHeight: 46,
    borderRadius: 23,
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  titleText: { textAlign: 'center' },
  pinButton: { position: 'absolute', right: 16 },
  orientationHint: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'flex-end',
    alignSelf: 'flex-end',
    zIndex: 8,
    elevation: 8,
  },
  orientationHintDismissOverlay: {
    position: 'absolute',
    inset: 0,
    zIndex: 7,
    elevation: 7,
  },
  orientationHintTooltipHost: {
    position: 'absolute',
    right: 44,
    alignItems: 'flex-end',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  orientationHintTooltip: {
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    maxWidth: 224,
  },
  orientationHintTooltipText: {
    maxWidth: 156,
    opacity: 0.9,
  },
  placingHintHost: {
    position: 'absolute',
    alignSelf: 'center',
    maxWidth: 430,
  },
  placingHint: {
    borderRadius: 24,
    padding: 12,
    gap: 8,
  },
});
