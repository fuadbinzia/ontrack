import { getIntlLocale, getNumberFormatter } from '@/utils/intl-cache';

/** Format a money amount with Intl; falls back to code + number. */
export function formatMoney(
  amount: number,
  currency: string,
  locale?: string,
): string {
  const code = currency.trim().toUpperCase();
  if (!Number.isFinite(amount) || !/^[A-Z]{3}$/.test(code)) {
    return `${code || '?'} ${amount}`;
  }
  try {
    return getNumberFormatter(locale, {
      style: 'currency',
      currency: code,
      maximumFractionDigits: code === 'ISK' || code === 'JPY' || code === 'KRW' ? 0 : 2,
    }).format(amount);
  } catch {
    return `${code} ${Math.round(amount * 100) / 100}`;
  }
}

const REGION_CURRENCY: Record<string, string> = {
  US: 'USD',
  GB: 'GBP',
  CA: 'CAD',
  AU: 'AUD',
  NZ: 'NZD',
  EU: 'EUR',
  DE: 'EUR',
  FR: 'EUR',
  ES: 'EUR',
  IT: 'EUR',
  NL: 'EUR',
  IE: 'EUR',
  PT: 'EUR',
  AT: 'EUR',
  BE: 'EUR',
  FI: 'EUR',
  IS: 'ISK',
  SE: 'SEK',
  NO: 'NOK',
  DK: 'DKK',
  CH: 'CHF',
  JP: 'JPY',
  KR: 'KRW',
  CN: 'CNY',
  HK: 'HKD',
  SG: 'SGD',
  IN: 'INR',
  MX: 'MXN',
  BR: 'BRL',
  ZA: 'ZAR',
  PL: 'PLN',
  CZ: 'CZK',
  HU: 'HUF',
  RO: 'RON',
  TR: 'TRY',
  TH: 'THB',
  MY: 'MYR',
  ID: 'IDR',
  PH: 'PHP',
  IL: 'ILS',
};

/** Best-effort home currency from a BCP-47 locale. */
export function currencyFromLocale(locale: string, fallback = 'USD'): string {
  try {
    const region = getIntlLocale(locale).maximize().region?.toUpperCase();
    if (region && REGION_CURRENCY[region]) return REGION_CURRENCY[region];
  } catch {
    // ignore
  }
  const tail = locale.split(/[-_]/).pop()?.toUpperCase();
  if (tail && REGION_CURRENCY[tail]) return REGION_CURRENCY[tail];
  return fallback;
}

export function normalizeCurrencyCode(value: unknown, fallback = 'USD'): string {
  if (typeof value !== 'string') return fallback;
  const code = value.trim().toUpperCase();
  return /^[A-Z]{3}$/.test(code) ? code : fallback;
}
