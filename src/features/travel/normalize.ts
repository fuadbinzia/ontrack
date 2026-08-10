import { isDateKey } from '@/utils/date';
import { asPositiveNumber, asString } from '@/utils/parse';
import { normalizeCurrencyCode } from './expenses/format-money';
import { normalizeFlightDetails } from './flight-details';
import { withRoundTripFlightExpenseTitles } from './flight-expense-title';
import { normalizeTravelItemShareMode } from './itinerary-visibility';
import { normalizeRentalDetails } from './rental-details';
import { normalizeStayDetails } from './stay-details';
import { normalizeTransportDetails } from './transport-details';
import { TRAVEL_PLAN_MODE_VALUES } from './travel-mode';
import { normalizeTravelPhotoUris } from './travel-moment-media';
import type {
    TravelExpense,
    TravelExpenseCategory,
    TravelItemNote,
    TravelItineraryItem,
    TravelParticipant,
    TravelPlan,
} from './types';
import { TRAVEL_EXPENSE_HOST_ID, TRAVEL_EXPENSE_SELF_ID } from './types';

const EXPENSE_CATEGORIES = new Set<TravelExpenseCategory>([
  'flight',
  'stay',
  'food',
  'transport',
  'activity',
  'shopping',
  'other',
]);

const ITEM_KINDS = new Set([
  'flight',
  'transport',
  'stay',
  'activity',
  'rental',
  'moment',
]);
const DEFAULT_MOMENT_DURATION_MINUTES = 15;

export function normalizeTravelItineraryItem(
  value: unknown,
): TravelItineraryItem | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const item = value as Partial<TravelItineraryItem>;
  if (
    typeof item.id !== 'string' ||
    !ITEM_KINDS.has(item.kind as string) ||
    typeof item.date !== 'string' ||
    !isDateKey(item.date) ||
    typeof item.startMinutes !== 'number' ||
    !Number.isFinite(item.startMinutes) ||
    item.startMinutes < 0 ||
    item.startMinutes >= 24 * 60
  ) {
    return undefined;
  }

  const kind = item.kind as TravelItineraryItem['kind'];
  const isMoment = kind === 'moment';
  const rawTitle = typeof item.title === 'string' ? item.title.trim() : '';
  if (!isMoment && typeof item.title !== 'string') return undefined;

  let durationMinutes =
    typeof item.durationMinutes === 'number' && Number.isFinite(item.durationMinutes)
      ? item.durationMinutes
      : undefined;
  if (isMoment && (durationMinutes === undefined || durationMinutes <= 0)) {
    durationMinutes = DEFAULT_MOMENT_DURATION_MINUTES;
  }
  if (durationMinutes === undefined || durationMinutes <= 0) return undefined;

  const title = isMoment
    ? rawTitle || 'Moment'
    : kind === 'rental'
      ? capitalizeRentalTitle(item.title as string)
      : (item.title as string);

  const photoUris = normalizeTravelPhotoUris(item.photoUris);
  const notes = normalizeTravelItemNotes(item.notes);
  const shareMode = normalizeTravelItemShareMode(item.shareMode);
  const ownerUserId =
    typeof item.ownerUserId === 'string' && item.ownerUserId.trim()
      ? item.ownerUserId.trim()
      : undefined;
  const sharedUpdatedAt =
    typeof item.sharedUpdatedAt === 'string' && item.sharedUpdatedAt.trim()
      ? item.sharedUpdatedAt.trim()
      : undefined;

  return {
    id: item.id,
    kind,
    title,
    date: item.date,
    startMinutes: Math.round(item.startMinutes),
    durationMinutes: Math.round(durationMinutes),
    details: asString(item.details),
    bookingUrl: isMoment ? undefined : asString(item.bookingUrl),
    ...(photoUris ? { photoUris } : {}),
    ...(notes ? { notes } : {}),
    ...(ownerUserId ? { ownerUserId } : {}),
    shareMode,
    ...(sharedUpdatedAt ? { sharedUpdatedAt } : {}),
    flight: kind === 'flight' ? normalizeFlightDetails(item.flight) : undefined,
    transport:
      kind === 'transport' ? normalizeTransportDetails(item.transport) : undefined,
    rental: kind === 'rental' ? normalizeRentalDetails(item.rental) : undefined,
    stay: kind === 'stay' ? normalizeStayDetails(item.stay) : undefined,
  };
}

