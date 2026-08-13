/** Formats an English count with the matching singular or plural noun. */
export function formatCount(
  count: number,
  singular: string,
  plural = `${singular}s`,
): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

/** Formats an English count while keeping both its noun and verb in agreement. */
export function formatCountWithVerb(
  count: number,
  singularNoun: string,
  singularVerb: string,
  pluralVerb: string,
  pluralNoun = `${singularNoun}s`,
): string {
  return `${formatCount(count, singularNoun, pluralNoun)} ${
    count === 1 ? singularVerb : pluralVerb
  }`;
}
