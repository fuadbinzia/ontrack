/**
 * Cloud-base merge of guest device payloads into account `app_state` domains.
 * Cloud wins on id/key clash; device-only entities are appended.
 */

export type JsonObject = Record<string, unknown>;

function isRecord(value: unknown): value is JsonObject {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function entityId(item: unknown): string | undefined {
  if (!isRecord(item)) return undefined;
  return typeof item.id === 'string' && item.id ? item.id : undefined;
}

/** Preserve cloud order; append device items whose ids are absent from cloud. */
export function mergeEntityArrays(cloud: unknown, device: unknown): unknown[] {
  const cloudList = Array.isArray(cloud) ? cloud : [];
  const deviceList = Array.isArray(device) ? device : [];
  const cloudIds = new Set<string>();
  for (const item of cloudList) {
    const id = entityId(item);
    if (id) cloudIds.add(id);
  }
  const extras: unknown[] = [];
  for (const item of deviceList) {
    const id = entityId(item);
    if (!id || cloudIds.has(id)) continue;
    extras.push(item);
    cloudIds.add(id);
  }
  return extras.length === 0 ? cloudList : [...cloudList, ...extras];
}

/** Cloud wins collisions; append device rows keyed by a non-`id` string field. */
export function mergeEntityArraysByKey(cloud: unknown, device: unknown, key: string): unknown[] {
  const cloudList = Array.isArray(cloud) ? cloud : [];
  const deviceList = Array.isArray(device) ? device : [];
  const known = new Set(
    cloudList.map((item) => isRecord(item) && typeof item[key] === 'string' ? item[key] : undefined),
  );
  const extras = deviceList.filter((item) => {
    if (!isRecord(item) || typeof item[key] !== 'string' || known.has(item[key])) return false;
    known.add(item[key]);
    return true;
  });
  return extras.length ? [...cloudList, ...extras] : cloudList;
}

/** Cloud keys win; device-only keys are added. */
export function mergeKeyedRecords(cloud: unknown, device: unknown): JsonObject {
  const base = isRecord(cloud) ? { ...cloud } : {};
  if (!isRecord(device)) return base;
  for (const [key, value] of Object.entries(device)) {
    if (!(key in base)) base[key] = value;
  }
  return base;
}

type SyncDomainName =
  | 'addons'
  | 'agents'
  | 'preferences'
  | 'schedule'
  | 'plants'
  | 'travel'
  | 'todos'
  | 'vision-board'
  | 'vehicles'
  | 'finance';

/**
 * Merge one domain: `cloud` is the applied account payload (or current after
 * applyRemote); `device` is the pre-apply guest snapshot.
 */
export function mergeDomainPayload(
  domain: SyncDomainName,
  cloud: JsonObject,
  device: JsonObject,
): JsonObject {
  switch (domain) {
    case 'preferences':
    case 'addons':
      // Cloud wins synced scalars entirely.
      return cloud;
    case 'agents':
      return {
        ...cloud,
        installations: mergeKeyedRecords(cloud.installations, device.installations),
        conversations: mergeKeyedRecords(cloud.conversations, device.conversations),
        updatedAt: cloud.updatedAt ?? device.updatedAt,
      };
    case 'schedule':
      return {
        ...cloud,
        activities: mergeEntityArrays(cloud.activities, device.activities),
        meals: mergeEntityArrays(cloud.meals, device.meals),
        workouts: mergeEntityArrays(cloud.workouts, device.workouts),
        workSessions: mergeEntityArrays(cloud.workSessions, device.workSessions),
        movies: mergeEntityArrays(cloud.movies, device.movies),
        eventDetails: mergeEntityArraysByKey(cloud.eventDetails, device.eventDetails, 'activityId'),
        eventFollows: mergeEntityArrays(cloud.eventFollows, device.eventFollows),
        eventSuggestions: mergeEntityArrays(cloud.eventSuggestions, device.eventSuggestions),
        suppressedExternalEvents: [
          ...new Set([
            ...(Array.isArray(cloud.suppressedExternalEvents) ? cloud.suppressedExternalEvents : []),
            ...(Array.isArray(device.suppressedExternalEvents) ? device.suppressedExternalEvents : []),
          ]),
        ],
        categories: mergeEntityArrays(cloud.categories, device.categories),
      };
    case 'plants':
      return {
        ...cloud,
        plants: mergeEntityArrays(cloud.plants, device.plants),
      };
    case 'travel':
      return {
        ...cloud,
        plans: mergeEntityArrays(cloud.plans, device.plans),
      };
    case 'todos':
      return {
        ...cloud,
        lists: mergeEntityArrays(cloud.lists, device.lists),
        categories: mergeEntityArrays(cloud.categories, device.categories),
        tasks: mergeEntityArrays(cloud.tasks, device.tasks),
        recipes: mergeEntityArrays(cloud.recipes, device.recipes),
      };
    case 'vision-board':
      return {
        ...cloud,
        categories: mergeEntityArrays(cloud.categories, device.categories),
        items: mergeEntityArrays(cloud.items, device.items),
      };
    case 'vehicles':
      return {
        ...cloud,
        vehicles: mergeEntityArrays(cloud.vehicles, device.vehicles),
      };
    case 'finance':
      return {
        ...cloud,
        entities: mergeEntityArrays(cloud.entities, device.entities),
        accounts: mergeEntityArrays(cloud.accounts, device.accounts),
        holdings: mergeEntityArrays(cloud.holdings, device.holdings),
        transactions: mergeEntityArrays(cloud.transactions, device.transactions),
        bills: mergeEntityArrays(cloud.bills, device.bills),
        buckets: mergeEntityArrays(cloud.buckets, device.buckets),
        taxYears: mergeEntityArrays(cloud.taxYears, device.taxYears),
        documents: mergeEntityArrays(cloud.documents, device.documents),
      };
    default:
      return cloud;
  }
}