function normalizeTravelItemNotes(value: unknown): TravelItemNote[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const notes = value.flatMap((entry) => {
    if (!entry || typeof entry !== 'object') return [];
    const note = entry as Partial<TravelItemNote>;
    const body = typeof note.body === 'string' ? note.body.trim() : '';
    const authorName =
      typeof note.authorName === 'string' ? note.authorName.trim() : '';
    if (
      typeof note.id !== 'string' ||
      !body ||
      typeof note.authorId !== 'string' ||
      !authorName ||
      typeof note.createdAt !== 'string'
    ) {
      return [];
    }
    const updatedAt =
      typeof note.updatedAt === 'string' && note.updatedAt.trim()
        ? note.updatedAt.trim()
        : undefined;
    return [
      {
        id: note.id,
        body,
        authorId: note.authorId,
        authorName,
        createdAt: note.createdAt,
        ...(updatedAt ? { updatedAt } : {}),
      } satisfies TravelItemNote,
    ];
  });
  return notes.length ? notes : undefined;
}

function normalizeItineraryText(value: string | undefined): string {
  return (value ?? '').trim().toLowerCase();
}

function sameFlightItems(
a: TravelItineraryItem,
b: TravelItineraryItem,
): boolean {
  const left = a.flight;
  const right = b.flight;
  if (!left || !right) return false;
  const sameDate = a.date === b.date;
  const sameTime = a.startMinutes === b.startMinutes;
  const sameRoute =
    normalizeItineraryText(left.departureAirport) ===
      normalizeItineraryText(right.departureAirport) &&
    normalizeItineraryText(left.arrivalAirport) ===
      normalizeItineraryText(right.arrivalAirport);

  const leftCode = normalizeItineraryText(left.confirmationCode);
  const rightCode = normalizeItineraryText(right.confirmationCode);
  const leftNumber = normalizeItineraryText(left.flightNumber);
  const rightNumber = normalizeItineraryText(right.flightNumber);

  if (leftCode && rightCode && leftCode === rightCode) {
    const sameFlightNumber =
      Boolean(leftNumber) && Boolean(rightNumber) && leftNumber === rightNumber;
    return sameDate && (sameTime || sameRoute || sameFlightNumber);
  }

  if (
    leftNumber &&
    rightNumber &&
    leftNumber === rightNumber &&
    sameDate &&
    sameRoute
  ) {
    return true;
  }

  return sameDate && sameTime && sameRoute;
}

function sameRentalItems(
a: TravelItineraryItem,
b: TravelItineraryItem,
): boolean {
  const left = a.rental;
  const right = b.rental;
  if (!left || !right) return false;
  const leftCode = normalizeItineraryText(left.confirmationCode);
  const rightCode = normalizeItineraryText(right.confirmationCode);
  if (leftCode && leftCode === rightCode) return true;

  return (
    a.date === b.date &&
    a.startMinutes === b.startMinutes &&
    normalizeItineraryText(left.company) ===
      normalizeItineraryText(right.company)
  );
}

function sameTransportItems(
  a: TravelItineraryItem,
  b: TravelItineraryItem,
): boolean {
  const left = a.transport;
  const right = b.transport;
  if (!left || !right || left.mode !== right.mode) return false;
  const sameRoute =
    normalizeItineraryText(left.origin) === normalizeItineraryText(right.origin) &&
    normalizeItineraryText(left.destination) === normalizeItineraryText(right.destination);
  const leftCode = normalizeItineraryText(left.confirmationCode);
  const rightCode = normalizeItineraryText(right.confirmationCode);
  if (leftCode && rightCode && leftCode === rightCode) return true;
  return a.date === b.date && a.startMinutes === b.startMinutes && sameRoute;
}

