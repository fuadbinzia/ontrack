import type { TravelItineraryItem } from './types';

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
