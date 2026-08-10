import { useEffect, useState } from 'react';
import {
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  AppText,
  Button,
  Card,
  IconButton,
  Input,
  SectionHeader,
} from '@/components/primitives';
import type { Vehicle, VehiclePart } from '@/features/vehicles/types';
import { vehicleFitmentLabel } from '@/features/vehicles/types';
import { useDockedKeyboardInset } from '@/hooks/use-docked-keyboard-inset';
import { useResponsive } from '@/hooks/use-responsive';
import { useTheme } from '@/hooks/use-theme';
import {
  searchVehicleParts,
  type PartsSearchItem,
} from '@/services/vehicles';
import { newUuid } from '@/utils/id';
import { openHttpsUrl } from '@/utils/safe-url';

export function VehiclePartsSearchSheet({
  vehicle,
  visible,
  onClose,
  onSavePart,
}: {
  vehicle: Vehicle;
  visible: boolean;
  onClose: () => void;
  onSavePart: (part: VehiclePart) => void;
}) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { spacing: gap } = useResponsive();
  const { keyboardInset } = useDockedKeyboardInset({
    enabled: visible,
    androidMode: 'modal',
  });
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<PartsSearchItem[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const fitment = vehicleFitmentLabel(vehicle);

  useEffect(() => {
    if (!visible) return;
    const controller = new AbortController();
    setBusy(true);
    setError(undefined);
    void searchVehicleParts(
      {
        year: vehicle.year,
        make: vehicle.make,
        model: vehicle.model,
        trim: vehicle.trim,
        engine: vehicle.engine,
        query: query.trim() || undefined,
      },
      controller.signal,
    )
      .then(setResults)
      .catch((caught) => {
        if (caught instanceof Error && caught.name === 'AbortError') return;
        setError(caught instanceof Error ? caught.message : 'Parts search failed.');
        setResults([]);
      })
      .finally(() => setBusy(false));
    return () => controller.abort();
  }, [
    visible,
    query,
    vehicle.year,
    vehicle.make,
    vehicle.model,
    vehicle.trim,
    vehicle.engine,
  ]);

  const save = (item: PartsSearchItem) => {
    const now = new Date().toISOString();
    onSavePart({
      id: newUuid(),
      name: item.name,
      category: item.category,
      vendorUrl: item.url,
      status: 'needed',
      fitmentLabel: item.fitmentLabel || fitment || undefined,
      notes: `${item.vendor} fitment search`,
      createdAt: now,
      updatedAt: now,
    });
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View
        style={[
          styles.fill,
          {
            backgroundColor: theme.backgroundPrimary,
            paddingTop: insets.top + gap.sm,
            paddingBottom: insets.bottom + gap.md + keyboardInset,
            paddingHorizontal: gap.lg,
          },
        ]}>
        <View style={[styles.header, { marginBottom: gap.md }]}>
          <View style={{ flex: 1, minWidth: 0, gap: gap.xs }}>
            <AppText variant="title" fit numberOfLines={1}>
              Fitment parts
            </AppText>
            <AppText variant="caption" color="secondary" numberOfLines={2}>
              {fitment || 'Add year/make/model for better links'}
            </AppText>
          </View>
          <IconButton icon="close" accessibilityLabel="Close" onPress={onClose} />
        </View>

        <ScrollView
          style={{ flex: 1 }}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
          contentContainerStyle={{ gap: gap.md, paddingBottom: gap.xl }}>
          <Input
            label="Search"
            value={query}
            onChangeText={setQuery}
            placeholder="Brake pads, oil filter…"
          />
          <SectionHeader title={busy ? 'Searching…' : 'Retailer links'} />
          {error ? (
            <AppText variant="caption" color="danger">
              {error}
            </AppText>
          ) : null}
          {results.map((item) => (
            <Card key={item.id}>
              <AppText variant="heading" fit numberOfLines={1}>
                {item.name}
              </AppText>
              <AppText variant="caption" color="secondary" fit numberOfLines={1}>
                {item.vendor} · {item.fitmentLabel}
              </AppText>
              <View style={{ flexDirection: 'row', gap: gap.sm, marginTop: gap.sm }}>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Button
                    variant="secondary"
                    onPress={() => void openHttpsUrl(item.url)}
                    accessibilityLabel={`Open ${item.vendor}`}>
                    Open
                  </Button>
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Button
                    onPress={() => save(item)}
                    accessibilityLabel={`Save ${item.name}`}>
                    Save
                  </Button>
                </View>
              </View>
            </Card>
          ))}
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
});
