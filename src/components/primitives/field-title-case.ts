import { Children, type ReactNode } from 'react';

/**
 * Title-case chrome labels (fields, headers, buttons, chips).
 * Preserves punctuation, required markers, and hyphen/paren boundaries.
 * Keeps short all-caps acronyms (UI, FX, API) intact.
 * Preserves intentional camel casing (StraiAway, onTrack, iOS).
 * Leaves common short words lowercase unless they start the title
 * (articles, short prepositions, and copulas like is / was / are).
 */
const TITLE_SMALL_WORDS = new Set([
  'a',
  'am',
  'an',
  'and',
  'are',
  'as',
  'at',
  'be',
  'but',
  'by',
  'for',
  'from',
  'in',
  'is',
  'nor',
  'of',
  'on',
  'or',
  'the',
  'to',
  'via',
  'vs',
  'was',
  'with',
]);

// SI and customary unit symbols are case-sensitive and stay lowercase in labels.
const TITLE_UNIT_SYMBOLS = new Set(['kg', 'lb']);

// ASCII + typographic apostrophes so possessives (“Imtiaz’s”) stay one word.
const WORD_RE = /[A-Za-z][A-Za-z'’]*/g;

export function fieldTitleCase(label: string): string {
  const matches = [...label.matchAll(WORD_RE)];
  if (matches.length === 0) return label;
  const firstOffset = matches[0]?.index ?? 0;

  return label.replace(WORD_RE, (word, offset: number) => {
    const lower = word.toLowerCase();
    const hasIntentionalInternalCapital = /[a-z][A-Z]|^[A-Z]{2}[a-z]/.test(word);
    if (hasIntentionalInternalCapital) return word;
    if (TITLE_UNIT_SYMBOLS.has(lower)) return lower;
    // Small words stay lowercase mid-title — including single-letter "a".
    if (offset !== firstOffset && TITLE_SMALL_WORDS.has(lower)) return lower;
    if (word.length <= 1) return word.toUpperCase();
    if (word.length <= 3 && word === word.toUpperCase()) return word;

    return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
  });
}

/** Title-case every text fragment while preserving nested elements and numbers. */
export function titleCaseTextChildren(children: ReactNode): ReactNode {
  return Children.map(children, (child) =>
    typeof child === 'string' ? fieldTitleCase(child) : child,
  );
}

/** Explanatory sentences stay authored; chrome labels still title-case. */
export function isSentenceCopy(text: string): boolean {
  return /[.!?]\s*$/.test(text.trim());
}

export function formatEmptyStateTitle(title: string): string {
  return isSentenceCopy(title) ? title : fieldTitleCase(title);
}
