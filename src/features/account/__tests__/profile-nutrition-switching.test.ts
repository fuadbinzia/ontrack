import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('Profile nutrition form switching', () => {
  const source = readFileSync(
    join(process.cwd(), 'src/app/(tabs)/profile/nutrition-profile.tsx'),
    'utf8',
  );

  it('hydrates every editable field when a profile is selected', () => {
    expect(source).toContain('const selectProfile = (profile: NutritionProfile) =>');
    expect(source).toContain('setDisplayName(profile.displayName)');
    expect(source).toContain('setDateOfBirth(profile.dateOfBirth)');
    expect(source).toContain('setHeightCm(String(profile.heightCm');
    expect(source).toContain('setWeightKg(String(profile.weightKg');
    expect(source).toContain('setAllergies(profile.allergies.join');
    expect(source).toContain('setPreferences(profile.dietaryPreferences.join');
    expect(source).toContain('onPress={() => selectProfile(profile)}');
  });

  it('opens a new dependent in-place and keeps success copy out of error UI', () => {
    expect(source).toContain('upsertProfile(profile);\n    selectProfile(profile);');
    expect(source).toContain("setNotice('Dependent created.')");
    expect(source).not.toContain('Reopen this screen');
    expect(source).toContain('{error ? <ErrorMessage message={error} /> : null}');
  });
});
