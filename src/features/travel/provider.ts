import { openInAppBrowser } from '@/utils/safe-url';

export interface GoogleFlightComparison {
  origin: string;
  destination: string;
  departureDate: string;
  returnDate: string;
  adults: number;
  currencyCode?: string;
}

function normalizedLocation(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}

export function isValidFlightLocation(value: string): boolean {
  const location = normalizedLocation(value);
  return location.length >= 2 && /\p{L}/u.test(location);
}

export function googleFlightsSearchUrl(input: GoogleFlightComparison): string {
  const origin = normalizedLocation(input.origin);
  const destination = normalizedLocation(input.destination);
  if (!isValidFlightLocation(origin) || !isValidFlightLocation(destination)) {
    throw new Error('Google Flights comparisons require a From and To location.');
  }
  if (!Number.isInteger(input.adults) || input.adults < 1 || input.adults > 9) {
    throw new Error('Google Flights comparisons require 1–9 travelers.');
  }

  const travelerLabel = input.adults === 1 ? '1 adult' : `${input.adults} adults`;
  const query = [
    `Flights from ${origin} to ${destination}`,
    `from ${input.departureDate} through ${input.returnDate}`,
    `for ${travelerLabel}`,
  ].join(' ');
  const params = new URLSearchParams({ q: query, hl: 'en' });
  const currencyCode = input.currencyCode?.trim().toUpperCase();
  if (currencyCode && /^[A-Z]{3}$/.test(currencyCode)) params.set('curr', currencyCode);
  return `https://www.google.com/travel/flights?${params.toString()}`;
}

export async function compareOnGoogleFlights(input: GoogleFlightComparison): Promise<void> {
  await openInAppBrowser(googleFlightsSearchUrl(input));
}
