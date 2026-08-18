/** Shared query-time search normalize — diacritic-stripped, lowercase tokens. */

export function normalizeSearchText(value: unknown): string {
  return String(value ?? '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

export function searchQueryTerms(query: string): string[] {
  return normalizeSearchText(query).split(/\s+/).filter(Boolean);
}

/** Every query term must appear in the joined haystack. Empty query matches all. */
export function haystackMatchesQuery(
  haystackParts: readonly unknown[],
  query: string,
): boolean {
  const terms = searchQueryTerms(query);
  if (terms.length === 0) return true;
  const haystack = normalizeSearchText(haystackParts.join(' '));
  return terms.every((term) => haystack.includes(term));
}
