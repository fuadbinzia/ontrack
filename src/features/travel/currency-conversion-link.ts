import {
  getDisplayNamesFormatter,
  getIntlLocale,
} from '@/utils/intl-cache';

function regionCodeForLocale(locale: string): string | undefined {
  if (!locale || locale === 'system') return undefined;

  try {
    return getIntlLocale(locale.replace('_', '-')).maximize().region;
  } catch {
    return locale.match(/[-_]([A-Za-z]{2}|\d{3})(?:$|[-_])/)?.[1]?.toUpperCase();
  }
}

export function homeCountryForLocale(locale: string): string {
  const regionCode = regionCodeForLocale(locale);
  if (!regionCode) return 'my home country';

  try {
    return getDisplayNamesFormatter(['en'], { type: 'region' }).of(regionCode) ?? regionCode;
  } catch {
    return regionCode;
  }
}

export function googleCurrencyConversionUrl(
  destination: string,
  homeLocale: string,
): string {
  const homeCountry = homeCountryForLocale(homeLocale);
  const url = new URL('https://www.google.com/search');
  url.searchParams.set(
    'q',
    `${homeCountry} currency to ${destination.trim()} currency converter`,
  );
  return url.toString();
}
