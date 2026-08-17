import { useState } from 'react';
import { View } from 'react-native';

import { appPrompt, AppText, Button, Card, Input, SectionHeader } from '@/components/primitives';
import { ChipRow } from '@/components/shared';
import type { Vehicle, VehiclePart, VehiclePartStatus } from '@/features/vehicles/types';
import { VEHICLE_PART_STATUSES, vehicleFitmentLabel } from '@/features/vehicles/types';
import { useResponsive } from '@/hooks/use-responsive';
import { confirmDestructiveAction } from '@/utils/confirm-destructive';
import { newUuid } from '@/utils/id';
import { asPositiveNumber } from '@/utils/parse';
import { openHttpsUrl, safeHttpsUrl } from '@/utils/safe-url';

const STATUS_LABELS: Record<VehiclePartStatus, string> = {
  needed: 'Needed',
  ordered: 'Ordered',
  installed: 'Installed',
};

export function VehiclePartsPanel({
  vehicle,
  onChange,
  onOpenSearch,
}: {
  vehicle: Vehicle;
  onChange: (next: Vehicle, summary: string, entityId?: string) => void;
  onOpenSearch: () => void;
}) {
  const { spacing: gap } = useResponsive();
  const fitment = vehicleFitmentLabel(vehicle);
  const [name, setName] = useState('');
  const [partNumber, setPartNumber] = useState('');
  const [category, setCategory] = useState('');
  const [vendorUrl, setVendorUrl] = useState('');
  const [status, setStatus] = useState<VehiclePartStatus>('needed');
  const [price, setPrice] = useState('');

  const addPart = () => {
    const title = name.trim();
    if (!title) return;
    const safeVendorUrl = safeHttpsUrl(vendorUrl);
    if (vendorUrl.trim() && !safeVendorUrl) {
      appPrompt.alert('Use a Secure Link', 'Vendor links need to start with https://.');
      return;
    }
    const now = new Date().toISOString();
    const part: VehiclePart = {
      id: newUuid(),
      name: title,
      partNumber: partNumber.trim() || undefined,
      category: category.trim() || undefined,
      vendorUrl: safeVendorUrl,
      status,
      price: asPositiveNumber(Number(price)),
      currency: vehicle.baseCurrency,
      fitmentLabel: fitment || undefined,
      createdAt: now,
      updatedAt: now,
    };
    onChange(
      {
        ...vehicle,
        parts: [part, ...vehicle.parts],
        updatedAt: now,
      },
      `Added part “${title}”`,
      part.id,
    );
    setName('');
    setPartNumber('');
    setCategory('');
    setVendorUrl('');
    setPrice('');
  };

  const cycleStatus = (part: VehiclePart) => {
    const order: VehiclePartStatus[] = ['needed', 'ordered', 'installed'];
    const nextStatus = order[(order.indexOf(part.status) + 1) % order.length]!;
    const now = new Date().toISOString();
    onChange(
      {
        ...vehicle,
        parts: vehicle.parts.map((item) =>
          item.id === part.id ? { ...item, status: nextStatus, updatedAt: now } : item,
        ),
        updatedAt: now,
      },
      `Marked “${part.name}” as ${STATUS_LABELS[nextStatus].toLowerCase()}`,
      part.id,
    );
  };

  const removePart = (part: VehiclePart) => {
    confirmDestructiveAction({
      title: 'Remove part?',
      message: `Remove “${part.name}” from this vehicle?`,
      actionLabel: 'Remove',
      onConfirm: () => {
        onChange(
          {
            ...vehicle,
            parts: vehicle.parts.filter((item) => item.id !== part.id),
            updatedAt: new Date().toISOString(),
          },
          `Removed part “${part.name}”`,
          part.id,
        );
      },
    });
  };

  return (
    <View style={{ gap: gap.lg }}>
      <SectionHeader title="Compatible parts" detail={fitment || undefined} />
      <AppText variant="caption" color="secondary">
        Browse retailers scoped to this vehicle’s year/make/model, then save parts here.
      </AppText>
      <Button onPress={onOpenSearch} accessibilityLabel="Search compatible parts">
        Search fitment parts
      </Button>

      {vehicle.parts.map((part) => (
        <Card key={part.id} onPress={() => cycleStatus(part)} onLongPress={() => removePart(part)}>
          <AppText variant="heading" fit numberOfLines={1}>
            {part.name}
          </AppText>
          <AppText variant="caption" color="secondary" numberOfLines={2}>
            {STATUS_LABELS[part.status]}
            {part.partNumber ? ` · #${part.partNumber}` : ''}
            {part.category ? ` · ${part.category}` : ''}
            {part.fitmentLabel ? ` · ${part.fitmentLabel}` : ''}
          </AppText>
          {safeHttpsUrl(part.vendorUrl) ? (
            <Button
              variant="ghost"
              onPress={() => void openHttpsUrl(part.vendorUrl)}
              accessibilityLabel={`Open ${part.name} vendor link`}>
              Open vendor
            </Button>
          ) : null}
        </Card>
      ))}

      <Input label="Part name" value={name} onChangeText={setName} placeholder="Oil filter" />
      <Input label="Part number" value={partNumber} onChangeText={setPartNumber} />
      <Input label="Category" value={category} onChangeText={setCategory} placeholder="Filters" />
      <Input label="Vendor URL" value={vendorUrl} onChangeText={setVendorUrl} autoCapitalize="none" />
      <Input label="Price" value={price} onChangeText={setPrice} keyboardType="decimal-pad" />
      <ChipRow
        options={VEHICLE_PART_STATUSES.map((value) => ({
          value,
          label: STATUS_LABELS[value],
        }))}
        selected={status}
        onSelect={setStatus}
      />
      <Button onPress={addPart} accessibilityLabel="Add part to vehicle">
        Save part
      </Button>
    </View>
  );
}
