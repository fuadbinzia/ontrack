import {
    useEffect,
    useRef,
    useState,
    type MutableRefObject,
    type RefObject,
} from 'react';
import { Pressable, View } from 'react-native';

import {
    ErrorMessage,
    GlassIconWell,
    SettingsGroup,
    Symbol,
} from '@/components/primitives';
import { radii } from '@/design-system';
import { CityAutofindSettingsRow } from '@/features/account/city-autofind-settings-row';
import { getDestinationCurrentWeather } from '@/features/travel/weather/provider';
import { temperatureUnitForDateFormat } from '@/features/travel/weather/temperature-unit';
import type { TemperatureUnit } from '@/features/travel/weather/types';
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
  unit: TemperatureUnit,
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

/** Commit immediately, then normalize when non-empty (shared by Home / Current). */
async function persistPlaceLabel(input: {
  raw: string;
  getSaved: () => string;
  commit: (value: string) => void;
  onUnchanged?: (trimmed: string, saved: string) => void;
  genRef: MutableRefObject<number>;
  setSaving: (saving: boolean) => void;
  unit: TemperatureUnit;
  setError: (error: string | undefined) => void;
}): Promise<void> {
  const trimmed = input.raw.trim();
  const saved = input.getSaved();
  if (trimmed === saved) {
    input.setError(undefined);
    input.onUnchanged?.(trimmed, saved);
    return;
  }

  input.commit(trimmed);
  input.setError(undefined);
  if (!trimmed) {
    haptics.tap();
    return;
  }

  const gen = ++input.genRef.current;
  input.setSaving(true);
  haptics.tap();
  try {
    const normalized = await normalizePlaceLabel(trimmed, input.unit);
    if (gen !== input.genRef.current) return;
    if (normalized !== trimmed) input.commit(normalized);
    haptics.success();
  } finally {
    if (gen === input.genRef.current) input.setSaving(false);
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

  const persistHome = (raw: string) =>
    persistPlaceLabel({
      raw,
      getSaved: () => usePreferences.getState().homeLocation.trim(),
      commit: (value) => {
        setHomeLocation(value);
        writeHomeDraft(value);
      },
      genRef: homeSaveGen,
      setSaving: setSavingHome,
      unit,
      setError,
    });

  const persistCurrent = (raw: string) =>
    persistPlaceLabel({
      raw,
      getSaved: () => usePreferences.getState().currentLocation.trim(),
      commit: (value) => {
        setCurrentLocation(value);
        writeCurrentDraft(value, false);
      },
      onUnchanged: (trimmed, saved) => {
        writeCurrentDraft(trimmed || saved, false);
      },
      genRef: currentSaveGen,
      setSaving: setSavingCurrent,
      unit,
      setError,
    });

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
