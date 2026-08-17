import { DEFAULT_ADDON_STATE } from '@/addons/registry';
import type { AddonEnabledState } from '@/addons/types';
import type { AgentConversations, AgentInstallations } from '@/agents/types';
import { mergeDefaultCategories } from '@/constants/categories';
import { ALL_ACCOUNTS_TEST_TRIP } from '@/constants/travel';
import { isLegalConsentRecord } from '@/features/account/legal-consent';
import { ensurePlantSample } from '@/features/plants/sample';
import {
    hasCustomizedVisionBoardCategories,
    hasCustomizedVisionBoardItems,
} from '@/features/vision-board/selectors';
import type { VisionBoardCategory, VisionBoardItem } from '@/features/vision-board/types';
import { useAddons } from '@/store/addons';
import { useAgents } from '@/store/agents';
import {
    appearanceSyncFields,
    applyAppearancePayload,
    snapshotAppearance,
} from '@/store/appearance-sync';
import { privateFinancePayload, useFinance } from '@/store/finance';
import { usePlants } from '@/store/plants';
import { usePreferences } from '@/store/preferences';
import { useSchedule } from '@/store/schedule';
import { DEFAULT_CHECKLIST_NAME, privateChecklistPayload, useChecklists } from '@/store/todos';
import { useTravel } from '@/store/travel';
import { privateVehiclePayload, useVehicles } from '@/store/vehicles';
import { useVisionBoard } from '@/store/vision-board';
import type { Plant } from '@/types/models';

import type { JsonObject, SyncDomainName } from './sync-types';

export function objectValue(value: unknown): JsonObject | undefined {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as JsonObject)
    : undefined;
}

export type SyncDomain = {
  name: SyncDomainName;
  read: () => JsonObject;
  write: (payload: JsonObject) => void;
  reset: () => void;
  subscribe: (onChange: () => void) => () => void;
};

