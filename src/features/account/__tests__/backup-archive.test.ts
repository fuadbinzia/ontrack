import mockAsyncStorage from '@react-native-async-storage/async-storage/jest/async-storage-mock';

import { ALL_ACCOUNTS_TEST_TRIP } from '@/constants/travel';
import { FOOD_FIXTURE_RECIPE_IDS, buildFoodFixtureRecipes } from '@/features/food/fixtures';
import { SAMPLE_PLANT_ID } from '@/features/plants/sample';
import { PRIVACY_POLICY_INTRO } from '../privacy-policy-content';
import { useFoodProfile } from '@/store/food-profile';
import { useHealth } from '@/store/health';
import { useJournal } from '@/store/journal';
import { usePlants } from '@/store/plants';
import { usePreferences } from '@/store/preferences';
import { useRecipes } from '@/store/food-recipes';
import { useSchedule } from '@/store/schedule';
import { useTodos } from '@/store/todos';
import { useTravel } from '@/store/travel';
import { useVisionBoard } from '@/store/vision-board';

import {
  applyBackup,
  backupFileName,
  buildBackup,
  parseBackup,
  serializeBackup,
} from '../backup-archive';

jest.mock('@react-native-async-storage/async-storage', () => mockAsyncStorage);
jest.mock('expo-secure-store', () => ({
  WHEN_UNLOCKED_THIS_DEVICE_ONLY: 'WHEN_UNLOCKED_THIS_DEVICE_ONLY',
  getItemAsync: jest.fn(async () => 'test-backup-encryption-key'),
  setItemAsync: jest.fn(async () => undefined),
}));
jest.mock('@/features/journal/voice-persist', () => ({
  deleteJournalVoice: jest.fn(async () => undefined),
}));
jest.mock('@/features/account/release-notes-format', () => ({
  getAppVersion: () => '1.0.0-test',
}));