function sameStayItems(
a: TravelItineraryItem,
b: TravelItineraryItem,
): boolean {
  const left = a.stay;
  const right = b.stay;
  if (!left || !right) return false;
  const leftCode = normalizeItineraryText(left.confirmationCode);
  const rightCode = normalizeItineraryText(right.confirmationCode);
  if (leftCode && leftCode === rightCode) return true;

  return (
    a.date === b.date &&
    a.startMinutes === b.startMinutes &&
    normalizeItineraryText(a.title) === normalizeItineraryText(b.title) &&
    normalizeItineraryText(left.checkoutDate) ===
      normalizeItineraryText(right.checkoutDate) &&
    left.checkoutMinutes === right.checkoutMinutes
  );
}

function sameBasicItem(a: TravelItineraryItem, b: TravelItineraryItem): boolean {
  return (
    a.date === b.date &&
    a.startMinutes === b.startMinutes &&
    a.durationMinutes === b.durationMinutes &&
    normalizeItineraryText(a.title) === normalizeItineraryText(b.title) &&
    normalizeItineraryText(a.bookingUrl) === normalizeItineraryText(b.bookingUrl) &&
    normalizeItineraryText(a.details) === normalizeItineraryText(b.details)
  );
}

export function isDuplicateItineraryItem(
a: TravelItineraryItem,
b: TravelItineraryItem,
): boolean {
  if (a.kind !== b.kind) return false;
  if (a.id === b.id) return true;
  switch (a.kind) {
    case 'flight':
      return sameFlightItems(a, b);
    case 'rental':
      return sameRentalItems(a, b);
    case 'transport':
      return sameTransportItems(a, b);
    case 'stay':
      return sameStayItems(a, b);
    default:
      return sameBasicItem(a, b);
  }
}

/** Title-case the kind word in rental itinerary titles (“Hertz Rental”). */
function capitalizeRentalTitle(title: string): string {
  return title
    .replace(/\bCar rental\b/g, 'Car Rental')
    .replace(/\b rental\b/g, ' Rental');
}

export function normalizeTravelItinerary(value: unknown): TravelItineraryItem[] {
  if (!Array.isArray(value)) return [];
  const normalized = value.flatMap((item) => {
    const entry = normalizeTravelItineraryItem(item);
    return entry ? [entry] : [];
  });

  const deduped: TravelItineraryItem[] = [];
  for (const item of normalized) {
    const isDuplicate = deduped.some((existing) => isDuplicateItineraryItem(existing, item));
    if (!isDuplicate) {
      deduped.push(item);
    }
  }
  return deduped;
}

/**
 * Early Icelandair AB2ZQV imports flipped the return leg to EWR → KEF (and
 * sometimes used Sep 13). Confirmation: FI 623 KEF 5:00 PM → EWR 7:15 PM on Sep 14.
 */
function repairLegacyIcelandairRoundTripImport(
  itinerary: TravelItineraryItem[],
): { itinerary: TravelItineraryItem[]; correctedEndDate?: string } {
  let correctedEndDate: string | undefined;
  const next = itinerary.map((item) => {
    if (
      item.kind !== 'flight' ||
      item.flight?.flightNumber !== 'FI 623' ||
      item.flight.departureAirport !== 'EWR' ||
      item.flight.arrivalAirport !== 'KEF' ||
      item.startMinutes !== 17 * 60 ||
      item.durationMinutes !== 6 * 60 + 15 ||
      (item.date !== '2026-09-13' && item.date !== '2026-09-14')
    ) {
      return item;
    }
    correctedEndDate = '2026-09-14';
    return {
      ...item,
      title: 'Flight KEF → EWR',
      date: '2026-09-14',
      flight: {
        ...item.flight,
        departureAirport: 'KEF',
        arrivalAirport: 'EWR',
      },
    };
  });
  return { itinerary: next, correctedEndDate };
}

