import { isDateKey } from '@/utils/date';
import { asString } from '@/utils/parse';
import { normalizeCurrencyCode } from './expenses/format-money';
import { normalizeFlightDetails } from './flight-details';
import { withRoundTripFlightExpenseTitles } from './flight-expense-title';
import { normalizeTravelItemShareMode } from './itinerary-visibility';
import { isDuplicateItineraryItem } from './normalize-duplicates';
import {
  normalizeTravelExpenses,
  normalizeTravelParticipants,
  repairMisattributedTravelHostPlan,
} from './normalize-expenses';
import {
  capitalizeRentalTitle,
  repairLegacyHertzRentalImport,
  repairLegacyIcelandairRoundTripImport,
} from './normalize-legacy';
import { normalizeRentalDetails } from './rental-details';
import { normalizeStayDetails } from './stay-details';
import { normalizeTransportDetails } from './transport-details';
import { TRAVEL_PLAN_MODE_VALUES } from './travel-mode';
import { normalizeTravelPhotoUris } from './travel-moment-media';
import type {
  TravelItemNote,
  TravelItineraryItem,
  TravelPlan,
} from './types';

export { isDuplicateItineraryItem } from './normalize-duplicates';
export {
  normalizeTravelExpense,
  normalizeTravelExpenses,
  normalizeTravelParticipants,
  repairMisattributedTravelHostPlan,
} from './normalize-expenses';

const ITEM_KINDS = new Set([
  'flight',
  'transport',
  'stay',
  'activity',
  'rental',
  'moment',
  'event',
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
