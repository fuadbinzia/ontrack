import { FlashList, type ListRenderItem } from '@shopify/flash-list';
import { memo, useCallback, useMemo, useState } from 'react';
import { Pressable, StyleSheet, View, type ModalProps } from 'react-native';

import { AppText, GlassPlate, Input } from '@/components/primitives';
import { TravelSheetModal } from '@/features/travel/travel-sheet';
import { useResponsive } from '@/hooks/use-responsive';
import { AgentUiIds, useAgentUiTarget } from '@/utils/agent-ui';

import { ATLAS_COUNTRIES } from './country-data';

type CountryOption = (typeof ATLAS_COUNTRIES)[number];

export function TravelMapCountryPicker({
  visible,
  onClose,
  onSelect,
  supportedOrientations,
}: {
  visible: boolean;
  onClose: () => void;
  onSelect: (countryCode: string) => void;
  supportedOrientations?: ModalProps['supportedOrientations'];
}) {
  const { spacing } = useResponsive();
  const [query, setQuery] = useState('');
  const countries = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return ATLAS_COUNTRIES.filter(
      (country) => !needle || country.name.toLowerCase().includes(needle) || country.code.toLowerCase() === needle,
    ).slice(0, 80);
  }, [query]);
  const contentStyle = useMemo(() => ({ gap: spacing.sm }), [spacing.sm]);
  const separatorStyle = useMemo(() => ({ height: spacing.xs }), [spacing.xs]);
  const renderSeparator = useCallback(
    () => <View style={separatorStyle} />,
    [separatorStyle],
  );
  const selectCountry = useCallback(
    (countryCode: string) => {
      onSelect(countryCode);
      onClose();
    },
    [onClose, onSelect],
  );
  const renderCountry = useCallback<ListRenderItem<CountryOption>>(
    ({ item }) => (
      <CountryRow
        code={item.code}
        name={item.name}
        onSelect={selectCountry}
      />
    ),
    [selectCountry],
  );

  return (
    <TravelSheetModal
      visible={visible}
      title="Find a Country"
      subtitle="Every country stays reachable, including small islands."
      onClose={onClose}
      closeAccessibilityLabel="Close country picker"
      supportedOrientations={supportedOrientations}
      bodyScrollMode="external"
      contentContainerStyle={contentStyle}>
      <Input
        value={query}
        onChangeText={setQuery}
        placeholder="Search countries"
        icon="search"
        testID={AgentUiIds.travel.map.countryPicker}
        autoCorrect={false}
      />
      <FlashList
        data={countries}
        keyExtractor={countryKey}
        renderItem={renderCountry}
        ItemSeparatorComponent={renderSeparator}
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        style={styles.list}
      />
    </TravelSheetModal>
  );
}

function countryKey(country: CountryOption) {
  return country.code;
}

const CountryRow = memo(function CountryRow({
  code,
  name,
  onSelect,
}: {
  code: string;
  name: string;
  onSelect: (countryCode: string) => void;
}) {
  const onPress = useCallback(() => onSelect(code), [code, onSelect]);
  const agent = useAgentUiTarget(AgentUiIds.travel.map.countryOption(code), {
    label: name,
    onPress,
  });
  return (
    <Pressable
      ref={agent.ref}
      testID={agent.testID}
      onLayout={agent.onLayout}
      accessibilityRole="button"
      accessibilityLabel={name}
      onPress={onPress}>
      <GlassPlate airy style={styles.row}>
        <AppText variant="callout" style={styles.name} numberOfLines={1}>{name}</AppText>
        <AppText variant="caption" color="secondary">{code}</AppText>
      </GlassPlate>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  row: { minHeight: 48, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, gap: 12 },
  list: { flex: 1 },
  name: { flex: 1 },
});
