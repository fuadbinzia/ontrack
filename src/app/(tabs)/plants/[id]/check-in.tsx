import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { AppText, Button, Card, ErrorMessage, Screen, SectionHeader } from '@/components/primitives';
import { radii, spacing } from '@/design-system';
import type { PlantCheckInResponse } from '@/services/plants';
import { analyzePlantCheckIn, persistPlantPhoto, PlantServiceError } from '@/services/plants';
import { applyPlantCarePlan } from '@/services/plants/schedule';
import { usePlants } from '@/store/plants';
import { newId } from '@/store/schedule';
import type { PlantCheckIn } from '@/types/models';
import { formatCount } from '@/utils/grammar';
import { pickCameraImage, pickLibraryImage } from '@/utils/pick-image';

export default function PlantCheckInScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const plant = usePlants((state) => state.plants.find((item) => item.id === id));
  const addCheckIn = usePlants((state) => state.addCheckIn);
  const acceptCheckInPlan = usePlants((state) => state.acceptCheckInPlan);
  const [photo, setPhoto] = useState<string>();
  const [result, setResult] = useState<PlantCheckInResponse>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const saveInFlightRef = useRef(false);

  if (!plant) return <Screen refresh={false}><AppText variant="title">Plant Not Found</AppText></Screen>;

  const camera = async () => {
    const uri = await pickCameraImage({
      cameraDeniedMessage:
        'Allow camera access in Settings to take a health check-in.',
    });
    if (uri) {
      setPhoto(uri);
      setResult(undefined);
    }
  };

  const library = async () => {
    const uri = await pickLibraryImage();
    if (uri) {
      setPhoto(uri);
      setResult(undefined);
    }
  };

  const analyze = async () => {
    if (!photo) return;
    setBusy(true); setError(undefined);
    try {
      setResult(await analyzePlantCheckIn({
        photoUri: photo, identity: plant.identity, previousHealth: plant.health,
        currentCarePlan: plant.carePlan, room: plant.room,
      }));
    } catch (caught) {
      setError(caught instanceof PlantServiceError ? caught.message : 'The check-in could not be analyzed.');
    } finally { setBusy(false); }
  };

  const save = async (acceptPlan: boolean) => {
    if (!photo || !result || busy || saveInFlightRef.current) return;
    saveInFlightRef.current = true;
    setBusy(true);
    try {
      const checkInId = newId('checkin');
      const photoUri = await persistPlantPhoto(photo, plant.id, checkInId);
      const checkIn: PlantCheckIn = {
        id: checkInId, photoUri, createdAt: new Date().toISOString(),
        assessment: result.health, proposedCarePlan: result.proposedCarePlan,
      };
      addCheckIn(plant.id, checkIn);
      if (acceptPlan && result.proposedCarePlan) {
        acceptCheckInPlan(plant.id, checkIn.id, result.proposedCarePlan);
        await applyPlantCarePlan(plant.id, result.proposedCarePlan);
      }
      router.back();
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'The check-in could not be saved.'); }
    finally {
      saveInFlightRef.current = false;
      setBusy(false);
    }
  };

  return (
    <Screen contentStyle={styles.content} refresh={false}>
      <AppText variant="title">Check In on {plant.nickname}</AppText>
      <AppText color="secondary">Use similar lighting and framing when possible. The assessment compares only visible changes.</AppText>
      {photo ? <Image source={photo} style={styles.hero} contentFit="cover" /> : null}
      <View style={styles.row}><View style={styles.flex}><Button onPress={() => void camera()} icon="camera" disabled={busy}>Camera</Button></View><View style={styles.flex}><Button variant="secondary" onPress={() => void library()} icon="photo" disabled={busy}>Library</Button></View></View>
      <Button onPress={() => void analyze()} disabled={!photo || busy}>{busy ? 'Analyzing…' : 'Analyze Check-In'}</Button>
      {result ? (
        <>
          <SectionHeader title="Assessment" />
          <Card style={styles.card}><AppText variant="heading">{result.health.summary}</AppText>{result.health.visibleSigns.map((item) => <AppText key={item} color="secondary">Observed: {item}</AppText>)}{result.health.actions.map((item) => <AppText key={item}>• {item}</AppText>)}</Card>
          {result.proposedCarePlan ? (
            <Card style={styles.card}>
              <AppText variant="heading">Care-plan update suggested</AppText>
              <AppText color="secondary">Check every {formatCount(result.proposedCarePlan.watering.intervalDays, 'day')}, starting with {result.proposedCarePlan.watering.minMl}–{result.proposedCarePlan.watering.maxMl} mL after the soil check.</AppText>
              <Button onPress={() => void save(true)} disabled={busy}>Save and Update Care Plan</Button>
              <Button variant="secondary" onPress={() => void save(false)} disabled={busy}>Save check-in, keep current plan</Button>
            </Card>
          ) : <Button onPress={() => void save(false)} disabled={busy}>Save check-in</Button>}
        </>
      ) : null}
      {busy ? <ActivityIndicator /> : null}
      {error ? <ErrorMessage message={error} selectable /> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({ content: { gap: spacing.md }, hero: { width: '100%', aspectRatio: 4 / 3, borderRadius: radii.lg }, row: { flexDirection: 'row', gap: spacing.md }, flex: { flex: 1 }, card: { gap: spacing.sm } });
