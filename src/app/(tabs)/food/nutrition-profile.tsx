import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import {
  ActionChip,
  AppText,
  Button,
  DateField,
  ErrorMessage,
  Input,
  ScreenHeader,
  SectionHeader,
} from '@/components/primitives';
import { featureFlags } from '@/constants/feature-flags';
import { spacing } from '@/design-system';
import { FoodHeaderBackButton } from '@/features/food/food-header-back-button';
import { FoodScreen } from '@/features/food/food-screen';
import { useNutrition } from '@/store/nutrition';
import type { ActivityLevel, EquationSex, NutritionGoal, NutritionProfile, NutritionTargets } from '@/types/models';
import { AgentUiIds } from '@/utils/agent-ui';
import { todayKey } from '@/utils/date';
import { newId } from '@/utils/id';
import { ageInYears, calculateNutritionTargets, createTargetVersion, NutritionTargetError } from '@/utils/nutrition';
import { parsePositiveNumber } from '@/utils/parse';

const ACTIVITIES: ActivityLevel[] = ['inactive', 'low-active', 'active', 'very-active'];
const GOALS: NutritionGoal[] = ['maintain', 'lose', 'gain'];

export default function NutritionProfileScreen() {
  const profiles = useNutrition((state) => state.profiles);
  const activeProfileId = useNutrition((state) => state.activeProfileId);
  const setActiveProfile = useNutrition((state) => state.setActiveProfile);
  const upsertProfile = useNutrition((state) => state.upsertProfile);
  const saveTargetVersion = useNutrition((state) => state.saveTargetVersion);
  const versions = useNutrition((state) => state.targetVersions);
  const active = profiles.find((profile) => profile.id === activeProfileId);

  const [displayName, setDisplayName] = useState(active?.displayName ?? 'Me');
  const [dateOfBirth, setDateOfBirth] = useState(active?.dateOfBirth ?? '1990-01-01');
  const [equationSex, setEquationSex] = useState<EquationSex>(active?.equationSex ?? 'female');
  const [heightCm, setHeightCm] = useState(String(active?.heightCm ?? ''));
  const [weightKg, setWeightKg] = useState(String(active?.weightKg ?? ''));
  const [activityLevel, setActivityLevel] = useState<ActivityLevel>(active?.activityLevel ?? 'low-active');
  const [goal, setGoal] = useState<NutritionGoal>(active?.goal ?? 'maintain');
  const [allergies, setAllergies] = useState(active?.allergies?.join(', ') ?? '');
  const [preferences, setPreferences] = useState(active?.dietaryPreferences?.join(', ') ?? '');
  const [guardianAcknowledged, setGuardianAcknowledged] = useState(Boolean(active?.guardianAcknowledgedAt));
  const [targets, setTargets] = useState<NutritionTargets>();
  const [error, setError] = useState<string>();
  const [notice, setNotice] = useState<string>();

  const age = useMemo(() => ageInYears(dateOfBirth), [dateOfBirth]);
  const latest = versions.filter((item) => item.profileId === activeProfileId).sort((a, b) => b.version - a.version)[0];

  const selectProfile = (profile: NutritionProfile) => {
    setActiveProfile(profile.id);
    setDisplayName(profile.displayName);
    setDateOfBirth(profile.dateOfBirth);
    setEquationSex(profile.equationSex);
    setHeightCm(String(profile.heightCm ?? ''));
    setWeightKg(String(profile.weightKg ?? ''));
    setActivityLevel(profile.activityLevel);
    setGoal(profile.goal);
    setAllergies(profile.allergies.join(', '));
    setPreferences(profile.dietaryPreferences.join(', '));
    setGuardianAcknowledged(Boolean(profile.guardianAcknowledgedAt));
    setTargets(undefined);
    setError(undefined);
    setNotice(undefined);
  };

  const profileFromForm = (): NutritionProfile => ({
    id: active?.id ?? newId('profile'),
    displayName: displayName.trim() || 'Profile',
    dateOfBirth,
    equationSex,
    heightCm: parsePositiveNumber(heightCm),
    weightKg: parsePositiveNumber(weightKg),
    activityLevel,
    goal,
    unitSystem: 'metric',
    allergies: allergies.split(',').map((value) => value.trim()).filter(Boolean),
    dietaryPreferences: preferences.split(',').map((value) => value.trim()).filter(Boolean),
    guardianAcknowledgedAt: guardianAcknowledged ? new Date().toISOString() : undefined,
  });

  const calculate = () => {
    setError(undefined);
    setNotice(undefined);
    const profile = profileFromForm();
    if (age < 18 && age >= 2 && !featureFlags.youthNutrition) return setError('Youth nutrition is disabled until its release review is complete.');
    if (age < 2 && !featureFlags.infantClinical) return setError('Infant clinical nutrition is disabled until clinician, legal, security, and BAA gates are complete.');
    try {
      upsertProfile(profile);
      setTargets(calculateNutritionTargets(profile));
    } catch (caught) {
      setError(caught instanceof NutritionTargetError ? caught.message : 'Targets could not be calculated.');
    }
  };

  const saveTargets = () => {
    if (!targets) return;
    const profile = profileFromForm();
    upsertProfile(profile);
    saveTargetVersion(createTargetVersion(profile, targets, {}, (latest?.version ?? 0) + 1));
    setError(undefined);
    setNotice(age < 2 ? 'Draft saved. A verified pediatric clinician must approve it.' : 'Targets saved.');
  };

  const addDependent = () => {
    const profile: NutritionProfile = {
      id: newId('profile'), displayName: 'Dependent', dateOfBirth: '2015-01-01',
      equationSex: 'female', activityLevel: 'low-active', goal: 'maintain', unitSystem: 'metric',
      dietaryPreferences: [], allergies: [],
    };
    upsertProfile(profile);
    selectProfile(profile);
    setNotice('Dependent created.');
  };

  return (
    <FoodScreen>
      <ScreenHeader
        eyebrow="Food"
        title="Nutrition Profiles"
        subtitle="Targets are wellness estimates. Clinical profiles remain memory-only until the approved cloud is configured."
        leading={<FoodHeaderBackButton accessibilityLabel="Back to food" />}
      />

      {profiles.length ? (
        <SectionHeader
          title="Profiles"
          actionLabel="Add Dependent"
          actionTestID={AgentUiIds.nutritionProfile.addDependent}
          onAction={addDependent}
        />
      ) : null}
      <View style={styles.profileRow}>
        {profiles.map((profile) => (
          <ActionChip
            key={profile.id}
            label={profile.displayName}
            selected={profile.id === activeProfileId}
            testID={AgentUiIds.nutritionProfile.profile(profile.id)}
            onPress={() => selectProfile(profile)}
          />
        ))}
      </View>

      <SectionHeader title="Profile Details" />
      <Input label="Name" value={displayName} onChangeText={setDisplayName} testID={AgentUiIds.nutritionProfile.name} />
      <DateField
        label="Date of Birth"
        value={dateOfBirth}
        minimumDate="1900-01-01"
        maximumDate={todayKey()}
        onChange={setDateOfBirth}
        testID={AgentUiIds.nutritionProfile.dateOfBirth}
      />
      <ChoiceRow id="equationSex" label="Sex Used by Equation" values={['female', 'male']} value={equationSex} onChange={(value) => setEquationSex(value as EquationSex)} />
      <View style={styles.twoColumns}>
        <View style={styles.flex}><Input label="Height (cm)" value={heightCm} onChangeText={setHeightCm} keyboardType="decimal-pad" testID={AgentUiIds.nutritionProfile.heightCm} /></View>
        <View style={styles.flex}><Input label="Weight (kg)" value={weightKg} onChangeText={setWeightKg} keyboardType="decimal-pad" testID={AgentUiIds.nutritionProfile.weightKg} /></View>
      </View>
      <ChoiceRow id="activity" label="Activity" values={ACTIVITIES} value={activityLevel} onChange={(value) => setActivityLevel(value as ActivityLevel)} />
      <ChoiceRow id="goal" label="Goal" values={GOALS} value={goal} onChange={(value) => setGoal(value as NutritionGoal)} />
      <Input label="Dietary Preferences" value={preferences} onChangeText={setPreferences} placeholder="vegetarian, halal" testID={AgentUiIds.nutritionProfile.preferences} />
      <Input label="Allergies" value={allergies} onChangeText={setAllergies} placeholder="peanuts, shellfish" testID={AgentUiIds.nutritionProfile.allergies} />
      {age >= 2 && age < 18 ? (
        <Button testID={AgentUiIds.nutritionProfile.guardianAcknowledgment} variant={guardianAcknowledged ? 'secondary' : 'danger'} onPress={() => setGuardianAcknowledged((value) => !value)}>
          {guardianAcknowledged ? 'Guardian Acknowledged' : 'Waiting On a Guardian'}
        </Button>
      ) : null}
      {age < 2 ? <AppText variant="caption" color="danger">Infant targets can only be activated by a verified pediatric clinician.</AppText> : null}
      <Button testID={AgentUiIds.nutritionProfile.calculate} onPress={calculate}>Calculate Starting Targets</Button>

      {targets ? (
        <>
          <SectionHeader title="Editable Targets" />
          <View style={styles.twoColumns}>
            {(['calories', 'proteinG', 'carbsG', 'fatG'] as const).map((key) => (
              <View key={key} style={styles.flex}><Input label={key} value={String(targets[key])} keyboardType="decimal-pad" testID={AgentUiIds.nutritionProfile.target(key)} onChangeText={(value) => setTargets({ ...targets, [key]: Number(value) || 0 })} /></View>
            ))}
          </View>
          <Button testID={AgentUiIds.nutritionProfile.saveTargets} onPress={saveTargets}>Save Target Version</Button>
        </>
      ) : null}
      {latest ? <AppText variant="caption" color="secondary">Latest version: v{latest.version} · {latest.status}</AppText> : null}
      {notice ? <AppText variant="callout" color="secondary">{notice}</AppText> : null}
      {error ? <ErrorMessage message={error} /> : null}
    </FoodScreen>
  );
}

function ChoiceRow({ id, label, values, value, onChange }: { id: 'equationSex' | 'activity' | 'goal'; label: string; values: readonly string[]; value: string; onChange: (value: string) => void }) {
  return <View style={styles.choiceBlock}><AppText variant="overline" color="tertiary">{label}</AppText><View style={styles.profileRow}>{values.map((item) => <ActionChip key={item} label={item.replace('-', ' ')} selected={item === value} testID={AgentUiIds.nutritionProfile.choice(id, item)} onPress={() => onChange(item)} />)}</View></View>;
}

const styles = StyleSheet.create({
  profileRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  twoColumns: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  flex: { flex: 1, minWidth: 140 },
  choiceBlock: { gap: spacing.sm, marginVertical: spacing.sm },
});
