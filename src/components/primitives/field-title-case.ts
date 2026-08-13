/**
 * Title-case chrome labels (fields, headers, buttons, chips).
 * Preserves punctuation, required markers, and hyphen/paren boundaries.
 * Keeps short all-caps acronyms (UI, FX, API) intact.
 * Preserves intentional camel casing (StraiAway, onTrack, iOS).
 * Leaves common short words lowercase unless they start the title.
 */
const TITLE_SMALL_WORDS = new Set([
  'a',
  'an',
  'and',
  'as',
  'at',
  'but',
  'by',
  'for',
  'from',
  'in',
  'nor',
  'of',
  'on',
  'or',
  'the',
  'to',
  'via',
  'vs',
  'with',
]);

// ASCII + typographic apostrophes so possessives (“Imtiaz’s”) stay one word.
const WORD_RE = /[A-Za-z][A-Za-z'’]*/g;

export function fieldTitleCase(label: string): string {
  const matches = [...label.matchAll(WORD_RE)];
  if (matches.length === 0) return label;
  const firstOffset = matches[0]?.index ?? 0;

  return label.replace(WORD_RE, (word, offset: number) => {
    const lower = word.toLowerCase();
    const hasIntentionalInternalCapital = /[a-z][A-Z]/.test(word);
    if (hasIntentionalInternalCapital) return word;
    // Small words stay lowercase mid-title — including single-letter "a".
    if (offset !== firstOffset && TITLE_SMALL_WORDS.has(lower)) return lower;
    if (word.length <= 1) return word.toUpperCase();
    if (word.length <= 3 && word === word.toUpperCase()) return word;

    return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
  });
}
