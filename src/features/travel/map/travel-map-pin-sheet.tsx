import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View, type ModalProps } from 'react-native';

import {
  AppText,
  Button,
  Dropdown,
  GlassPlate,
  GlassPrimaryAction,
  Input,
} from '@/components/primitives';
import {
  searchAddressesInCountry,
  type AddressSuggestion,
} from '@/features/travel/address-lookup';
import { TravelSheetModal } from '@/features/travel/travel-sheet';
import type { TravelPlan } from '@/features/travel/types';
import { useResponsive } from '@/hooks/use-responsive';
import { AgentUiIds, useAgentUiTarget } from '@/utils/agent-ui';

type Coordinate = { latitude: number; longitude: number; label?: string };

export function TravelMapPinSheet({
  visible,
  countryCode,
  countryName,
  plans,
  initialTripId,
  initialCoordinate,
  onClose,
  onPlaceOnMap,
  onSave,
  supportedOrientations,
}: {
  visible: boolean;
  countryCode: string;
  countryName: string;
  plans: TravelPlan[];
  initialTripId?: string;
  initialCoordinate?: Coordinate;
  onClose: () => void;
  onPlaceOnMap: (tripId?: string) => void;
  onSave: (value: Coordinate & { tripId?: string; label: string }) => void;
  supportedOrientations?: ModalProps['supportedOrientations'];
}) {
  const { spacing } = useResponsive();
  const [tripId, setTripId] = useState('');
  const [query, setQuery] = useState('');
  const [label, setLabel] = useState('');
  const [coordinate, setCoordinate] = useState<Coordinate>();
  const [results, setResults] = useState<AddressSuggestion[]>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setTripId(
      initialTripId && plans.some((plan) => plan.id === initialTripId)
        ? initialTripId
        : '',
    );
    if (initialCoordinate) {
      setCoordinate(initialCoordinate);
      setLabel(initialCoordinate.label ?? '');
    }
  }, [initialCoordinate, initialTripId, plans, visible]);

  const search = async () => {
    if (query.trim().length < 3) return;
    setSearching(true);
    const next = await searchAddressesInCountry(query, countryName, countryCode);
    setResults(next.filter((item) => item.countryCode == null || item.countryCode === countryCode));
    setSearching(false);
  };

  const canSave = Boolean(
    label.trim() && coordinate && Number.isFinite(coordinate.latitude) && Number.isFinite(coordinate.longitude),
  );

  return (
    <TravelSheetModal
      visible={visible}
      eyebrow={countryName}
      title="Pin a Place"
      subtitle="Save a place on its own or link it to a trip."
      onClose={onClose}
      closeAccessibilityLabel="Close pin a place"
      closeTestID={AgentUiIds.travel.map.pinClose}
      supportedOrientations={supportedOrientations}
      contentContainerStyle={{ gap: spacing.md }}
      footer={
        <GlassPrimaryAction
          label="Save Pin"
          icon="map-pin"
          disabled={!canSave}
          testID={AgentUiIds.travel.map.pinSave}
          onPress={() => {
            if (!coordinate || !canSave) return;
            onSave({
              ...coordinate,
              ...(tripId ? { tripId } : {}),
              label: label.trim(),
            });
          }}
        />
      }>
      <Dropdown
        label="Trip (Optional)"
        value={tripId}
        options={[
          {
            value: '',
            label: 'No trip',
            testID: AgentUiIds.travel.map.pinTripNone,
          },
          ...plans.map((plan) => ({ value: plan.id, label: plan.title })),
        ]}
        onChange={setTripId}
        icon="suitcase"
        testID={AgentUiIds.travel.map.pinTrip}
        supportedOrientations={supportedOrientations}
      />

      <View style={[styles.searchRow, { gap: spacing.sm }]}>
        <Input
          value={query}
          onChangeText={setQuery}
          onSubmitEditing={() => void search()}
          placeholder={`Search ${countryName}`}
          icon="search"
          testID={AgentUiIds.travel.map.pinSearch}
          containerStyle={styles.searchInput}
          returnKeyType="search"
        />
        <Button size="sm" variant="secondary" loading={searching} onPress={() => void search()}>
          Search
        </Button>
      </View>

      {results.map((result, index) => (
        <SearchResult
          key={result.id}
          result={result}
          index={index}
          onPress={() => {
            if (result.latitude == null || result.longitude == null) return;
            setCoordinate({ latitude: result.latitude, longitude: result.longitude });
            setLabel(result.label);
          }}
        />
      ))}

      <View style={{ gap: spacing.sm }}>
        <Input
          stackedLabel="Place Name"
          value={label}
          onChangeText={setLabel}
          placeholder="Name this place"
          icon="map-pin"
          testID={AgentUiIds.travel.map.pinLabel}
        />
        <Button
          variant="secondary"
          icon="map-pin"
          testID={AgentUiIds.travel.map.pinOnMap}
          onPress={() => onPlaceOnMap(tripId || undefined)}>
          Choose on Map
        </Button>
        <AppText variant="caption" color="secondary">
          Search works online. Choosing on the map and naming the place works offline.
        </AppText>
      </View>
    </TravelSheetModal>
  );
}

function SearchResult({
  result,
  index,
  onPress,
}: {
  result: AddressSuggestion;
  index: number;
  onPress: () => void;
}) {
  const agent = useAgentUiTarget(AgentUiIds.travel.map.pinSearchResult(index), {
    label: result.label,
    onPress,
  });
  return (
    <Pressable
      ref={agent.ref}
      testID={agent.testID}
      onLayout={agent.onLayout}
      accessibilityRole="button"
      accessibilityLabel={result.label}
      onPress={onPress}>
      <GlassPlate airy style={styles.result}>
        <View style={styles.resultCopy}>
          <AppText variant="callout" numberOfLines={1}>{result.label}</AppText>
          {result.secondary ? <AppText variant="caption" color="secondary" numberOfLines={1}>{result.secondary}</AppText> : null}
        </View>
        <AppText variant="caption" color="accent">Choose</AppText>
      </GlassPlate>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  searchRow: { flexDirection: 'row', alignItems: 'center' },
  searchInput: { flex: 1 },
  result: { minHeight: 54, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, gap: 10 },
  resultCopy: { flex: 1, minWidth: 0 },
});
