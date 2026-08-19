import {
  asFiniteNonNegative,
  asPositiveNumber,
  asString,
  asTrimmedString,
} from '@/utils/parse';

import {
  VEHICLE_EXPENSE_CATEGORIES,
  VEHICLE_PART_STATUSES,
  type Vehicle,
  type VehicleActivityEntity,
  type VehicleActivityEvent,
  type VehicleExpense,
  type VehicleExpenseCategory,
  type VehicleInsurance,
  type VehicleInvite,
  type VehicleMaintenanceLog,
  type VehicleMaintenanceSchedule,
  type VehicleMember,
  type VehicleMileageLog,
  type VehiclePart,
  type VehiclePartStatus,
  type VehicleRegistration,
  type VehicleRole,
} from './types';

const EXPENSE_CATEGORIES = new Set<VehicleExpenseCategory>(VEHICLE_EXPENSE_CATEGORIES);
const PART_STATUSES = new Set<VehiclePartStatus>(VEHICLE_PART_STATUSES);
const ACTIVITY_ENTITIES = new Set<VehicleActivityEntity>([
  'vehicle',
  'maintenance_schedule',
  'maintenance_log',
  'mileage',
  'expense',
  'part',
  'registration',
  'insurance',
  'member',
]);

function normalizeCurrency(value: unknown, fallback = 'USD'): string {
  const raw = asTrimmedString(value)?.toUpperCase();
  return raw && /^[A-Z]{3}$/.test(raw) ? raw : fallback;
}

function normalizeRole(value: unknown): VehicleRole {
  return value === 'member' ? 'member' : 'owner';
}

export function normalizeRegistration(value: unknown): VehicleRegistration | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const row = value as Partial<VehicleRegistration>;
  const next: VehicleRegistration = {
    state: asTrimmedString(row.state),
    number: asTrimmedString(row.number),
    expiresOn: asTrimmedString(row.expiresOn),
    notes: asString(row.notes),
  };
  return next.state || next.number || next.expiresOn || next.notes ? next : undefined;
}

export function normalizeInsurance(value: unknown): VehicleInsurance | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const row = value as Partial<VehicleInsurance>;
  const next: VehicleInsurance = {
    provider: asTrimmedString(row.provider),
    policyNumber: asTrimmedString(row.policyNumber),
    expiresOn: asTrimmedString(row.expiresOn),
    notes: asString(row.notes),
  };
  return next.provider || next.policyNumber || next.expiresOn || next.notes
    ? next
    : undefined;
}

export function normalizeMaintenanceSchedule(
  value: unknown,
): VehicleMaintenanceSchedule | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const row = value as Partial<VehicleMaintenanceSchedule>;
  const id = asTrimmedString(row.id);
  const title = asTrimmedString(row.title);
  const createdAt = asTrimmedString(row.createdAt);
  const updatedAt = asTrimmedString(row.updatedAt);
  if (!id || !title || !createdAt || !updatedAt) return undefined;
  return {
    id,
    title,
    intervalMiles: asPositiveNumber(row.intervalMiles),
    intervalMonths: asPositiveNumber(row.intervalMonths),
    lastDoneAt: asTrimmedString(row.lastDoneAt),
    lastDoneMiles: asFiniteNonNegative(row.lastDoneMiles),
    notes: asString(row.notes),
    createdAt,
    updatedAt,
  };
}

export function normalizeMaintenanceLog(value: unknown): VehicleMaintenanceLog | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const row = value as Partial<VehicleMaintenanceLog>;
  const id = asTrimmedString(row.id);
  const title = asTrimmedString(row.title);
  const date = asTrimmedString(row.date);
  const createdAt = asTrimmedString(row.createdAt);
  const updatedAt = asTrimmedString(row.updatedAt);
  if (!id || !title || !date || !createdAt || !updatedAt) return undefined;
  return {
    id,
    title,
    date,
    miles: asFiniteNonNegative(row.miles),
    cost: asPositiveNumber(row.cost),
    currency: row.currency ? normalizeCurrency(row.currency) : undefined,
    notes: asString(row.notes),
    scheduleId: asTrimmedString(row.scheduleId),
    createdAt,
    updatedAt,
  };
}

