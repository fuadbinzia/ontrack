import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View, type ModalProps } from 'react-native';

import { AppText, GlassPlate, Input } from '@/components/primitives';
import { TravelSheetModal } from '@/features/travel/travel-sheet';
import { useResponsive } from '@/hooks/use-responsive';
import { AgentUiIds, useAgentUiTarget } from '@/utils/agent-ui';

import { ATLAS_COUNTRIES } from './country-data';

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

  return (
    <TravelSheetModal
      visible={visible}
      title="Find a Country"
      subtitle="Every country stays reachable, including small islands."
      onClose={onClose}
      closeAccessibilityLabel="Close country picker"
      supportedOrientations={supportedOrientations}
      contentContainerStyle={{ gap: spacing.sm }}>
      <Input
        value={query}
        onChangeText={setQuery}
        placeholder="Search countries"
        icon="search"
        testID={AgentUiIds.travel.map.countryPicker}
        autoCorrect={false}
      />
      <View style={{ gap: spacing.xs }}>
        {countries.map((country) => (
          <CountryRow
            key={country.code}
            code={country.code}
            name={country.name}
            onPress={() => {
              onSelect(country.code);
              onClose();
            }}
          />
        ))}
      </View>
    </TravelSheetModal>
  );
}

function CountryRow({ code, name, onPress }: { code: string; name: string; onPress: () => void }) {
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
}

const styles = StyleSheet.create({
  row: { minHeight: 48, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, gap: 12 },
  name: { flex: 1 },
});
