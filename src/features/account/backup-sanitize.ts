import { DEFAULT_CATEGORIES } from '@/constants/categories';
import { ALL_ACCOUNTS_TEST_TRIP } from '@/constants/travel';
import {
  FOOD_FIXTURE_ALLERGY_PEANUT_ID,
  FOOD_FIXTURE_PANTRY_IDS,
  FOOD_FIXTURE_RECIPE_IDS,
} from '@/features/food/fixtures';
import type { JournalPage } from '@/features/journal/types';
import { SAMPLE_PLANT_ID } from '@/features/plants/sample';
import { createDefaultVisionBoardCategories } from '@/features/vision-board/defaults';
import { VISION_BOARD_SAMPLE_ITEM_PREFIX } from '@/features/vision-board/sample';
import { hasCustomizedVisionBoardCategories } from '@/features/vision-board/selectors';
import type { VisionBoardCategory } from '@/features/vision-board/types';
import type { JsonObject, SyncDomainName } from '@/services/cloud/sync-types';
import type { MealPlanEntry, Recipe, UserFoodProfile } from '@/types/food';

import type { OnTrackBackup } from './backup-archive';

const APP_OWNED_KEYS = new Set([
  'eventSuggestions',
  'suppressedExternalEvents',
  'googleCalendarDeletions',
  'pendingMutations',
  'privacyPolicy',
  'privacyPolicyContent',
  'termsOfUse',
  'termsOfUseContent',
  'legalSections',
  'textHistory',
]);

const FIXTURE_RECIPE_IDS = new Set<string>(Object.values(FOOD_FIXTURE_RECIPE_IDS));
const FIXTURE_PANTRY_IDS = new Set<string>(Object.values(FOOD_FIXTURE_PANTRY_IDS));
const DEFAULT_CATEGORY_IDS = new Set(DEFAULT_CATEGORIES.map((category) => category.id));

function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function recordId(value: unknown): string | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const id = (value as { id?: unknown }).id;
  return typeof id === 'string' ? id : undefined;
}

function isDeletedRecord(value: unknown): boolean {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  if (record.deleted === true || record.isDeleted === true) return true;
  if (typeof record.deletedAt === 'string' && record.deletedAt.trim()) return true;
  if (typeof record.removedAt === 'string' && record.removedAt.trim()) return true;
  return false;
}

function stripDeletedAndAppOwned(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.filter((item) => !isDeletedRecord(item)).map(stripDeletedAndAppOwned);
  }
  if (value && typeof value === 'object') {
    const next: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(value)) {
      if (APP_OWNED_KEYS.has(key)) continue;
      next[key] = stripDeletedAndAppOwned(child);
    }
    return next;
  }
  return value;
}

function journalPageHasUserContent(page: JournalPage): boolean {
  if (!Array.isArray(page.blocks)) return false;
  return page.blocks.some((block) => {
    if (block.kind === 'text') return block.text.trim().length > 0;
    if (block.kind === 'voice') return Boolean(block.uri.trim());
    return Boolean(block.label.trim());
  });
}

function sanitizeDomain(name: SyncDomainName, payload: JsonObject): JsonObject {
  const next = stripDeletedAndAppOwned(payload) as JsonObject;
  if (name === 'schedule' && Array.isArray(next.categories)) {
    next.categories = next.categories.filter((category) => {
      const id = recordId(category);
      return Boolean(id) && !DEFAULT_CATEGORY_IDS.has(id!);
    });
  }
  if (name === 'plants' && Array.isArray(next.plants)) {
    next.plants = next.plants.filter((plant) => recordId(plant) !== SAMPLE_PLANT_ID);
  }
  if (name === 'travel' && Array.isArray(next.plans)) {
    next.plans = next.plans.filter((plan) => recordId(plan) !== ALL_ACCOUNTS_TEST_TRIP.id);
  }
  if (name === 'vision-board') {
    if (Array.isArray(next.items)) {
      next.items = next.items.filter((item) => {
        const id = recordId(item);
        return !id || !id.startsWith(VISION_BOARD_SAMPLE_ITEM_PREFIX);
      });
    }
    if (
      Array.isArray(next.categories)
      && !hasCustomizedVisionBoardCategories(next.categories as VisionBoardCategory[])
    ) {
      delete next.categories;
    }
  }
  return next;
}

function sanitizeFoodProfile(profile: UserFoodProfile | undefined): UserFoodProfile | undefined {
  if (!profile) return undefined;
  return {
    ...profile,
    allergies: profile.allergies.filter((allergy) => allergy.id !== FOOD_FIXTURE_ALLERGY_PEANUT_ID),
  };
}

function sanitizeLocal(local: OnTrackBackup['local']): OnTrackBackup['local'] {
  const next = stripDeletedAndAppOwned(cloneJson(local)) as OnTrackBackup['local'];
  if (next.journal?.pages) {
    next.journal = {
      ...next.journal,
      pages: next.journal.pages.filter(journalPageHasUserContent),
    };
  }
  if (next.health?.emotions) {
    next.health = {
      ...next.health,
      emotions: next.health.emotions.filter((emotion) => emotion.builtIn !== true),
    };
  }
  next.foodProfile = sanitizeFoodProfile(next.foodProfile);
  const recipes = next.foodRecipes?.recipes ?? [];
  const keptRecipes = recipes.filter((recipe: Recipe) => !FIXTURE_RECIPE_IDS.has(recipe.id));
  if (next.foodRecipes) {
    next.foodRecipes = {
      seeded: next.foodRecipes.seeded || keptRecipes.length !== recipes.length,
      recipes: keptRecipes,
    };
  }
  if (Array.isArray(next.foodPantry)) {
    next.foodPantry = next.foodPantry.filter((item) => !FIXTURE_PANTRY_IDS.has(item.id));
  }
  if (Array.isArray(next.foodMealPlan)) {
    next.foodMealPlan = next.foodMealPlan.filter((entry: MealPlanEntry) => {
      if (entry.id.startsWith('plan-agent-ui-food-')) return false;
      return !entry.recipeId || !FIXTURE_RECIPE_IDS.has(entry.recipeId);
    });
  }
  return next;
}

/** Drop app-owned copy and deleted records from a backup snapshot. */
export function sanitizeBackup(backup: OnTrackBackup): OnTrackBackup {
  const domains: Partial<Record<SyncDomainName, JsonObject>> = {};
  for (const [name, payload] of Object.entries(backup.domains)) {
    if (!payload) continue;
    domains[name as SyncDomainName] = sanitizeDomain(
      name as SyncDomainName,
      cloneJson(payload),
    );
  }
  return {
    ...backup,
    domains,
    local: sanitizeLocal(backup.local ?? {}),
  };
}

/** Sanitize, then rehydrate app chrome that restore writes still need. */
export function prepareBackupForRestore(backup: OnTrackBackup): OnTrackBackup {
  const sanitized = sanitizeBackup(backup);
  const vision = sanitized.domains['vision-board'];
  if (!vision || Array.isArray(vision.categories)) return sanitized;
  return {
    ...sanitized,
    domains: {
      ...sanitized.domains,
      'vision-board': {
        ...vision,
        categories: createDefaultVisionBoardCategories(),
      },
    },
  };
}