export function normalizeMileageLog(value: unknown): VehicleMileageLog | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const row = value as Partial<VehicleMileageLog>;
  const id = asTrimmedString(row.id);
  const date = asTrimmedString(row.date);
  const miles = asFiniteNonNegative(row.miles);
  const createdAt = asTrimmedString(row.createdAt);
  if (!id || !date || miles === undefined || !createdAt) return undefined;
  return {
    id,
    date,
    miles,
    notes: asString(row.notes),
    createdAt,
  };
}

export function normalizeExpense(value: unknown): VehicleExpense | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const row = value as Partial<VehicleExpense>;
  const id = asTrimmedString(row.id);
  const title = asTrimmedString(row.title);
  const amount = asPositiveNumber(row.amount);
  const date = asTrimmedString(row.date);
  const createdAt = asTrimmedString(row.createdAt);
  const updatedAt = asTrimmedString(row.updatedAt);
  const category = row.category;
  if (
    !id ||
    !title ||
    amount === undefined ||
    !date ||
    !createdAt ||
    !updatedAt ||
    typeof category !== 'string' ||
    !EXPENSE_CATEGORIES.has(category as VehicleExpenseCategory)
  ) {
    return undefined;
  }
  return {
    id,
    title,
    amount,
    currency: normalizeCurrency(row.currency),
    date,
    category: category as VehicleExpenseCategory,
    notes: asString(row.notes),
    createdAt,
    updatedAt,
  };
}

export function normalizePart(value: unknown): VehiclePart | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const row = value as Partial<VehiclePart>;
  const id = asTrimmedString(row.id);
  const name = asTrimmedString(row.name);
  const createdAt = asTrimmedString(row.createdAt);
  const updatedAt = asTrimmedString(row.updatedAt);
  const status = row.status;
  if (
    !id ||
    !name ||
    !createdAt ||
    !updatedAt ||
    typeof status !== 'string' ||
    !PART_STATUSES.has(status as VehiclePartStatus)
  ) {
    return undefined;
  }
  return {
    id,
    name,
    partNumber: asTrimmedString(row.partNumber),
    category: asTrimmedString(row.category),
    vendorUrl: asTrimmedString(row.vendorUrl),
    status: status as VehiclePartStatus,
    price: asPositiveNumber(row.price),
    currency: row.currency ? normalizeCurrency(row.currency) : undefined,
    notes: asString(row.notes),
    fitmentLabel: asTrimmedString(row.fitmentLabel),
    createdAt,
    updatedAt,
  };
}

export function normalizeActivityEvent(value: unknown): VehicleActivityEvent | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const row = value as Partial<VehicleActivityEvent>;
  const id = asTrimmedString(row.id);
  const actorDisplayName = asTrimmedString(row.actorDisplayName) ?? 'Someone';
  const action = asTrimmedString(row.action);
  const summary = asTrimmedString(row.summary);
  const createdAt = asTrimmedString(row.createdAt);
  const entityType = row.entityType;
  if (
    !id ||
    !action ||
    !summary ||
    !createdAt ||
    typeof entityType !== 'string' ||
    !ACTIVITY_ENTITIES.has(entityType as VehicleActivityEntity)
  ) {
    return undefined;
  }
  return {
    id,
    actorUserId: asTrimmedString(row.actorUserId),
    actorDisplayName,
    action,
    entityType: entityType as VehicleActivityEntity,
    entityId: asTrimmedString(row.entityId),
    summary,
    meta:
      row.meta && typeof row.meta === 'object' && !Array.isArray(row.meta)
        ? (row.meta as Record<string, unknown>)
        : undefined,
    createdAt,
  };
}

export function normalizeMember(value: unknown): VehicleMember | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const row = value as Partial<VehicleMember>;
  const userId = asTrimmedString(row.userId);
  const displayName = asTrimmedString(row.displayName);
  const joinedAt = asTrimmedString(row.joinedAt);
  if (!userId || !displayName || !joinedAt) return undefined;
  return {
    userId,
    displayName,
    role: normalizeRole(row.role),
    joinedAt,
  };
}

