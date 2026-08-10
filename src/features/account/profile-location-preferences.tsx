import { useEffect, useRef, useState, type RefObject } from 'react';
import { Pressable, View } from 'react-native';

import {
  ErrorMessage,
  GlassIconWell,
  SettingsGroup,
  Symbol,
} from '@/components/primitives';
import { CityAutofindSettingsRow } from '@/features/account/city-autofind-settings-row';
import { radii } from '@/design-system';
import { getDestinationCurrentWeather } from '@/features/travel/weather';
import { temperatureUnitForDateFormat } from '@/features/travel/weather/temperature-unit';
import { useCurrentPlaceLabel } from '@/hooks/use-current-place-label';
import { useResponsive } from '@/hooks/use-responsive';
import { useTheme } from '@/hooks/use-theme';
import { usePreferences } from '@/store/preferences';
import { AgentUiIds, useAgentUiTarget } from '@/utils/agent-ui';
import { getCurrentPlaceLabel } from '@/utils/device-location';
import { haptics } from '@/utils/haptics';

export type ProfileLocationReveal = 'homeLocation' | 'currentLocation';

type ProfileLocationPreferencesProps = {
  homeAnchorRef?: RefObject<View | null>;
  currentAnchorRef?: RefObject<View | null>;
};

/**
 * Persist first, then optionally normalize via Open-Meteo.
 * Weather lookup failure must not wipe a user-authored place.
 */
async function normalizePlaceLabel(
  raw: string,
  unit: 'fahrenheit' | 'celsius',
): Promise<string> {
  const trimmed = raw.trim();
  if (!trimmed) return '';
  try {
    const weather = await getDestinationCurrentWeather(trimmed, unit);
    const label = weather.locationLabel.trim();
    return label || trimmed;
  } catch {
    return trimmed;
  }
}

