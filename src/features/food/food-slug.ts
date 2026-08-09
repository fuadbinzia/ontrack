/** Stable `ontrack.*` testID segment from a free-text label (cuisine, chip, row). */
export function foodTestIdSlug(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
