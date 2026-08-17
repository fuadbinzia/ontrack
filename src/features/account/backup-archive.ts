import type { BackupMediaEntry } from '@/features/account/backup-media';
import { prepareBackupForRestore, sanitizeBackup } from '@/features/account/backup-sanitize';
import {
    normalizeAvatarMeta,
    type ProfileAvatarMeta,
} from '@/features/account/profile-avatar-model';
import { getAppVersion } from '@/features/account/release-notes-format';
import { DEFAULT_EMOTIONS } from '@/features/health/defaults';
import type {
    DailyHealthSummary,
    EmotionDefinition,
    HealthWorkoutSummary,
    MoodEntry,
    MoodFactor,
    MoodPlaybook,
    MoodPlaybookRun,
} from '@/features/health/types';
import { normalizeJournalPages } from '@/features/journal/model';
import type { JournalPage } from '@/features/journal/types';
import {
    DEFAULT_TRAVEL_MAP_SETTINGS,
    normalizeTravelMapSettings,
    normalizeTravelMapVisits,
} from '@/features/travel/map/normalize';
import type { TravelMapSettings, TravelMapVisit } from '@/features/travel/map/types';
import { domains } from '@/services/cloud/sync-domains';
import type { JsonObject, SyncDomainName } from '@/services/cloud/sync-types';
import { useFinanceEzPassStatements } from '@/store/finance-ezpass-statements';
import { useMealPlan } from '@/store/food-meal-plan';
import { usePantry } from '@/store/food-pantry';
import { useFoodProfile } from '@/store/food-profile';
import { useRecipes } from '@/store/food-recipes';
import { useHealth } from '@/store/health';
import { useJournal } from '@/store/journal';
import { usePreferences } from '@/store/preferences';
import { useTabPins } from '@/store/tab-pins';
import { useTravelMap } from '@/store/travel-map';
import type { MealPlanEntry, PantryItem, Recipe, UserFoodProfile } from '@/types/food';

export const ONTRACK_BACKUP_KIND = 'ontrack.backup';
export const ONTRACK_BACKUP_VERSION = 1;

export type OnTrackBackup = {
  kind: typeof ONTRACK_BACKUP_KIND;
  version: typeof ONTRACK_BACKUP_VERSION;
  createdAt: string;
  appVersion: string;
  domains: Partial<Record<SyncDomainName, JsonObject>>;
  local: {
    journal?: {
      version: 1;
      aiDisclosureAccepted: boolean;
      pages: JournalPage[];
    };
    health?: {
      version: 1;
      accessReviewed: boolean;
      stateOfMindSyncEnabled: boolean;
      aiDisclosureAccepted: boolean;
      dailySummaries: DailyHealthSummary[];
      workouts: HealthWorkoutSummary[];
      lastRefreshAt?: string;
      emotions: EmotionDefinition[];
      factors: MoodFactor[];
      moodEntries: MoodEntry[];
      playbooks: MoodPlaybook[];
      playbookRuns: MoodPlaybookRun[];
    };
    foodProfile?: UserFoodProfile;
    foodPantry?: PantryItem[];
    foodRecipes?: { seeded: boolean; recipes: Recipe[] };
    foodMealPlan?: MealPlanEntry[];
    financeEzPassStatements?: { id: string; name: string; uris: string[]; importedAt: string }[];
    travelMap?: { visits: TravelMapVisit[]; settings: TravelMapSettings };
    tabPins?: { trackerOrder: string[]; pinnedCount: number };
    avatar?: ProfileAvatarMeta;
  };
  media?: Record<string, BackupMediaEntry>;
};

function objectValue(value: unknown): JsonObject | undefined {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as JsonObject)
    : undefined;
}

function asBoolean(value: unknown, fallback = false): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function backupStamp(date = new Date()): string {
  const iso = date.toISOString().replace(/[:.]/g, '-');
  return iso.slice(0, 19).replace('T', '-');
}

export function backupFileName(createdAt = new Date()): string {
  return `onTrack-backup-${backupStamp(createdAt)}.json`;
}

export type BuildBackupOptions = {
  /** Health and journal stay off the plaintext file unless the user opts in. */
  includeSensitiveLocal?: boolean;
};

export function buildBackup(
  createdAt = new Date().toISOString(),
  options: BuildBackupOptions = {},
): OnTrackBackup {
  const includeSensitiveLocal = options.includeSensitiveLocal === true;
  const journal = useJournal.getState();
  const health = useHealth.getState();
  const recipes = useRecipes.getState();
  const travelMap = useTravelMap.getState();
  const tabPins = useTabPins.getState();
  const domainsPayload = {} as Record<SyncDomainName, JsonObject>;
  for (const domain of domains) {
    domainsPayload[domain.name] = domain.read();
  }
  return sanitizeBackup({
    kind: ONTRACK_BACKUP_KIND,
    version: ONTRACK_BACKUP_VERSION,
    createdAt,
    appVersion: getAppVersion(),
    domains: domainsPayload,
    local: {
      journal: includeSensitiveLocal
        ? {
            version: 1,
            aiDisclosureAccepted: journal.aiDisclosureAccepted,
            pages: journal.pages,
          }
        : undefined,
      health: includeSensitiveLocal
        ? {
            version: 1,
            accessReviewed: health.accessReviewed,
            stateOfMindSyncEnabled: health.stateOfMindSyncEnabled,
            aiDisclosureAccepted: health.aiDisclosureAccepted,
            dailySummaries: health.dailySummaries,
            workouts: health.workouts,
            lastRefreshAt: health.lastRefreshAt,
            emotions: health.emotions,
            factors: health.factors,
            moodEntries: health.moodEntries,
            playbooks: health.playbooks,
            playbookRuns: health.playbookRuns,
          }
        : undefined,
      foodProfile: useFoodProfile.getState().profile,
      foodPantry: usePantry.getState().items,
      foodRecipes: { seeded: recipes.seeded, recipes: recipes.recipes },
      foodMealPlan: useMealPlan.getState().entries,
      financeEzPassStatements: useFinanceEzPassStatements.getState().statements,
      travelMap: { visits: travelMap.visits, settings: travelMap.settings },
      tabPins: { trackerOrder: tabPins.trackerOrder, pinnedCount: tabPins.pinnedCount },
      avatar: usePreferences.getState().avatar,
    },
  });
}

