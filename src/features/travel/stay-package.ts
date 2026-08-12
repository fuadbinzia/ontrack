import type { StayPackage } from '@/services/partner/types';
import { STAY_PACKAGE_VERSION } from '@/services/partner/types';
import { isDateKey } from '@/utils/date';
import { newId } from '@/utils/id';
import { asFiniteNumber, asTrimmedString } from '@/utils/parse';
import { isHttpsUrl } from '@/utils/safe-url';

import type { TravelItineraryItem, TravelPlan, TravelStayDetails } from './types';

function optionalMinutes(value: unknown): number | undefined {
  const rounded = asFiniteNumber(value);
  if (rounded === undefined) return undefined;
  const minutes = Math.round(rounded);
  if (minutes < 0 || minutes > 24 * 60) return undefined;
  return minutes;
}

export function normalizeStayPackage(input: unknown): StayPackage | undefined {
  if (!input || typeof input !== 'object') return undefined;
  const raw = input as Record<string, unknown>;
  const propertyName = asTrimmedString(raw.propertyName);
  const checkInDate = asTrimmedString(raw.checkInDate);
  if (!propertyName || !checkInDate || !isDateKey(checkInDate)) return undefined;
  const checkOutDate = asTrimmedString(raw.checkOutDate);
  if (checkOutDate && !isDateKey(checkOutDate)) return undefined;
  const bookingUrl = asTrimmedString(raw.bookingUrl);
  if (bookingUrl && !isHttpsUrl(bookingUrl)) return undefined;
  const updatedAt = asTrimmedString(raw.updatedAt) || new Date().toISOString();
  return {
    version: STAY_PACKAGE_VERSION,
    updatedAt,
    propertyName,
    address: asTrimmedString(raw.address),
    checkInDate,
    checkOutDate,
    checkInMinutes: optionalMinutes(raw.checkInMinutes),
    checkOutMinutes: optionalMinutes(raw.checkOutMinutes),
    confirmationCode: asTrimmedString(raw.confirmationCode),
    guestDisplayName: asTrimmedString(raw.guestDisplayName),
    bookingUrl,
    notes: asTrimmedString(raw.notes),
    ontrackPlanId: asTrimmedString(raw.ontrackPlanId),
    ontrackItemId: asTrimmedString(raw.ontrackItemId),
    straiawayPropertyId: asTrimmedString(raw.straiawayPropertyId),
    straiawayReservationId: asTrimmedString(raw.straiawayReservationId),
  };
}

export function stayPackageKey(pkg: StayPackage) {
  return pkg.ontrackItemId || pkg.straiawayReservationId || `${pkg.propertyName}:${pkg.checkInDate}`;
}

export function stayItemToPackage(
  plan: TravelPlan,
  item: TravelItineraryItem,
  guestDisplayName?: string,
): StayPackage | undefined {
  if (item.kind !== 'stay') return undefined;
  return normalizeStayPackage({
    version: STAY_PACKAGE_VERSION,
    updatedAt: item.sharedUpdatedAt || plan.updatedAt,
    propertyName: item.title,
    address: item.details,
    checkInDate: item.date,
    checkOutDate: item.stay?.checkoutDate,
    checkInMinutes: item.startMinutes,
    checkOutMinutes: item.stay?.checkoutMinutes,
    confirmationCode: item.stay?.confirmationCode,
    guestDisplayName,
    bookingUrl: item.bookingUrl,
    notes: item.stay?.notes,
    ontrackPlanId: plan.id,
    ontrackItemId: item.id,
    straiawayPropertyId: item.stay?.straiawayPropertyId,
    straiawayReservationId: item.stay?.straiawayReservationId,
  });
}

export function stayPackagesFromPlan(plan: TravelPlan, guestDisplayName?: string): StayPackage[] {
  return plan.itinerary
    .map((item) => stayItemToPackage(plan, item, guestDisplayName))
    .filter((pkg): pkg is StayPackage => Boolean(pkg));
}

