import { FlashList, type ListRenderItem } from '@shopify/flash-list';
import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, View, type ModalProps } from 'react-native';

import { AppText, EmptyState, GlassPlate, Input } from '@/components/primitives';
import { TravelSheetModal } from '@/features/travel/travel-sheet';
import { useResponsive } from '@/hooks/use-responsive';
import { AgentUiIds, useAgentUiTarget } from '@/utils/agent-ui';

import {
  searchAtlasCities,
  type TravelMapCity,
} from './city-data';

export function TravelMapCityPicker({
  visible,
  countryCode,
  countryName,
  onClose,
  onSelect,
  supportedOrientations,
}: {
  visible: boolean;
  countryCode: string;
  countryName: string;
  onClose: () => void;
  onSelect: (city: TravelMapCity) => void;
  supportedOrientations?: ModalProps['supportedOrientations'];
}) {
  const { spacing } = useResponsive();
  const [query, setQuery] = useState('');
  const cities = useMemo(
    () => searchAtlasCities(countryCode, query),
    [countryCode, query],
  );
  const contentStyle = useMemo(() => ({ gap: spacing.sm }), [spacing.sm]);
  const separatorStyle = useMemo(() => ({ height: spacing.xs }), [spacing.xs]);
  const emptyState = useMemo(
    () => (
      <EmptyState
        icon="search"
        title="No city found"
        message={`Try another city name in ${countryName}.`}
      />
    ),
    [countryName],
  );
  const renderSeparator = useCallback(
    () => <View style={separatorStyle} />,
    [separatorStyle],
  );

  useEffect(() => {
    if (visible) setQuery('');
  }, [visible]);

  const selectCity = useCallback(
    (city: TravelMapCity) => {
      onSelect(city);
      onClose();
    },
    [onClose, onSelect],
  );
  const renderCity = useCallback<ListRenderItem<TravelMapCity>>(
    ({ item, index }) => (
      <CityRow city={item} index={index} onSelect={selectCity} />
    ),
    [selectCity],
  );

  return (
    <TravelSheetModal
      visible={visible}
      eyebrow={countryName}
      title="Find a City"
      subtitle="Search prominent cities offline and highlight one on the map."
      onClose={onClose}
      closeAccessibilityLabel="Close city search"
      supportedOrientations={supportedOrientations}
      bodyScrollMode="external"
      contentContainerStyle={contentStyle}>
      <Input
        value={query}
        onChangeText={setQuery}
        placeholder={`Search cities in ${countryName}`}
        icon="search"
        testID={AgentUiIds.travel.map.citySearchInput}
        autoCorrect={false}
        autoCapitalize="words"
      />
      <FlashList
        data={cities}
        keyExtractor={cityKey}
        renderItem={renderCity}
        ItemSeparatorComponent={renderSeparator}
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={emptyState}
        style={styles.list}
      />
    </TravelSheetModal>
  );
}

function cityKey(city: TravelMapCity) {
  return `${city.countryCode}:${city.name}`;
}

const CityRow = memo(function CityRow({
  city,
  index,
  onSelect,
}: {
  city: TravelMapCity;
  index: number;
  onSelect: (city: TravelMapCity) => void;
}) {
  const onPress = useCallback(() => onSelect(city), [city, onSelect]);
  const agent = useAgentUiTarget(AgentUiIds.travel.map.citySearchResult(index), {
    label: `Choose ${city.name}`,
    onPress,
  });
  return (
    <Pressable
      ref={agent.ref}
      testID={agent.testID}
      onLayout={agent.onLayout}
      accessibilityRole="button"
      accessibilityLabel={`Choose ${city.name}`}
      onPress={onPress}>
      <GlassPlate airy style={styles.row}>
        <View style={styles.cityCopy}>
          <AppText variant="callout" fit numberOfLines={1}>
            {city.name}
          </AppText>
          <AppText variant="caption" color="secondary" numberOfLines={1}>
            {city.capital ? 'Capital city' : 'City'}
          </AppText>
        </View>
        <AppText variant="caption" color="accent" fit>
          Choose
        </AppText>
      </GlassPlate>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  list: { flex: 1 },
  row: {
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    gap: 12,
  },
  cityCopy: { flex: 1, minWidth: 0 },
});