/** Ground truth from Hertz confirmation L666EBA86A0 (Compact Elite · KEF). */
const HERTZ_L666_PICKUP_MINUTES = 6 * 60 + 30;
const HERTZ_L666_DROPOFF_MINUTES = 15 * 60;

/**
 * Early Hertz OCR imports stole flight times, dropped drop-off, or used
 * incorrect placeholder pickup/drop-off times. Align L666EBA86A0 to the
 * confirmation: Sep 09 6:30 AM → Sep 14 3:00 PM at KEF.
 */
function repairLegacyHertzRentalImport(
  itinerary: TravelItineraryItem[],
): TravelItineraryItem[] {
  return itinerary.map((item) => {
    if (
      item.kind !== 'rental' ||
      item.rental?.confirmationCode !== 'L666EBA86A0'
    ) {
      return item;
    }
    const alreadyCorrect =
      item.date === '2026-09-09' &&
      item.startMinutes === HERTZ_L666_PICKUP_MINUTES &&
      item.rental.dropoffDate === '2026-09-14' &&
      item.rental.dropoffMinutes === HERTZ_L666_DROPOFF_MINUTES &&
      Boolean(item.rental.pickupLocation) &&
      Boolean(item.rental.dropoffLocation);
    if (alreadyCorrect) {
      const title = capitalizeRentalTitle(item.title);
      return title === item.title ? item : { ...item, title };
    }
    return {
      ...item,
      title: 'Hertz Rental · Keflavik International Airport (KEF)',
      date: '2026-09-09',
      startMinutes: HERTZ_L666_PICKUP_MINUTES,
      durationMinutes: 60,
      rental: {
        ...item.rental,
        company: 'Hertz',
        confirmationCode: 'L666EBA86A0',
        pickupLocation: 'Keflavik International Airport (KEF)',
        dropoffLocation: 'Keflavik International Airport (KEF)',
        vehicleClass: item.rental.vehicleClass ?? 'Compact Elite',
        dropoffDate: '2026-09-14',
        dropoffMinutes: HERTZ_L666_DROPOFF_MINUTES,
      },
    };
  });
}

export function normalizeTravelParticipants(value: unknown): TravelParticipant[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((candidate) => {
    if (!candidate || typeof candidate !== 'object') return [];
    const participant = candidate as Partial<TravelParticipant>;
    if (
      typeof participant.id !== 'string' ||
      typeof participant.name !== 'string' ||
      !participant.name.trim() ||
      typeof participant.inviteCode !== 'string' ||
      !/^[a-f0-9]{20}$/.test(participant.inviteCode) ||
      typeof participant.invitedAt !== 'string'
    ) {
      return [];
    }
    return [{
      id: participant.id,
      name: participant.name.trim(),
      email: asString(participant.email)?.trim() || undefined,
      inviteCode: participant.inviteCode,
      invitedAt: participant.invitedAt,
      acceptedAt: asString(participant.acceptedAt),
    }];
  });
}

function normalizeExpenseCategory(value: unknown): TravelExpenseCategory | undefined {
  return typeof value === 'string' && EXPENSE_CATEGORIES.has(value as TravelExpenseCategory)
    ? (value as TravelExpenseCategory)
    : undefined;
}