function stayDetailsFromPackage(pkg: StayPackage, current?: TravelStayDetails): TravelStayDetails {
  return {
    ...current,
    confirmationCode: pkg.confirmationCode ?? current?.confirmationCode,
    checkoutDate: pkg.checkOutDate ?? current?.checkoutDate,
    checkoutMinutes: pkg.checkOutMinutes ?? current?.checkoutMinutes,
    notes: pkg.notes ?? current?.notes,
    straiawayPropertyId: pkg.straiawayPropertyId ?? current?.straiawayPropertyId,
    straiawayReservationId: pkg.straiawayReservationId ?? current?.straiawayReservationId,
  };
}

function findMatchingStay(plan: TravelPlan, pkg: StayPackage): TravelItineraryItem | undefined {
  if (pkg.ontrackItemId) {
    const byId = plan.itinerary.find((item) => item.id === pkg.ontrackItemId && item.kind === 'stay');
    if (byId) return byId;
  }
  if (pkg.straiawayReservationId) {
    const byReservation = plan.itinerary.find(
      (item) => item.kind === 'stay' && item.stay?.straiawayReservationId === pkg.straiawayReservationId,
    );
    if (byReservation) return byReservation;
  }
  return plan.itinerary.find(
    (item) =>
      item.kind === 'stay' &&
      item.title.trim().toLowerCase() === pkg.propertyName.trim().toLowerCase() &&
      item.date === pkg.checkInDate,
  );
}

function stayItemFromPackage(pkg: StayPackage, plan: TravelPlan): TravelItineraryItem {
  return {
    id: pkg.ontrackItemId || newId('stay'),
    kind: 'stay',
    title: pkg.propertyName,
    date: pkg.checkInDate,
    startMinutes: pkg.checkInMinutes ?? 16 * 60,
    durationMinutes: 12 * 60,
    details: pkg.address,
    bookingUrl: pkg.bookingUrl,
    stay: stayDetailsFromPackage(pkg),
    sharedUpdatedAt: pkg.updatedAt,
  };
}

function packageNewerThan(pkg: StayPackage, item: TravelItineraryItem, plan: TravelPlan) {
  const local = Date.parse(item.sharedUpdatedAt || plan.updatedAt || '');
  const incoming = Date.parse(pkg.updatedAt);
  if (!Number.isFinite(incoming)) return false;
  if (!Number.isFinite(local)) return true;
  return incoming >= local;
}

/** Merge StayPackages into a plan. Returns undefined when nothing changed. */
export function applyStayPackagesToPlan(plan: TravelPlan, packages: StayPackage[]): TravelPlan | undefined {
  const normalized = packages
    .map(normalizeStayPackage)
    .filter((pkg): pkg is StayPackage => Boolean(pkg))
    .filter((pkg) => !pkg.ontrackPlanId || pkg.ontrackPlanId === plan.id);
  if (!normalized.length) return undefined;

  let changed = false;
  const itinerary = [...plan.itinerary];
  for (const pkg of normalized) {
    const existing = findMatchingStay({ ...plan, itinerary }, pkg);
    if (!existing) {
      itinerary.push(stayItemFromPackage(pkg, plan));
      changed = true;
      continue;
    }
    if (!packageNewerThan(pkg, existing, plan)) continue;
    const next: TravelItineraryItem = {
      ...existing,
      title: pkg.propertyName,
      date: pkg.checkInDate,
      startMinutes: pkg.checkInMinutes ?? existing.startMinutes,
      details: pkg.address ?? existing.details,
      bookingUrl: pkg.bookingUrl ?? existing.bookingUrl,
      stay: stayDetailsFromPackage(pkg, existing.stay),
      sharedUpdatedAt: pkg.updatedAt,
    };
    const index = itinerary.findIndex((item) => item.id === existing.id);
    itinerary[index] = next;
    changed = true;
  }
  if (!changed) return undefined;
  return { ...plan, itinerary, updatedAt: new Date().toISOString() };
}