export const domains: SyncDomain[] = [
  {
    name: 'addons',
    read: () => {
      const state = useAddons.getState();
      return { enabled: state.enabled, updatedAt: state.updatedAt };
    },
    write: (payload) => {
      const enabled = objectValue(payload.enabled);
      if (!enabled) return;
      useAddons.getState().replaceEnabled(
        enabled as AddonEnabledState,
        typeof payload.updatedAt === 'string' ? payload.updatedAt : undefined,
      );
    },
    reset: () => useAddons.getState().reset(),
    subscribe: (onChange) => useAddons.subscribe(onChange),
  },
  {
    name: 'agents',
    read: () => {
      const state = useAgents.getState();
      return {
        installations: state.installations,
        conversations: state.conversations,
        updatedAt: state.updatedAt,
      };
    },
    write: (payload) => {
      const installations = objectValue(payload.installations);
      const conversations = objectValue(payload.conversations);
      if (!installations || !conversations) return;
      useAgents.getState().replaceAgentData(
        installations as AgentInstallations,
        conversations as AgentConversations,
        typeof payload.updatedAt === 'string' ? payload.updatedAt : undefined,
      );
    },
    reset: () => useAgents.getState().reset(),
    subscribe: (onChange) => useAgents.subscribe(onChange),
  },
  {
    name: 'preferences',
    read: () => {
      const state = usePreferences.getState();
      return {
        hasOnboarded: state.hasOnboarded,
        name: state.name,
        goal: state.goal,
        // Survive sign-out → sign-in (local wipe + cloud restore).
        homeLocation: state.homeLocation,
        currentLocation: state.currentLocation,
        ...appearanceSyncFields(snapshotAppearance()),
        aiEnabled: state.aiEnabled,
        hapticsEnabled: state.hapticsEnabled,
        usageAnalyticsEnabled: state.usageAnalyticsEnabled,
        legalConsent: state.legalConsent,
        showHolidays: state.showHolidays,
      };
    },
    write: (payload) => {
      const local = usePreferences.getState();
      const appearance = snapshotAppearance();
      usePreferences.setState({
        hasOnboarded: typeof payload.hasOnboarded === 'boolean' ? payload.hasOnboarded : false,
        name: typeof payload.name === 'string' ? payload.name : '',
        goal: typeof payload.goal === 'string' ? payload.goal : '',
        homeLocation:
          typeof payload.homeLocation === 'string'
            ? payload.homeLocation.trim()
            : local.homeLocation,
        currentLocation:
          typeof payload.currentLocation === 'string'
            ? payload.currentLocation.trim()
            : local.currentLocation,
        aiEnabled: typeof payload.aiEnabled === 'boolean' ? payload.aiEnabled : true,
        hapticsEnabled: typeof payload.hapticsEnabled === 'boolean' ? payload.hapticsEnabled : true,
        usageAnalyticsEnabled:
          typeof payload.usageAnalyticsEnabled === 'boolean'
            ? payload.usageAnalyticsEnabled
            : local.usageAnalyticsEnabled,
        legalConsent: isLegalConsentRecord(payload.legalConsent)
          ? payload.legalConsent
          : local.legalConsent,
        showHolidays:
          typeof payload.showHolidays === 'boolean' ? payload.showHolidays : true,
        // avatar stays device-only — never in app_state preferences payload.
      });
      applyAppearancePayload(payload, appearance);
    },
    reset: () => usePreferences.getState().resetAll(),
    subscribe: (onChange) => usePreferences.subscribe(onChange),
  },
  {
    name: 'schedule',
    read: () => {
      const state = useSchedule.getState();
      return {
        seeded: state.seeded,
        activities: state.activities,
        meals: state.meals,
        workouts: state.workouts,
        workSessions: state.workSessions,
        movies: state.movies,
        eventDetails: state.eventDetails,
        eventFollows: state.eventFollows,
        eventSuggestions: state.eventSuggestions,
        suppressedExternalEvents: state.suppressedExternalEvents,
        categories: mergeDefaultCategories(state.categories),
      };
    },
    write: (payload) => {
      useSchedule.setState({
        seeded: typeof payload.seeded === 'boolean' ? payload.seeded : false,
        activities: Array.isArray(payload.activities) ? payload.activities : [],
        meals: Array.isArray(payload.meals) ? payload.meals : [],
        workouts: Array.isArray(payload.workouts) ? payload.workouts : [],
        workSessions: Array.isArray(payload.workSessions) ? payload.workSessions : [],
        movies: Array.isArray(payload.movies) ? payload.movies : [],
        eventDetails: Array.isArray(payload.eventDetails) ? payload.eventDetails : [],
        eventFollows: Array.isArray(payload.eventFollows) ? payload.eventFollows : [],
        eventSuggestions: Array.isArray(payload.eventSuggestions) ? payload.eventSuggestions : [],
        suppressedExternalEvents: Array.isArray(payload.suppressedExternalEvents)
          ? payload.suppressedExternalEvents
          : [],
        categories: mergeDefaultCategories(
          Array.isArray(payload.categories)
            ? payload.categories
            : useSchedule.getState().categories,
        ),
      });
    },
    reset: () => useSchedule.getState().resetAll(),
    subscribe: (onChange) => useSchedule.subscribe(onChange),
  },
  {
    name: 'plants',
    read: () => {
      const state = usePlants.getState();
      return {
        plants: state.plants,
        sampleVersion: state.sampleVersion,
        sampleDismissed: state.sampleDismissed,
      };
    },
    write: (payload) => {
      if (!Array.isArray(payload.plants)) return;
      const upgraded = ensurePlantSample(
        payload.plants as Plant[],
        typeof payload.sampleVersion === 'number'
          ? payload.sampleVersion
          : usePlants.getState().sampleVersion,
        typeof payload.sampleDismissed === 'boolean'
          ? payload.sampleDismissed
          : usePlants.getState().sampleDismissed,
      );
      usePlants.setState({
        plants: upgraded.plants,
        sampleVersion: upgraded.sampleVersion,
        sampleDismissed: upgraded.sampleDismissed,
      });
    },
    reset: () => usePlants.getState().reset(),
    subscribe: (onChange) => usePlants.subscribe(onChange),
  },
  {
    name: 'travel',
    read: () => ({ plans: useTravel.getState().plans }),
    write: (payload) => {
      if (Array.isArray(payload.plans)) useTravel.getState().replacePlans(payload.plans);
    },
    reset: () => useTravel.getState().reset(),
    subscribe: (onChange) => {
      let previousPlans = useTravel.getState().plans;
      return useTravel.subscribe((state) => {
        if (state.plans === previousPlans) return;
        previousPlans = state.plans;
        onChange();
      });
    },
  },
  {
    name: 'todos',
    read: () => privateChecklistPayload(useChecklists.getState()),
    write: (payload) => {
      useChecklists.getState().replacePrivateData(payload);
    },
    reset: () => useChecklists.getState().reset(),
    subscribe: (onChange) => useChecklists.subscribe(onChange),
  },
  {
    name: 'vision-board',
    read: () => {
      const state = useVisionBoard.getState();
      return {
        categories: state.categories,
        items: state.items,
        sampleVersion: state.sampleVersion,
        updatedAt: state.updatedAt,
      };
    },
    write: (payload) => {
      if (!Array.isArray(payload.categories) || !Array.isArray(payload.items)) return;
      useVisionBoard.getState().replaceVisionBoardData(
        payload.categories as VisionBoardCategory[],
        payload.items as VisionBoardItem[],
        typeof payload.updatedAt === 'string' ? payload.updatedAt : undefined,
        typeof payload.sampleVersion === 'number' ? payload.sampleVersion : undefined,
      );
    },
    reset: () => useVisionBoard.getState().reset(),
    subscribe: (onChange) => useVisionBoard.subscribe(onChange),
  },
  {
    name: 'vehicles',
    read: () => ({
      vehicles: privateVehiclePayload(useVehicles.getState().vehicles),
    }),
    write: (payload) => {
      if (!Array.isArray(payload.vehicles)) return;
      const shared = useVehicles.getState().vehicles.filter((item) => item.mode === 'shared');
      useVehicles.getState().replaceVehicles([
        ...shared,
        ...payload.vehicles,
      ]);
    },
    reset: () => useVehicles.getState().reset(),
    subscribe: (onChange) => useVehicles.subscribe(onChange),
  },
  {
    name: 'finance',
    read: () => {
      const state = useFinance.getState();
      return privateFinancePayload({
        entities: state.entities,
        accounts: state.accounts,
        holdings: state.holdings,
        transactions: state.transactions,
        bills: state.bills,
        subscriptionCandidates: state.subscriptionCandidates,
        dismissedSubscriptions: state.dismissedSubscriptions,
        subscriptionDetectionStatus: state.subscriptionDetectionStatus,
        buckets: state.buckets,
        taxYears: state.taxYears,
        documents: state.documents,
        rewardProfiles: state.rewardProfiles,
        creditScore: state.creditScore,
        customHandoffUrl: state.customHandoffUrl,
        referenceSavingsApr: state.referenceSavingsApr,
        baseCurrency: state.baseCurrency,
        updatedAt: state.updatedAt,
      }) as unknown as JsonObject;
    },
    write: (payload) => {
      useFinance.getState().replaceFinanceData(
        payload as unknown as import('@/features/finance/types').FinanceStateSnapshot,
      );
    },
    reset: () => useFinance.getState().reset(),
    subscribe: (onChange) => useFinance.subscribe(onChange),
  },
];