export function normalizeTravelExpense(
  value: unknown,
  participantIds: Set<string>,
): TravelExpense | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const expense = value as Partial<TravelExpense>;
  const amount = asPositiveNumber(expense.amount);
  const category = normalizeExpenseCategory(expense.category);
  const currency = normalizeCurrencyCode(expense.currency, '');
  if (
    typeof expense.id !== 'string' ||
    typeof expense.title !== 'string' ||
    !expense.title.trim() ||
    amount === undefined ||
    !currency ||
    typeof expense.date !== 'string' ||
    !isDateKey(expense.date) ||
    !category ||
    typeof expense.paidById !== 'string'
  ) {
    return undefined;
  }

  const allowedPayer =
    expense.paidById === TRAVEL_EXPENSE_SELF_ID ||
    expense.paidById === TRAVEL_EXPENSE_HOST_ID ||
    expense.paidById.startsWith('member:') ||
    participantIds.has(expense.paidById);
  if (!allowedPayer) return undefined;

  const splitWithIds = Array.isArray(expense.splitWithIds)
    ? expense.splitWithIds.filter(
        (id): id is string =>
          typeof id === 'string' &&
          (id === TRAVEL_EXPENSE_SELF_ID ||
            id === TRAVEL_EXPENSE_HOST_ID ||
            id.startsWith('member:') ||
            participantIds.has(id)),
      )
    : [];
  const resolvedSplit = splitWithIds.length > 0 ? [...new Set(splitWithIds)] : [expense.paidById];
  const fallbackTimestamp = new Date().toISOString();

  return {
    id: expense.id,
    title: expense.title.trim(),
    amount,
    currency,
    date: expense.date,
    category,
    notes: asString(expense.notes)?.trim() || undefined,
    paidById: expense.paidById,
    splitWithIds: resolvedSplit,
    createdAt: asString(expense.createdAt) ?? asString(expense.updatedAt) ?? fallbackTimestamp,
    updatedAt: asString(expense.updatedAt) ?? asString(expense.createdAt) ?? fallbackTimestamp,
    travelItemId: asString(expense.travelItemId)?.trim() || undefined,
  };
}

export function normalizeTravelExpenses(
  value: unknown,
  participants: TravelParticipant[],
  sharedPeople?: { id: string; name: string }[],
): TravelExpense[] {
  if (!Array.isArray(value)) return [];
  const participantIds = new Set(participants.map((p) => p.id));
  for (const person of sharedPeople ?? []) {
    if (person.id) participantIds.add(person.id);
  }
  return value.flatMap((item) => {
    const normalized = normalizeTravelExpense(item, participantIds);
    return normalized ? [normalized] : [];
  });
}

/**
 * True member copies never keep `openJoinCode` (invite decode leaves it empty;
 * host transfer clears it). A plan with both member chat access and a host
 * open-join code was mis-tagged as someone else’s trip — restore host ownership.
 */
export function repairMisattributedTravelHostPlan<T extends Partial<TravelPlan>>(
  plan: T,
): T {
  const openJoin =
    typeof plan.openJoinCode === 'string' &&
    /^[a-f0-9]{20}$/.test(plan.openJoinCode);
  const chat =
    typeof plan.chatAccessCode === 'string' &&
    /^[a-f0-9]{20}$/.test(plan.chatAccessCode);
  if (!openJoin || !chat || typeof plan.id !== 'string') return plan;

  const sharedExpensePeople = Array.isArray(plan.sharedExpensePeople)
    ? plan.sharedExpensePeople.filter(
        (person) => person && typeof person === 'object' && person.id !== 'host',
      )
    : plan.sharedExpensePeople;

  return {
    ...plan,
    chatAccessCode: undefined,
    hostTripId: plan.id,
    hostDisplayName: undefined,
    ...(sharedExpensePeople ? { sharedExpensePeople } : {}),
  };
}