export function normalizeInvite(value: unknown): VehicleInvite | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const row = value as Partial<VehicleInvite>;
  const id = asTrimmedString(row.id);
  const vehicleId = asTrimmedString(row.vehicleId);
  const inviteeEmail = asTrimmedString(row.inviteeEmail);
  const inviterDisplayName = asTrimmedString(row.inviterDisplayName);
  const createdAt = asTrimmedString(row.createdAt);
  if (!id || !vehicleId || !inviteeEmail || !inviterDisplayName || !createdAt) {
    return undefined;
  }
  return {
    id,
    vehicleId,
    inviteeEmail,
    inviterDisplayName,
    createdAt,
    expiresAt: asTrimmedString(row.expiresAt),
  };
}

function mapArray<T>(value: unknown, map: (item: unknown) => T | undefined): T[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    const next = map(item);
    return next ? [next] : [];
  });
}

export function normalizeVehicle(value: unknown): Vehicle | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const row = value as Partial<Vehicle>;
  const id = asTrimmedString(row.id);
  const nickname = asTrimmedString(row.nickname) ?? '';
  const createdAt = asTrimmedString(row.createdAt);
  const updatedAt = asTrimmedString(row.updatedAt);
  if (!id || !createdAt || !updatedAt) return undefined;
  const mode = row.mode === 'shared' ? 'shared' : 'private';
  return {
    id,
    nickname,
    year: asPositiveNumber(row.year),
    make: asTrimmedString(row.make),
    model: asTrimmedString(row.model),
    trim: asTrimmedString(row.trim),
    engine: asTrimmedString(row.engine),
    vin: asTrimmedString(row.vin)?.toUpperCase(),
    plate: asTrimmedString(row.plate)?.toUpperCase(),
    color: asTrimmedString(row.color),
    photoUri: asTrimmedString(row.photoUri),
    odometerMiles: asFiniteNonNegative(row.odometerMiles),
    odometerUpdatedAt: asTrimmedString(row.odometerUpdatedAt),
    baseCurrency: normalizeCurrency(row.baseCurrency),
    registration: normalizeRegistration(row.registration),
    insurance: normalizeInsurance(row.insurance),
    maintenanceSchedules: mapArray(row.maintenanceSchedules, normalizeMaintenanceSchedule),
    maintenanceLogs: mapArray(row.maintenanceLogs, normalizeMaintenanceLog),
    mileageLogs: mapArray(row.mileageLogs, normalizeMileageLog),
    expenses: mapArray(row.expenses, normalizeExpense),
    parts: mapArray(row.parts, normalizePart),
    activity: mapArray(row.activity, normalizeActivityEvent),
    mode,
    role: normalizeRole(row.role),
    members: mapArray(row.members, normalizeMember),
    invites: mapArray(row.invites, normalizeInvite),
    shareCode: asTrimmedString(row.shareCode),
    createdAt,
    updatedAt,
  };
}

export function normalizeVehicles(value: unknown): Vehicle[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    const next = normalizeVehicle(item);
    return next ? [next] : [];
  });
}

/** Private cloud blob excludes shared vehicles (live in relational tables). */
export function privateVehiclePayload(vehicles: Vehicle[]): Vehicle[] {
  return vehicles.filter((vehicle) => vehicle.mode === 'private');
}

/**
 * Restore private vehicles from the account cloud blob without duplicating a
 * vehicle that is already shared on this device. The shared copy is
 * authoritative — the same pattern checklists use for stale private rows.
 */
export function mergePrivateVehiclesFromCloud(
  current: Vehicle[],
  incoming: unknown,
): Vehicle[] {
  const shared = current.filter((vehicle) => vehicle.mode === 'shared');
  const sharedIds = new Set(shared.map((vehicle) => vehicle.id));
  const privateIncoming = normalizeVehicles(incoming).filter(
    (vehicle) => vehicle.mode !== 'shared' && !sharedIds.has(vehicle.id),
  );
  return [...shared, ...privateIncoming];
}