export function snapshotLocalDomains(): Map<SyncDomainName, JsonObject> {
  const snapshot = new Map<SyncDomainName, JsonObject>();
  for (const domain of domains) {
    snapshot.set(domain.name, domain.read());
  }
  return snapshot;
}

export function hasMeaningfulLocalData(): boolean {
  const preferences = usePreferences.getState();
  if (preferences.hasOnboarded || preferences.name.trim() || preferences.goal.trim()) return true;
  if (usePlants.getState().plants.length > 0) return true;
  const todoState = useChecklists.getState();
  if (
    todoState.categories.length > 0 ||
    todoState.tasks.length > 0 ||
    todoState.lists.some((list) => list.name !== DEFAULT_CHECKLIST_NAME)
  ) return true;
  if (Object.keys(useAgents.getState().installations).length > 0) return true;
  if (Object.keys(useAgents.getState().conversations).length > 0) return true;
  if (useTravel.getState().plans.some((plan) => plan.id !== ALL_ACCOUNTS_TEST_TRIP.id)) return true;
  if (useVehicles.getState().vehicles.length > 0) return true;
  const finance = useFinance.getState();
  if (
    finance.transactions.length > 0 ||
    finance.bills.length > 0 ||
    finance.subscriptionCandidates.length > 0 ||
    finance.dismissedSubscriptions.length > 0 ||
    finance.buckets.length > 0 ||
    finance.accounts.length > 0 ||
    finance.holdings.length > 0 ||
    finance.creditScore?.current != null ||
    finance.entities.some((e) => e.kind !== 'personal')
  ) {
    return true;
  }
  const visionBoard = useVisionBoard.getState();
  if (
    hasCustomizedVisionBoardItems(visionBoard.items) ||
    hasCustomizedVisionBoardCategories(visionBoard.categories)
  ) return true;
  return Object.entries(useAddons.getState().enabled).some(
    ([id, enabled]) => enabled !== DEFAULT_ADDON_STATE[id as keyof AddonEnabledState],
  );
}
