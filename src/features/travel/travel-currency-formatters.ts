import {
  getDateTimeFormatter,
  getNumberFormatter,
} from '@/utils/intl-cache';

export function formatAmountInput(amount: number): string {
  if (!Number.isFinite(amount)) return '';
  const rounded = Math.round(amount * 100) / 100;
  try {
    return getNumberFormatter('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(rounded);
  } catch {
    return rounded.toFixed(2);
  }
}

/** FX unit rates — keep enough digits so displayed rate × amount matches money rounding. */
export function formatRateInput(rate: number): string {
  if (!Number.isFinite(rate) || !(rate > 0)) return '';
  try {
    return getNumberFormatter('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 6,
      useGrouping: false,
    }).format(rate);
  } catch {
    const fixed = rate.toFixed(6);
    return fixed.replace(/(\.\d*?[1-9])0+$/, '$1').replace(/\.00$/, '.00');
  }
}

export function parseAmountText(text: string): number | undefined {
  const cleaned = text.replace(/,/g, '').trim();
  if (!cleaned) return undefined;
  const value = Number(cleaned);
  return Number.isFinite(value) && value >= 0 ? value : undefined;
}

/** `unitRate` is destination units per 1 origin unit. */
export function convertWithUnitRate(
  amountText: string,
  from: string,
  to: string,
  originCurrency: string,
  destinationCurrency: string,
  unitRate: number,
): string {
  const amount = parseAmountText(amountText);
  if (amount === undefined || !(unitRate > 0)) return '';
  if (from === to) return formatAmountInput(amount);
  if (from === originCurrency && to === destinationCurrency) {
    return formatAmountInput(amount * unitRate);
  }
  if (from === destinationCurrency && to === originCurrency) {
    return formatAmountInput(amount / unitRate);
  }
  return '';
}

export function formatFxMoney(amount: number, currency: string, locale?: string): string {
  const code = currency.trim().toUpperCase();
  if (!Number.isFinite(amount) || !/^[A-Z]{3}$/.test(code)) {
    return `${code || '?'} ${formatAmountInput(amount)}`;
  }
  try {
    return getNumberFormatter(locale === 'system' ? undefined : locale, {
      style: 'currency',
      currency: code,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${code} ${formatAmountInput(amount)}`;
  }
}

export function formatRateDate(date: string, locale?: string): string {
  try {
    return getDateTimeFormatter(locale === 'system' ? undefined : locale, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }).format(new Date(`${date}T12:00:00`));
  } catch {
    return date;
  }
}

export function formatPlainAmount(amount: number, locale?: string): string {
  try {
    return getNumberFormatter(locale === 'system' ? undefined : locale, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return formatAmountInput(amount);
  }
}
