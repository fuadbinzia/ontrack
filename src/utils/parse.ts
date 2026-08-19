/** Exact string values (including whitespace-only). */
export function asString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

/** Trimmed non-empty string. */
export function asTrimmedString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

/** Truthy trimmed string without normalizing internal whitespace. */
export function asNonEmptyString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value : undefined;
}

export function asFiniteNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

/** First matching string in `allowed`, otherwise undefined. */
export function asOneOf<T extends string>(
  value: unknown,
  allowed: readonly T[],
): T | undefined {
  return typeof value === 'string' && (allowed as readonly string[]).includes(value)
    ? (value as T)
    : undefined;
}

/**
 * Parse a typed/pasted decimal.
 * Accepts `,` as a decimal separator (`12,5`) and US thousands (`1,065.32`).
 */
export function parseFiniteNumber(value: string): number | undefined {
  const trimmed = value.trim().replace(/\s/g, '');
  if (!trimmed) return undefined;
  let normalized = trimmed;
  if (normalized.includes('.') && normalized.includes(',')) {
    normalized =
      normalized.lastIndexOf(',') > normalized.lastIndexOf('.')
        ? normalized.replace(/\./g, '').replace(',', '.')
        : normalized.replace(/,/g, '');
  } else if ((normalized.match(/,/g) ?? []).length > 1) {
    normalized = normalized.replace(/,/g, '');
  } else if (/,\d{3}$/.test(normalized)) {
    normalized = normalized.replace(',', '');
  } else if (normalized.includes(',')) {
    normalized = normalized.replace(',', '.');
  }
  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function parsePositiveNumber(value: string): number | undefined {
  const parsed = parseFiniteNumber(value);
  return parsed !== undefined && parsed > 0 ? parsed : undefined;
}

export function asFiniteNonNegative(value: unknown): number | undefined {
  const number = asFiniteNumber(value);
  return number !== undefined && number >= 0 ? number : undefined;
}

export function asPositiveNumber(value: unknown): number | undefined {
  const number = asFiniteNumber(value);
  return number !== undefined && number > 0 ? number : undefined;
}

/** Compact display for quantities (1, 1.5, 1.25). */
export function formatCompactNumber(value: number): string {
  const rounded = Math.round(value * 100) / 100;
  return Number.isInteger(rounded)
    ? String(rounded)
    : rounded.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
}

export type SanitizeNumericInputOptions = {
  /** Allow a decimal point (default true). */
  decimals?: boolean;
  /** Allow thousands separators `,` (default true when decimals). */
  allowComma?: boolean;
};

/**
 * Strip letters and other non-numeric junk from typed/pasted input.
 * Use for every field that only accepts numbers (`decimal-pad` / `number-pad`).
 *
 * - Digits always kept
 * - Optional `,` thousands separators
 * - At most one `.` decimal point when `decimals` is true
 */
export function sanitizeNumericInput(
  value: string,
  options: SanitizeNumericInputOptions = {},
): string {
  const decimals = options.decimals ?? true;
  const allowComma = options.allowComma ?? decimals;

  if (!decimals) {
    return value.replace(/\D/g, '');
  }

  const allowed = allowComma ? /[^\d.,]/g : /[^\d.]/g;
  let next = value.replace(allowed, '');

  // Keep only the first decimal point; treat further `.` as noise.
  const firstDot = next.indexOf('.');
  if (firstDot !== -1) {
    next =
      next.slice(0, firstDot + 1) +
      next.slice(firstDot + 1).replace(/\./g, '');
  }

  return next;
}

/**
 * Format a numeric field value with thousands separators while preserving a
 * partially entered decimal (for example, `1065.` becomes `1,065.`).
 *
 * This is deliberately string-based: text fields need to retain incomplete
 * values such as `.` and `0.` while the user is typing.
 */
export function formatNumericInput(
  value: string,
  options: SanitizeNumericInputOptions = {},
): string {
  const sanitized = sanitizeNumericInput(value, options);
  const decimals = options.decimals ?? true;
  const [rawInteger, rawFraction] = sanitized.replace(/,/g, '').split('.', 2);
  const integer = (rawInteger || '0').replace(/^0+(?=\d)/, '');
  const formattedInteger = integer.replace(/\B(?=(\d{3})+(?!\d))/g, ',');

  if (!decimals || !sanitized.includes('.')) return formattedInteger;
  return `${formattedInteger}.${rawFraction ?? ''}`;
}

/** Wrap an `onChangeText` so only numeric characters reach state. */
export function numericOnChangeText(
  onChangeText: ((text: string) => void) | undefined,
  options?: SanitizeNumericInputOptions,
): ((text: string) => void) | undefined {
  if (!onChangeText) return undefined;
  return (text: string) => onChangeText(sanitizeNumericInput(text, options));
}
