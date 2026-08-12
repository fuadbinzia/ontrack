import { Dropdown, type DropdownProps } from '@/components/primitives';
import { getNumberFormatter } from '@/utils/intl-cache';

import { normalizeCurrencyCode } from './format-money';

/** Display names for Frankfurter v1 currencies. */
export const CURRENCY_LABELS: Record<string, string> = {
  AUD: 'Australian Dollar',
  BRL: 'Brazilian Real',
  CAD: 'Canadian Dollar',
  CHF: 'Swiss Franc',
  CNY: 'Chinese Yuan',
  CZK: 'Czech Koruna',
  DKK: 'Danish Krone',
  EUR: 'Euro',
  GBP: 'British Pound',
  HKD: 'Hong Kong Dollar',
  HUF: 'Hungarian Forint',
  IDR: 'Indonesian Rupiah',
  ILS: 'Israeli Shekel',
  INR: 'Indian Rupee',
  ISK: 'Icelandic Króna',
  JPY: 'Japanese Yen',
  KRW: 'South Korean Won',
  MXN: 'Mexican Peso',
  MYR: 'Malaysian Ringgit',
  NOK: 'Norwegian Krone',
  NZD: 'New Zealand Dollar',
  PHP: 'Philippine Peso',
  PLN: 'Polish Złoty',
  RON: 'Romanian Leu',
  SEK: 'Swedish Krona',
  SGD: 'Singapore Dollar',
  THB: 'Thai Baht',
  TRY: 'Turkish Lira',
  USD: 'US Dollar',
  ZAR: 'South African Rand',
};

export function currencyDisplayLabel(code: string): string {
  const normalized = normalizeCurrencyCode(code);
  const name = CURRENCY_LABELS[normalized];
  return name ? `${normalized} · ${name}` : normalized;
}

/** ISO 3166-1 alpha-2 used for flag emoji (best-effort for FX codes). */
const CURRENCY_FLAG_REGION: Record<string, string> = {
  AUD: 'AU',
  BRL: 'BR',
  CAD: 'CA',
  CHF: 'CH',
  CNY: 'CN',
  CZK: 'CZ',
  DKK: 'DK',
  EUR: 'EU',
  GBP: 'GB',
  HKD: 'HK',
  HUF: 'HU',
  IDR: 'ID',
  ILS: 'IL',
  INR: 'IN',
  ISK: 'IS',
  JPY: 'JP',
  KRW: 'KR',
  MXN: 'MX',
  MYR: 'MY',
  NOK: 'NO',
  NZD: 'NZ',
  PHP: 'PH',
  PLN: 'PL',
  RON: 'RO',
  SEK: 'SE',
  SGD: 'SG',
  THB: 'TH',
  TRY: 'TR',
  USD: 'US',
  ZAR: 'ZA',
};

export function currencyFlagEmoji(code: string): string {
  const region = CURRENCY_FLAG_REGION[normalizeCurrencyCode(code)];
  if (!region) return '🏳️';
  if (region === 'EU') return '🇪🇺';
  const base = 0x1f1e6;
  return String.fromCodePoint(
    ...[...region].map((char) => base + char.charCodeAt(0) - 65),
  );
}

/** Narrow currency glyph for circular badges ($ / € / kr). */
const CURRENCY_NARROW_SYMBOL: Record<string, string> = {
  AUD: '$',
  BRL: 'R$',
  CAD: '$',
  CHF: 'Fr',
  CNY: '¥',
  CZK: 'Kč',
  DKK: 'kr',
  EUR: '€',
  GBP: '£',
  HKD: '$',
  HUF: 'Ft',
  IDR: 'Rp',
  ILS: '₪',
  INR: '₹',
  ISK: 'kr',
  JPY: '¥',
  KRW: '₩',
  MXN: '$',
  MYR: 'RM',
  NOK: 'kr',
  NZD: '$',
  PHP: '₱',
  PLN: 'zł',
  RON: 'lei',
  SEK: 'kr',
  SGD: '$',
  THB: '฿',
  TRY: '₺',
  USD: '$',
  ZAR: 'R',
};

export function currencyNarrowSymbol(code: string): string {
  const normalized = normalizeCurrencyCode(code);
  if (CURRENCY_NARROW_SYMBOL[normalized]) return CURRENCY_NARROW_SYMBOL[normalized];
  try {
    const part = getNumberFormatter('en', {
      style: 'currency',
      currency: normalized,
      currencyDisplay: 'narrowSymbol',
    })
      .formatToParts(0)
      .find((entry) => entry.type === 'currency');
    if (part?.value && part.value !== normalized) return part.value;
  } catch {
    // fall through
  }
  return normalized;
}

/** Overlay dropdown (scrollable options). Prefer over inline push menus. */
export function ScrollableDropdown(props: DropdownProps) {
  return <Dropdown {...props} />;
}

export function CurrencyDropdown({
  label,
  value,
  options,
  onChange,
  open,
  onOpenChange,
  ...chromeProps
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (currency: string) => void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
} & Pick<
  DropdownProps,
  'icon' | 'iconBackground' | 'iconColor' | 'fieldBackground' | 'labelColor' | 'testID'
>) {
  return (
    <Dropdown
      label={label}
      value={normalizeCurrencyCode(value)}
      options={options}
      onChange={onChange}
      open={open}
      onOpenChange={onOpenChange}
      {...chromeProps}
    />
  );
}
