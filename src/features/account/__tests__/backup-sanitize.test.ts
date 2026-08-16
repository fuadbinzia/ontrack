import {
  ONTRACK_BACKUP_KIND,
  ONTRACK_BACKUP_VERSION,
  type OnTrackBackup,
} from '../backup-archive';
import { sanitizeBackup } from '../backup-sanitize';
import { PRIVACY_POLICY_INTRO } from '../privacy-policy-content';
import { FOOD_FIXTURE_RECIPE_IDS } from '@/features/food/fixtures';
import { SAMPLE_PLANT_ID } from '@/features/plants/sample';
import { ALL_ACCOUNTS_TEST_TRIP } from '@/constants/travel';

function backup(patch: Partial<OnTrackBackup> = {}): OnTrackBackup {
  return {
    kind: ONTRACK_BACKUP_KIND,
    version: ONTRACK_BACKUP_VERSION,
    createdAt: '2026-08-16T18:00:00.000Z',
    appVersion: '1.0.0-test',
    domains: {},
    local: {},
    ...patch,
  };
}

describe('user-owned backup sanitizer', () => {
  it('omits privacy policy copy and other app-owned documents from the archive', () => {
    const json = JSON.stringify(sanitizeBackup(backup({
      domains: {
        preferences: {
          name: 'Alex Rivera',
          privacyPolicy: PRIVACY_POLICY_INTRO,
          termsOfUse: 'Do not copy these terms into a backup.',
        },
      },
    })));

    expect(json).toContain('Alex Rivera');
    expect(json).not.toContain(PRIVACY_POLICY_INTRO);
    expect(json).not.toContain('This Privacy Policy explains');
    expect(json).not.toContain('Do not copy these terms into a backup.');
    expect(json).not.toContain('privacyPolicy');
  });

  it('omits deleted records, calendar tombstones, and pending delete queues', () => {
    const sanitized = sanitizeBackup(backup({
      domains: {
        schedule: {
          suppressedExternalEvents: ['google:evt-1'],
          googleCalendarDeletions: [{ activityId: 'act-1' }],
          activities: [
            { id: 'keep-event', title: 'Dentist' },
            { id: 'gone-event', title: 'Cancelled flight', deletedAt: '2026-08-16T12:00:00.000Z' },
          ],
        },
        todos: {
          tasks: [
            { id: 'keep-task', title: 'Passport', listId: 'list-1' },
            { id: 'gone-task', title: 'Old socks', listId: 'list-1', deletedAt: '2026-08-15T00:00:00.000Z' },
          ],
          pendingMutations: [{ id: 'mut-1', operation: 'delete_task' }],
        },
        plants: {
          plants: [
            { id: SAMPLE_PLANT_ID, nickname: 'Monstera' },
            { id: 'plant-user-basil', nickname: 'Basil' },
          ],
        },
        travel: {
          plans: [
            ALL_ACCOUNTS_TEST_TRIP,
            { id: 'trip-user-lisbon', title: 'Lisbon' },
          ],
        },
      },
      local: {
        journal: {
          version: 1,
          aiDisclosureAccepted: false,
          pages: [
            {
              id: 'page-keep',
              dateKey: '2026-08-16',
              createdAt: '2026-08-16T00:00:00.000Z',
              updatedAt: '2026-08-16T00:00:00.000Z',
              blocks: [{
                id: 'b1',
                kind: 'text',
                text: 'Keep this page',
                createdAt: '2026-08-16T00:00:00.000Z',
                updatedAt: '2026-08-16T00:00:00.000Z',
              }],
            },
            {
              id: 'page-empty',
              dateKey: '2026-08-15',
              createdAt: '2026-08-15T00:00:00.000Z',
              updatedAt: '2026-08-15T00:00:00.000Z',
              blocks: [],
            },
            {
              id: 'page-deleted',
              dateKey: '2026-08-14',
              createdAt: '2026-08-14T00:00:00.000Z',
              updatedAt: '2026-08-14T00:00:00.000Z',
              deletedAt: '2026-08-14T12:00:00.000Z',
              blocks: [{
                id: 'b2',
                kind: 'text',
                text: 'Deleted note',
                createdAt: '2026-08-14T00:00:00.000Z',
                updatedAt: '2026-08-14T00:00:00.000Z',
              }],
            } as never,
          ],
        },
        foodRecipes: {
          seeded: true,
          recipes: [
            { id: FOOD_FIXTURE_RECIPE_IDS.shakshuka, title: 'Skillet Shakshuka' } as never,
            { id: 'recipe-user-soup', title: 'Lentil Soup' } as never,
          ],
        },
      },
    }));

    const json = JSON.stringify(sanitized);
    expect(json).toContain('Dentist');
    expect(json).toContain('Passport');
    expect(json).toContain('Basil');
    expect(json).toContain('Lisbon');
    expect(json).toContain('Keep this page');
    expect(json).toContain('Lentil Soup');
    expect(json).not.toContain('Cancelled flight');
    expect(json).not.toContain('Old socks');
    expect(json).not.toContain('Deleted note');
    expect(json).not.toContain('google:evt-1');
    expect(json).not.toContain('pendingMutations');
    expect(json).not.toContain(SAMPLE_PLANT_ID);
    expect(json).not.toContain(ALL_ACCOUNTS_TEST_TRIP.id);
    expect(json).not.toContain('Skillet Shakshuka');
    expect(sanitized.local.journal?.pages).toHaveLength(1);
    expect(sanitized.domains.schedule).not.toHaveProperty('suppressedExternalEvents');
    expect(sanitized.domains.schedule).not.toHaveProperty('eventSuggestions');
  });

  it('keeps user food privacy sharing choices, not fixture demo recipes', () => {
    const sanitized = sanitizeBackup(backup({
      local: {
        foodProfile: {
          dietaryPreferences: [],
          allergies: [],
          intolerances: [],
          avoidedIngredients: [],
          cuisineLikes: [],
          cuisineDislikes: [],
          nutritionPriorities: [],
          privacy: {
            shareAllergies: true,
            shareDietaryPreferences: false,
            shareMeals: false,
          },
        },
      },
    }));
    expect(sanitized.local.foodProfile?.privacy.shareAllergies).toBe(true);
  });
});
