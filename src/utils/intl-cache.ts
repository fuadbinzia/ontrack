const MAX_FORMATTERS_PER_KIND = 64;

function cacheKey(
  locales: Intl.LocalesArgument | undefined,
  options: object | undefined,
): string {
  return JSON.stringify([locales ?? null, options ?? null]);
}

function getCached<TKey, TValue>(
  cache: Map<TKey, TValue>,
  key: TKey,
  create: () => TValue,
): TValue {
  const cached = cache.get(key);
  if (cached !== undefined) {
    cache.delete(key);
    cache.set(key, cached);
    return cached;
  }
  const value = create();
  cache.set(key, value);
  if (cache.size > MAX_FORMATTERS_PER_KIND) {
    const oldestKey = cache.keys().next().value;
    if (oldestKey !== undefined) cache.delete(oldestKey);
  }
  return value;
}

const dateTimeFormatters = new Map<string, Intl.DateTimeFormat>();
const numberFormatters = new Map<string, Intl.NumberFormat>();
const displayNamesFormatters = new Map<string, Intl.DisplayNames>();
const locales = new Map<string, Intl.Locale>();

export function getDateTimeFormatter(
  locales?: Intl.LocalesArgument,
  options?: Intl.DateTimeFormatOptions,
): Intl.DateTimeFormat {
  const key = cacheKey(locales, options);
  return getCached(
    dateTimeFormatters,
    key,
    () => new Intl.DateTimeFormat(locales, options),
  );
}

export function getNumberFormatter(
  locales?: Intl.LocalesArgument,
  options?: Intl.NumberFormatOptions,
): Intl.NumberFormat {
  const key = cacheKey(locales, options);
  return getCached(
    numberFormatters,
    key,
    () => new Intl.NumberFormat(locales, options),
  );
}

export function getDisplayNamesFormatter(
  locales: Intl.LocalesArgument,
  options: Intl.DisplayNamesOptions,
): Intl.DisplayNames {
  const key = cacheKey(locales, options);
  return getCached(
    displayNamesFormatters,
    key,
    () => new Intl.DisplayNames(locales, options),
  );
}

export function getIntlLocale(tag: string): Intl.Locale {
  return getCached(locales, tag, () => new Intl.Locale(tag));
}