export function normalizeTravelPlan(value: unknown): TravelPlan | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const plan = repairMisattributedTravelHostPlan(value as Partial<TravelPlan>);
  if (
    typeof plan.id !== 'string' ||
    typeof plan.title !== 'string' ||
    typeof plan.destination !== 'string' ||
    typeof plan.startDate !== 'string' ||
    typeof plan.endDate !== 'string' ||
    !isDateKey(plan.startDate) ||
    !isDateKey(plan.endDate)
  ) {
    return undefined;
  }
  const fallbackTimestamp = new Date().toISOString();
  const repairedImport = repairLegacyIcelandairRoundTripImport(
    normalizeTravelItinerary(plan.itinerary),
  );
  const itinerary = repairLegacyHertzRentalImport(repairedImport.itinerary);
  const participants = normalizeTravelParticipants(plan.participants);
  return withRoundTripFlightExpenseTitles({
    id: plan.id,
    ...(typeof plan.chatAccessCode === 'string' &&
    /^[a-f0-9]{20}$/.test(plan.chatAccessCode)
      ? { chatAccessCode: plan.chatAccessCode }
      : {}),
    ...(typeof plan.openJoinCode === 'string' &&
    /^[a-f0-9]{20}$/.test(plan.openJoinCode)
      ? { openJoinCode: plan.openJoinCode }
      : {}),
    ...(typeof plan.hostTripId === 'string' && plan.hostTripId.trim()
      ? { hostTripId: plan.hostTripId.trim() }
      : {}),
    ...(typeof plan.hostDisplayName === 'string' && plan.hostDisplayName.trim()
      ? { hostDisplayName: plan.hostDisplayName.trim() }
      : {}),
    ...(() => {
      if (!Array.isArray(plan.sharedExpensePeople)) return {};
      const sharedExpensePeople = plan.sharedExpensePeople.flatMap((row) => {
        if (!row || typeof row !== 'object') return [];
        const id = typeof row.id === 'string' ? row.id.trim() : '';
        const name = typeof row.name === 'string' ? row.name.trim() : '';
        return id && name ? [{ id, name }] : [];
      });
      return sharedExpensePeople.length > 0 ? { sharedExpensePeople } : {};
    })(),
    ...(typeof plan.sharedExpensesUpdatedAt === 'string' && plan.sharedExpensesUpdatedAt.trim()
      ? { sharedExpensesUpdatedAt: plan.sharedExpensesUpdatedAt.trim() }
      : {}),
    title: plan.title,
    mode: TRAVEL_PLAN_MODE_VALUES.has(plan.mode as NonNullable<TravelPlan['mode']>)
      ? (plan.mode as NonNullable<TravelPlan['mode']>)
      : 'flight',
    ...(asString(plan.origin)?.trim()
      ? { origin: asString(plan.origin)!.trim() }
      : {}),
    destination: plan.destination,
    startDate: plan.startDate,
    endDate:
      repairedImport.correctedEndDate &&
      repairedImport.correctedEndDate > plan.endDate
        ? repairedImport.correctedEndDate
        : plan.endDate,
    notes: asString(plan.notes),
    ...(() => {
      const rawCovers: string[] = [];
      const pushCover = (value: string) => {
        const trimmed = value.trim();
        if (!trimmed) return;
        if (rawCovers.some((entry) => entry === trimmed)) return;
        rawCovers.push(trimmed);
      };
      if (Array.isArray(plan.coverUris)) {
        for (const entry of plan.coverUris) {
          if (typeof entry === 'string') pushCover(entry);
        }
      }
      if (typeof plan.coverUri === 'string') pushCover(plan.coverUri);
      const coverUris = normalizeTravelPhotoUris(rawCovers)?.slice(0, 3);
      if (!coverUris?.length) return {};
      return { coverUris, coverUri: coverUris[0] };
    })(),
    itinerary,
    participants,
    baseCurrency: normalizeCurrencyCode(plan.baseCurrency),
    expenses: normalizeTravelExpenses(
      plan.expenses,
      participants,
      Array.isArray(plan.sharedExpensePeople) ? plan.sharedExpensePeople : undefined,
    ),
    createdAt: asString(plan.createdAt) ?? asString(plan.updatedAt) ?? fallbackTimestamp,
    updatedAt: asString(plan.updatedAt) ?? asString(plan.createdAt) ?? fallbackTimestamp,
  });
}

export function normalizeTravelPlans(value: unknown): TravelPlan[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((plan) => {
    const normalized = normalizeTravelPlan(plan);
    return normalized ? [normalized] : [];
  });
}
