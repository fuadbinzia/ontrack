import type { AppIconName } from '@/design-system';
import {
  resolveHostelworldCity,
  type HostelworldCity,
} from '@/features/travel/stays/hostelworld-city';
import type { TravelPlan } from '@/features/travel/types';
import { openInAppBrowser } from '@/utils/safe-url';

export type StayProviderId = 'booking' | 'airbnb' | 'hostelworld';

export interface StaySearchInput {
  destination: string;
  checkIn: string;
  checkOut: string;
  guests: number;
}

export interface StayProvider {
  id: StayProviderId;
  name: string;
  description: string;
  icon: AppIconName;
  /** Public website domain used to resolve the live brand logo. */
  domain: string;
  searchUrl: (input: StaySearchInput) => string;
}

export {
  googleFaviconLogoUrl,
  lookupStayProviderLogoUrl,
  stayProviderLogoUrl,
} from '@/features/travel/stays/stay-provider-logo-lookup';

function addSearchParams(
  baseUrl: string,
  params: Record<string, string | number>,
): string {
  const url = new URL(baseUrl);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, String(value));
  }
  return url.toString();
}

export function bookingSearchUrl(input: StaySearchInput): string {
  return addSearchParams('https://www.booking.com/searchresults.html', {
    ss: input.destination,
    checkin: input.checkIn,
    checkout: input.checkOut,
    group_adults: input.guests,
    no_rooms: 1,
  });
}

export function airbnbSearchUrl(input: StaySearchInput): string {
  const destinationPath = encodeURIComponent(
    input.destination
      .split(',')
      .map((part) => part.trim().replace(/\s+/g, '-'))
      .filter(Boolean)
      .join('--'),
  );
  return addSearchParams(`https://www.airbnb.com/s/${destinationPath}/homes`, {
    checkin: input.checkIn,
    checkout: input.checkOut,
    adults: input.guests,
  });
}

/**
 * Hostelworld only honors dates on the dynamic `/pwa/s` results URL, which
 * needs a resolved city id (+ city/country names). Without a city, fall back
 * to the legacy hostels listing (destination/guests only — dates are ignored).
 */
export function hostelworldSearchUrl(
  input: StaySearchInput,
  city?: HostelworldCity | null,
): string {
  if (city) {
    return addSearchParams('https://www.hostelworld.com/pwa/s', {
      q: city.city,
      country: city.country,
      city: city.city,
      type: 'city',
      id: city.id,
      from: input.checkIn,
      to: input.checkOut,
      guests: input.guests,
      page: 1,
    });
  }

  return addSearchParams('https://www.hostelworld.com/hostels/', {
    q: input.destination,
    from: input.checkIn,
    to: input.checkOut,
    guests: input.guests,
  });
}

export async function resolveHostelworldSearchUrl(
  input: StaySearchInput,
): Promise<string> {
  const city = await resolveHostelworldCity(input.destination);
  return hostelworldSearchUrl(input, city);
}

export const stayProviders: StayProvider[] = [
  {
    id: 'booking',
    name: 'Booking.com',
    description: 'Hotels, apartments, resorts, villas, and more',
    icon: 'building',
    domain: 'booking.com',
    searchUrl: bookingSearchUrl,
  },
  {
    id: 'airbnb',
    name: 'Airbnb',
    description: 'Homes, rooms, unique stays, and local experiences',
    icon: 'home',
    domain: 'airbnb.com',
    searchUrl: airbnbSearchUrl,
  },
  {
    id: 'hostelworld',
    name: 'Hostelworld',
    description: 'Hostels, social stays, budget rooms, and shared spaces',
    icon: 'lodging',
    domain: 'hostelworld.com',
    searchUrl: hostelworldSearchUrl,
  },
];

export function staySearchInput(plan: TravelPlan): StaySearchInput {
  return {
    destination: plan.destination,
    checkIn: plan.startDate,
    checkOut: plan.endDate,
    guests: Math.max(1, plan.participants.length + 1),
  };
}

export async function searchStays(
  provider: StayProvider,
  plan: TravelPlan,
): Promise<void> {
  const input = staySearchInput(plan);
  const url =
    provider.id === 'hostelworld'
      ? await resolveHostelworldSearchUrl(input)
      : provider.searchUrl(input);
  await openInAppBrowser(url);
}