export function serializeBackup(backup: OnTrackBackup = buildBackup()): string {
  return `${JSON.stringify(backup)}\n`;
}

export function parseBackup(raw: string): OnTrackBackup {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error('This file is not a readable onTrack backup.');
  }
  const value = objectValue(parsed);
  if (!value || value.kind !== ONTRACK_BACKUP_KIND) {
    throw new Error('This file is not an onTrack backup.');
  }
  if (value.version !== ONTRACK_BACKUP_VERSION) {
    throw new Error('This backup was made by a newer onTrack and cannot be restored here.');
  }
  if (typeof value.createdAt !== 'string' || !value.createdAt.trim()) {
    throw new Error('This backup is missing a created date.');
  }
  return {
    kind: ONTRACK_BACKUP_KIND,
    version: ONTRACK_BACKUP_VERSION,
    createdAt: value.createdAt,
    appVersion: typeof value.appVersion === 'string' ? value.appVersion : '—',
    domains: objectValue(value.domains) ?? {},
    local: objectValue(value.local) ?? {},
    media: objectValue(value.media) as OnTrackBackup['media'],
  };
}

function restoreJournal(payload: unknown) {
  const value = objectValue(payload);
  if (!value) return;
  useJournal.setState({
    version: 1,
    aiDisclosureAccepted: asBoolean(value.aiDisclosureAccepted),
    pages: Array.isArray(value.pages) ? normalizeJournalPages(value.pages) : [],
    textHistory: {},
  });
}

function restoreHealth(payload: unknown) {
  const value = objectValue(payload);
  if (!value) return;
  const customEmotions = (Array.isArray(value.emotions) ? value.emotions : [])
    .filter((emotion): emotion is EmotionDefinition =>
      Boolean(emotion && typeof emotion === 'object' && !Array.isArray(emotion) && (emotion as EmotionDefinition).builtIn !== true),
    );
  useHealth.setState({
    version: 1,
    accessReviewed: asBoolean(value.accessReviewed),
    stateOfMindSyncEnabled: asBoolean(value.stateOfMindSyncEnabled),
    aiDisclosureAccepted: asBoolean(value.aiDisclosureAccepted),
    dailySummaries: Array.isArray(value.dailySummaries) ? value.dailySummaries as DailyHealthSummary[] : [],
    workouts: Array.isArray(value.workouts) ? value.workouts as HealthWorkoutSummary[] : [],
    lastRefreshAt: typeof value.lastRefreshAt === 'string' ? value.lastRefreshAt : undefined,
    emotions: [...DEFAULT_EMOTIONS.map((emotion) => ({ ...emotion })), ...customEmotions],
    factors: Array.isArray(value.factors) ? value.factors as MoodFactor[] : [],
    moodEntries: Array.isArray(value.moodEntries) ? value.moodEntries as MoodEntry[] : [],
    playbooks: Array.isArray(value.playbooks) ? value.playbooks as MoodPlaybook[] : [],
    playbookRuns: Array.isArray(value.playbookRuns) ? value.playbookRuns as MoodPlaybookRun[] : [],
  });
}

/** Replace local app data with a parsed backup. Does not pull or push cloud sync. */
export function applyBackup(backup: OnTrackBackup) {
  const restored = prepareBackupForRestore(backup);
  for (const domain of domains) {
    const payload = restored.domains?.[domain.name];
    if (payload) domain.write(payload);
  }
  restoreJournal(restored.local.journal);
  restoreHealth(restored.local.health);
  if (restored.local.foodProfile) useFoodProfile.getState().replaceProfile(restored.local.foodProfile);
  if (Array.isArray(restored.local.foodPantry)) usePantry.getState().replaceItems(restored.local.foodPantry);
  if (restored.local.foodRecipes) {
    useRecipes.setState({
      seeded: asBoolean(restored.local.foodRecipes.seeded),
      recipes: Array.isArray(restored.local.foodRecipes.recipes) ? restored.local.foodRecipes.recipes : [],
    });
  }
  if (Array.isArray(restored.local.foodMealPlan)) {
    useMealPlan.getState().replaceEntries(restored.local.foodMealPlan);
  }
  if (Array.isArray(restored.local.financeEzPassStatements)) {
    useFinanceEzPassStatements.setState({ statements: restored.local.financeEzPassStatements });
  }
  if (restored.local.travelMap) {
    useTravelMap.setState({
      visits: normalizeTravelMapVisits(restored.local.travelMap.visits),
      settings: normalizeTravelMapSettings(restored.local.travelMap.settings ?? DEFAULT_TRAVEL_MAP_SETTINGS),
      pendingMutations: [],
    });
  }
  if (restored.local.tabPins) {
    useTabPins.getState().setTrackerOrder(
      restored.local.tabPins.trackerOrder,
      restored.local.tabPins.pinnedCount,
    );
  }
  if (restored.local.avatar) {
    usePreferences.getState().setAvatar(normalizeAvatarMeta(restored.local.avatar));
  }
}
