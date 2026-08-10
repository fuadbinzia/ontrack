/** Deduped "City, Region, Country" join for Open-Meteo geocode rows. */
export function formatOpenMeteoPlaceLabel(
  parts: Array<string | null | undefined>,
  fallback = '',
): string {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of parts) {
    const trimmed = typeof part === 'string' ? part.trim() : '';
    if (!trimmed) continue;
    const key = trimmed.toLocaleLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(trimmed);
  }
  return out.join(', ') || fallback;
}
