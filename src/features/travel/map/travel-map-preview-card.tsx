import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText, Button, GlassPlate, Symbol } from '@/components/primitives';
import { fetchPlaceCoverUri } from '@/features/travel/destination-cover-fetch';
import { useResponsive } from '@/hooks/use-responsive';
import { AgentTestId, AgentUiIds } from '@/utils/agent-ui';

import type { TravelMapPlaceSelection } from './travel-map-canvas';

type Props = {
  selection: TravelMapPlaceSelection;
  onOpenTrip?: () => void;
  onUnpin?: () => void;
  onClose: () => void;
  landscape?: boolean;
};

function dateRange(startDate: string, endDate: string): string {
  if (!startDate && !endDate) return 'Dates not set';
  if (!endDate || startDate === endDate) return startDate;
  return `${startDate} – ${endDate}`;
}

export function TravelMapPreviewCard({
  selection,
  onOpenTrip,
  onUnpin,
  onClose,
  landscape,
}: Props) {
  const { spacing, s } = useResponsive();
  const [coverUri, setCoverUri] = useState<string>();
  const { tripSummary } = selection.rendered.visit;
  const previewTitle = tripSummary?.title ?? selection.pin.label;

  useEffect(() => {
    let active = true;
    setCoverUri(undefined);
    void fetchPlaceCoverUri([
      `${selection.pin.label}, ${selection.rendered.visit.countryName}`,
      ...(tripSummary?.destination ? [tripSummary.destination] : []),
    ]).then((uri) => {
      if (active) setCoverUri(uri);
    });
    return () => {
      active = false;
    };
  }, [selection.pin.label, selection.rendered.visit.countryName, tripSummary?.destination]);

  return (
    <AgentTestId
      testID={AgentUiIds.travel.map.preview}
      label={tripSummary ? `${previewTitle} trip preview` : `${previewTitle} pin preview`}
      style={styles.fill}>
      <GlassPlate
        intensity={74}
        style={[
          styles.card,
          landscape ? styles.landscapeCard : styles.portraitCard,
          { gap: spacing.md, padding: spacing.md },
        ]}>
        <View style={[styles.art, { height: landscape ? s(150) : s(112) }]}>
          {coverUri ? (
            <Image source={coverUri} style={StyleSheet.absoluteFill} contentFit="cover" />
          ) : (
            <View style={styles.artFallback}>
              <Symbol name="map-pin" size={32} color="#FFFFFF" />
            </View>
          )}
          <View style={styles.artWash} />
          <AppText variant="caption" style={styles.ownerLabel} numberOfLines={1}>
            {selection.rendered.person.displayName}
          </AppText>
        </View>

        <View style={{ gap: spacing.xs }}>
          <AppText variant="heading" numberOfLines={2}>
            {previewTitle}
          </AppText>
          <AppText variant="callout" color="secondary" numberOfLines={1}>
            {tripSummary
              ? `${selection.pin.label} · ${selection.rendered.visit.countryName}`
              : selection.rendered.visit.countryName}
          </AppText>
          {tripSummary ? (
            <AppText variant="caption" color="secondary" numberOfLines={1}>
              {dateRange(tripSummary.startDate, tripSummary.endDate)}
            </AppText>
          ) : null}
        </View>

        <View style={[styles.actions, { gap: spacing.sm }]}>
          {onUnpin ? (
            <Button
              variant="danger"
              size="sm"
              onPress={onUnpin}
              style={styles.action}
              testID={AgentUiIds.travel.map.previewUnpin}>
              Unpin
            </Button>
          ) : null}
          <Button
            variant="secondary"
            size="sm"
            onPress={onClose}
            style={styles.action}
            testID={AgentUiIds.travel.map.previewClose}>
            Close
          </Button>
          {onOpenTrip ? (
            <Button
              size="sm"
              onPress={onOpenTrip}
              style={styles.action}
              testID={AgentUiIds.travel.map.previewOpenTrip}>
              Open Trip
            </Button>
          ) : null}
        </View>
      </GlassPlate>
    </AgentTestId>
  );
}

const styles = StyleSheet.create({
  fill: { width: '100%' },
  card: { overflow: 'hidden' },
  portraitCard: { borderRadius: 28 },
  landscapeCard: { flex: 1, borderRadius: 26 },
  art: { borderRadius: 18, overflow: 'hidden', backgroundColor: '#267DAC' },
  artFallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#297FAE',
  },
  artWash: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: 'rgba(6,45,72,0.18)',
  },
  ownerLabel: {
    position: 'absolute',
    left: 12,
    bottom: 10,
    color: '#FFFFFF',
    backgroundColor: 'rgba(4,34,56,0.52)',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 99,
    overflow: 'hidden',
  },
  actions: { flexDirection: 'row' },
  action: { flex: 1 },
});