/** Home + Current location rows with Open-Meteo city autocomplete. */
export function ProfileLocationPreferences({
  homeAnchorRef,
  currentAnchorRef,
}: ProfileLocationPreferencesProps = {}) {
  const theme = useTheme();
  const { s, layout } = useResponsive();
  const homeLocation = usePreferences((state) => state.homeLocation);
  const currentLocation = usePreferences((state) => state.currentLocation);
  const dateDisplayFormat = usePreferences((state) => state.dateDisplayFormat);
  const setHomeLocation = usePreferences((state) => state.setHomeLocation);
  const setCurrentLocation = usePreferences((state) => state.setCurrentLocation);
  const gpsPlace = useCurrentPlaceLabel(true);
  const unit = temperatureUnitForDateFormat(dateDisplayFormat);

  const [homeDraft, setHomeDraft] = useState(homeLocation);
  const [currentDraft, setCurrentDraft] = useState(currentLocation);
  const [currentDirty, setCurrentDirty] = useState(false);
  const [savingHome, setSavingHome] = useState(false);
  const [savingCurrent, setSavingCurrent] = useState(false);
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState<string>();

  const homeDraftRef = useRef(homeDraft);
  const currentDraftRef = useRef(currentDraft);
  const currentDirtyRef = useRef(currentDirty);
  const homeSaveGen = useRef(0);
  const currentSaveGen = useRef(0);

  const writeHomeDraft = (text: string) => {
    homeDraftRef.current = text;
    setHomeDraft(text);
  };
  const writeCurrentDraft = (text: string, dirty: boolean) => {
    currentDraftRef.current = text;
    currentDirtyRef.current = dirty;
    setCurrentDraft(text);
    setCurrentDirty(dirty);
  };

  useEffect(() => {
    writeHomeDraft(homeLocation);
  }, [homeLocation]);

  useEffect(() => {
    if (currentDirtyRef.current) return;
    const saved = currentLocation.trim();
    if (saved) {
      writeCurrentDraft(saved, false);
      return;
    }
    // No override — mirror live GPS in the field (display only until edited).
    if (gpsPlace.status === 'suggested') {
      writeCurrentDraft(gpsPlace.label, false);
      return;
    }
    if (gpsPlace.status === 'loading') {
      writeCurrentDraft('', false);
      return;
    }
    writeCurrentDraft('', false);
  }, [currentLocation, gpsPlace.label, gpsPlace.status]);

  const persistHome = async (raw: string) => {
    const trimmed = raw.trim();
    const saved = usePreferences.getState().homeLocation.trim();
    if (trimmed === saved) {
      setError(undefined);
      return;
    }

    // Commit immediately so leaving the screen cannot lose the edit.
    setHomeLocation(trimmed);
    writeHomeDraft(trimmed);
    setError(undefined);
    if (!trimmed) {
      haptics.tap();
      return;
    }

    const gen = ++homeSaveGen.current;
    setSavingHome(true);
    haptics.tap();
    try {
      const normalized = await normalizePlaceLabel(trimmed, unit);
      if (gen !== homeSaveGen.current) return;
      if (normalized !== trimmed) {
        setHomeLocation(normalized);
        writeHomeDraft(normalized);
      }
      haptics.success();
    } finally {
      if (gen === homeSaveGen.current) setSavingHome(false);
    }
  };

  const persistCurrent = async (raw: string) => {
    const trimmed = raw.trim();
    const saved = usePreferences.getState().currentLocation.trim();
    if (trimmed === saved) {
      setError(undefined);
      writeCurrentDraft(trimmed || saved, false);
      return;
    }

    // Always persist the override (including when it matches GPS).
    setCurrentLocation(trimmed);
    writeCurrentDraft(trimmed, false);
    setError(undefined);
    if (!trimmed) {
      haptics.tap();
      return;
    }

    const gen = ++currentSaveGen.current;
    setSavingCurrent(true);
    haptics.tap();
    try {
      const normalized = await normalizePlaceLabel(trimmed, unit);
      if (gen !== currentSaveGen.current) return;
      if (normalized !== trimmed) {
        setCurrentLocation(normalized);
        writeCurrentDraft(normalized, false);
      }
      haptics.success();
    } finally {
      if (gen === currentSaveGen.current) setSavingCurrent(false);
    }
  };

  const commitHome = () => void persistHome(homeDraftRef.current);
  // Only blur-save when the user actually edited — avoids GPS mirror clobbering
  // a just-committed suggestion when Keyboard.dismiss fires onBlur.
  const commitCurrent = () => {
    if (!currentDirtyRef.current) return;
    void persistCurrent(currentDraftRef.current);
  };

  const locateCurrent = () => {
    if (locating || savingCurrent) return;
    setLocating(true);
    setError(undefined);
    setCurrentDirty(true);
    haptics.tap();
    void getCurrentPlaceLabel()
      .then(async (result) => {
        if (result.status === 'denied') {
          setError('Location permission is off. Enable it in Settings.');
          setCurrentDirty(false);
          return;
        }
        if (result.status !== 'suggested' || !result.label.trim()) {
          setError('Could not determine your current place.');
          setCurrentDirty(false);
          return;
        }
        // Snapshot GPS into Current override (still never writes Home).
        await persistCurrent(result.label);
        gpsPlace.refresh();
      })
      .finally(() => {
        setLocating(false);
      });
  };

  const locateAgent = useAgentUiTarget(AgentUiIds.profile.currentLocationLocate, {
    label: 'Use current geolocation',
    onPress: locateCurrent,
  });

  const currentPlaceholder = locating
    ? 'Locating…'
    : gpsPlace.status === 'loading' || gpsPlace.status === 'denied'
      ? gpsPlace.detail
      : 'City or place';

  const busy = savingHome || savingCurrent || locating;

  return (
    <View>
      <SettingsGroup>
        <CityAutofindSettingsRow
          label="Home location"
          icon="home"
          value={homeDraft}
          onChangeText={writeHomeDraft}
          onCommit={(label) => {
            writeHomeDraft(label);
            void persistHome(label);
          }}
          onBlur={commitHome}
          placeholder="e.g. Austin, TX"
          editable={!busy}
          testID={AgentUiIds.profile.homeLocation}
          accessibilityLabel="Home location"
          anchorRef={homeAnchorRef}
        />
        <CityAutofindSettingsRow
          label="Current location"
          icon="target"
          value={currentDraft}
          onChangeText={(text) => {
            writeCurrentDraft(text, true);
          }}
          onCommit={(label) => {
            writeCurrentDraft(label, true);
            void persistCurrent(label);
          }}
          onBlur={commitCurrent}
          placeholder={currentPlaceholder}
          editable={!busy}
          testID={AgentUiIds.profile.currentLocation}
          accessibilityLabel="Current location"
          anchorRef={currentAnchorRef}
          trailing={
            <Pressable
              ref={locateAgent.ref}
              testID={locateAgent.testID}
              onLayout={locateAgent.onLayout}
              accessibilityRole="button"
              accessibilityLabel="Use current geolocation"
              disabled={busy}
              onPress={locateCurrent}
              hitSlop={8}
              style={{
                opacity: busy ? 0.45 : 1,
                minWidth: layout.minTapTarget,
                minHeight: layout.minTapTarget,
                alignItems: 'center',
                justifyContent: 'center',
              }}>
              <GlassIconWell size={s(34)} borderRadius={radii.sm}>
                <Symbol
                  name="map-pin"
                  size="sm"
                  color={theme.accentPrimary}
                />
              </GlassIconWell>
            </Pressable>
          }
        />
      </SettingsGroup>
      {error ? <ErrorMessage message={error} /> : null}
    </View>
  );
}