describe('user-owned backup archive', () => {
  beforeEach(() => {
    useJournal.getState().reset();
    useTodos.getState().reset();
    usePlants.getState().reset();
    useTravel.getState().reset();
    useSchedule.getState().resetAll();
    useRecipes.getState().reset();
    useHealth.getState().reset();
    useFoodProfile.getState().reset();
    useVisionBoard.getState().reset();
    usePreferences.getState().resetAll();
  });

  it('names backup files with a filesystem-safe timestamp', () => {
    expect(backupFileName(new Date('2026-08-16T18:22:05.123Z'))).toBe(
      'onTrack-backup-2026-08-16-18-22-05.json',
    );
  });

  it('round-trips journal text that cloud sync does not store', () => {
    useJournal.getState().addText('2026-08-16', 'Keep this page');
    const backup = buildBackup('2026-08-16T18:00:00.000Z');
    expect(backup.kind).toBe('ontrack.backup');
    expect(backup.local.journal?.pages[0]?.blocks).toEqual(
      expect.arrayContaining([expect.objectContaining({ kind: 'text', text: 'Keep this page' })]),
    );

    useJournal.getState().reset();
    expect(useJournal.getState().pages).toEqual([]);
    applyBackup(backup);
    expect(useJournal.getState().pages[0]?.blocks).toEqual(
      expect.arrayContaining([expect.objectContaining({ kind: 'text', text: 'Keep this page' })]),
    );
  });

  it('includes private checklist data and restores it onto an empty store', () => {
    const list = useTodos.getState().createList('Packing');
    useTodos.getState().addTask(list!.id, 'Passport');
    const json = serializeBackup(buildBackup());
    expect(json).toContain('Packing');
    expect(json).toContain('Passport');
    expect(json).not.toMatch(/refresh_token|access_token|ciphertext/i);

    useTodos.getState().reset();
    applyBackup(parseBackup(json));
    expect(useTodos.getState().lists.some((list) => list.name === 'Packing')).toBe(true);
    expect(useTodos.getState().tasks.some((task) => task.title === 'Passport')).toBe(true);
  });

  it('writes restored domains without restarting cloud pull subscriptions', () => {
    const source = require('node:fs').readFileSync(
      require('node:path').join(process.cwd(), 'src/features/account/backup-archive.ts'),
      'utf8',
    );
    expect(source).toContain('domain.write(payload)');
    expect(source).toContain('prepareBackupForRestore');
    expect(source).not.toContain('restoreSyncedDomains');
    expect(source).not.toContain('startSubscriptions');
  });

  it('rejects files that are not onTrack backups', () => {
    expect(() => parseBackup('{')).toThrow('This file is not a readable onTrack backup.');
    expect(() => parseBackup(JSON.stringify({ kind: 'notes', version: 1 }))).toThrow(
      'This file is not an onTrack backup.',
    );
    expect(() => parseBackup(JSON.stringify({
      kind: 'ontrack.backup',
      version: 2,
      createdAt: '2026-08-16T00:00:00.000Z',
    }))).toThrow('newer onTrack');
  });

  it('does not pack privacy policy, sample content, or deleted records into a backup', () => {
    useJournal.getState().addText('2026-08-16', 'Keep this page');
    useJournal.getState().ensurePage('2026-08-15');
    useJournal.getState().addText('2026-08-14', 'Deleted note');
    useJournal.setState({
      pages: useJournal.getState().pages.map((page) =>
        page.dateKey === '2026-08-14'
          ? { ...page, deletedAt: '2026-08-14T12:00:00.000Z' }
          : page,
      ),
    });

    const list = useTodos.getState().createList('Packing');
    const passport = useTodos.getState().addTask(list!.id, 'Passport');
    useTodos.getState().toggleTask(passport!.id);
    const gone = useTodos.getState().addTask(list!.id, 'Old socks');
    useTodos.setState({
      tasks: useTodos.getState().tasks.map((task) =>
        task.id === gone!.id
          ? { ...task, deletedAt: '2026-08-16T12:00:00.000Z' }
          : task,
      ),
    });

    const sample = usePlants.getState().plants.find((plant) => plant.id === SAMPLE_PLANT_ID)!;
    usePlants.getState().addPlant({ ...sample, id: 'plant-user-basil', nickname: 'Basil' });

    useTravel.setState({
      plans: [
        ALL_ACCOUNTS_TEST_TRIP,
        {
          id: 'trip-user-lisbon',
          title: 'Lisbon',
          destination: 'Lisbon',
          startDate: '2026-09-08',
          endDate: '2026-09-14',
          itinerary: [],
          participants: [],
          baseCurrency: 'USD',
          expenses: [],
          createdAt: '2026-08-16T00:00:00.000Z',
          updatedAt: '2026-08-16T00:00:00.000Z',
        },
      ],
    });

    useSchedule.setState({
      eventSuggestions: [{
        id: 'sug-catalog',
        followId: 'follow-1',
        createdAt: '2026-08-16T00:00:00.000Z',
        event: { title: 'Catalog UFC card' },
      } as never],
      suppressedExternalEvents: ['google:deleted-event'],
      categories: [
        ...useSchedule.getState().categories,
        {
          id: 'reading',
          name: 'Reading',
          icon: 'learning',
          colorKey: 'learning',
          supportsPhotos: false,
          supportsTimer: true,
          detailKind: 'generic',
          isCustom: true,
        },
      ],
    });

    useHealth.getState().addCustomEmotion('Sparkly', 2);
    useFoodProfile.getState().setPrivacy({ shareAllergies: true });
    useRecipes.getState().replaceRecipes([
      ...buildFoodFixtureRecipes(),
      {
        id: 'recipe-user-soup',
        title: 'Lentil Soup',
        servings: 2,
        ingredients: [],
        steps: [],
        dietaryTags: [],
        allergenTags: [],
        savedAt: '2026-08-16T00:00:00.000Z',
        isFavorite: false,
      },
    ]);
    useRecipes.getState().setSeeded(true);

    const json = serializeBackup(buildBackup());
    expect(json).not.toContain(PRIVACY_POLICY_INTRO);
    expect(json).not.toContain('This Privacy Policy explains');
    expect(json).not.toContain(SAMPLE_PLANT_ID);
    expect(json).not.toContain('Catalog UFC card');
    expect(json).not.toContain('google:deleted-event');
    expect(json).not.toContain('Deleted note');
    expect(json).not.toContain('Old socks');
    expect(json).not.toContain(ALL_ACCOUNTS_TEST_TRIP.id);
    expect(json).not.toContain(FOOD_FIXTURE_RECIPE_IDS.shakshuka);
    expect(json).not.toContain('vision-sample-');
    expect(json).toContain('Keep this page');
    expect(json).toContain('Passport');
    expect(json).toContain('Basil');
    expect(json).toContain('Lisbon');
    expect(json).toContain('Lentil Soup');
    expect(json).toContain('Sparkly');
    expect(json).toContain('"shareAllergies":true');

    const backup = parseBackup(json);
    expect(backup.local.health?.emotions.every((emotion) => emotion.builtIn !== true)).toBe(true);
    expect(backup.domains.schedule).not.toHaveProperty('eventSuggestions');
    expect((backup.domains.schedule?.categories as { id?: string }[] | undefined)
      ?.some((category) => category.id === 'food')).toBe(false);
    expect((backup.domains.schedule?.categories as { id?: string }[] | undefined)
      ?.some((category) => category.id === 'reading')).toBe(true);

    useJournal.getState().reset();
    useTodos.getState().reset();
    usePlants.getState().reset();
    useTravel.getState().reset();
    useSchedule.getState().resetAll();
    useRecipes.getState().reset();
    useHealth.getState().reset();
    useFoodProfile.getState().reset();
    applyBackup(backup);

    expect(useJournal.getState().pages.some((page) =>
      page.blocks.some((block) => block.kind === 'text' && block.text === 'Keep this page'),
    )).toBe(true);
    expect(useJournal.getState().pages.some((page) => page.dateKey === '2026-08-14')).toBe(false);
    expect(useTodos.getState().tasks.some((task) => task.title === 'Passport' && task.completed)).toBe(true);
    expect(useTodos.getState().tasks.some((task) => task.title === 'Old socks')).toBe(false);
    expect(usePlants.getState().plants.some((plant) => plant.nickname === 'Basil')).toBe(true);
    expect(usePlants.getState().plants.some((plant) => plant.id === SAMPLE_PLANT_ID)).toBe(false);
    expect(useTravel.getState().plans.some((plan) => plan.title === 'Lisbon')).toBe(true);
    expect(useSchedule.getState().categories.some((category) => category.id === 'food')).toBe(true);
    expect(useSchedule.getState().categories.some((category) => category.id === 'reading')).toBe(true);
    expect(useSchedule.getState().eventSuggestions).toEqual([]);
    expect(useRecipes.getState().recipes.some((recipe) => recipe.title === 'Lentil Soup')).toBe(true);
    expect(useRecipes.getState().recipes.some((recipe) => recipe.id === FOOD_FIXTURE_RECIPE_IDS.shakshuka)).toBe(false);
    expect(useFoodProfile.getState().profile.privacy.shareAllergies).toBe(true);
    expect(useHealth.getState().emotions.some((emotion) => emotion.name === 'Sparkly')).toBe(true);
  });

  it('round-trips avatar and appearance customizations', () => {
    usePreferences.getState().setAvatar({
      kind: 'icon',
      iconId: 'mdi:leaf',
      color: '#52745A',
    });
    const backup = buildBackup();
    expect(backup.local.avatar).toMatchObject({ kind: 'icon', iconId: 'mdi:leaf', color: '#52745A' });
    expect(backup.domains.preferences).toEqual(expect.objectContaining({
      themePreference: expect.any(String),
    }));

    usePreferences.getState().resetAll();
    expect(usePreferences.getState().avatar.kind).toBe('initials');
    applyBackup(backup);
    expect(usePreferences.getState().avatar).toMatchObject({
      kind: 'icon',
      iconId: 'mdi:leaf',
      color: '#52745A',
    });
  });

  it('strips deleted records when restoring an older backup file', () => {
    const json = serializeBackup(buildBackup());
    const parsed = parseBackup(json);
    parsed.domains.todos = {
      ...(parsed.domains.todos ?? {}),
      lists: [{ id: 'list-old', name: 'Keep List', kind: 'checklist', mode: 'private', role: 'owner', createdAt: '2026-08-01T00:00:00.000Z', updatedAt: '2026-08-01T00:00:00.000Z' }],
      tasks: [
        { id: 'keep-task', listId: 'list-old', title: 'Still here', completed: false, important: false, createdAt: '2026-08-01T00:00:00.000Z', updatedAt: '2026-08-01T00:00:00.000Z', version: 1 },
        { id: 'gone-task', listId: 'list-old', title: 'Was deleted', completed: false, important: false, createdAt: '2026-08-01T00:00:00.000Z', updatedAt: '2026-08-01T00:00:00.000Z', version: 1, deletedAt: '2026-08-02T00:00:00.000Z' },
      ],
    } as never;
    applyBackup(parsed);
    expect(useTodos.getState().tasks.some((task) => task.title === 'Still here')).toBe(true);
    expect(useTodos.getState().tasks.some((task) => task.title === 'Was deleted')).toBe(false);
  });
});
