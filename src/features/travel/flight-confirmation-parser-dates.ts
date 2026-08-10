interface DateCandidate {
  value: string;
  index: number;
}

const MONTH_NUMBER: Record<string, number> = {
  jan: 1,
  feb: 2,
  mar: 3,
  apr: 4,
  may: 5,
  jun: 6,
  jul: 7,
  aug: 8,
  sep: 9,
  oct: 10,
  nov: 11,
  dec: 12,
};

function dateKey(year: number, month: number, day: number): string | undefined {
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return undefined;
  }
  return [
    year.toString().padStart(4, '0'),
    month.toString().padStart(2, '0'),
    day.toString().padStart(2, '0'),
  ].join('-');
}

function ocrYear(value: string): number {
  const normalized = value.toUpperCase().replaceAll('O', '0');
  return normalized.length === 2 ? 2000 + Number(normalized) : Number(normalized);
}

function findDateCandidates(text: string): DateCandidate[] {
  const candidates: DateCandidate[] = [];
  const push = (value: string | undefined, index: number) => {
    if (value) candidates.push({ value, index });
  };
  for (const match of text.matchAll(
    /\b(2[0O][0-9O]{2})[-/](\d{1,2})[-/](\d{1,2})\b/gi,
  )) {
    push(dateKey(ocrYear(match[1]), Number(match[2]), Number(match[3])), match.index);
  }
  for (const match of text.matchAll(
    /\b(\d{1,2})[/-](\d{1,2})[/-](2[0O][0-9O]{2}|\d{2})\b/gi,
  )) {
    push(dateKey(ocrYear(match[3]), Number(match[1]), Number(match[2])), match.index);
  }
  const monthNames =
    'January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec';
  const monthPattern = new RegExp(
    `\\b(${monthNames})\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?\\s*[,]?\\s*(2[0O][0-9O]{2}|\\d{2})\\b`,
    'gi',
  );
  for (const match of text.matchAll(monthPattern)) {
    push(
      dateKey(
        ocrYear(match[3]),
        MONTH_NUMBER[match[1].slice(0, 3).toLowerCase()],
        Number(match[2]),
      ),
      match.index,
    );
  }
  // JetBlue / airline app trip detail: "Date" / "Aug 10" (no year).
  const year = new Date().getFullYear();
  const monthDayPattern = new RegExp(
    `\\b(${monthNames})\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?\\b(?!\\s*[,]?\\s*(?:2[0O][0-9O]{2}|\\d{2}))`,
    'gi',
  );
  for (const match of text.matchAll(monthDayPattern)) {
    const month = MONTH_NUMBER[match[1].slice(0, 3).toLowerCase()];
    const day = Number(match[2]);
    push(dateKey(year, month, day), match.index ?? 0);
  }
  return candidates.sort((left, right) => left.index - right.index);
}

export function likelyItineraryDates(text: string): string[] {
  const seen = new Set<string>();
  return findDateCandidates(text).flatMap((candidate) => {
    const context = text.slice(Math.max(0, candidate.index - 28), candidate.index);
    if (/book(?:ed|ing)?\s*(?:on)?\s*$/i.test(context)) return [];
    if (seen.has(candidate.value)) return [];
    seen.add(candidate.value);
    return [candidate.value];
  });
}

export function findFlightConfirmationDate(
  text: string,
  minimumDate?: string,
  maximumDate?: string,
): string | undefined {
  const candidates = findDateCandidates(text).map((candidate) => candidate.value);
  const dateWithinTrip = candidates.find(
    (value) =>
      (!minimumDate || value >= minimumDate) &&
      (!maximumDate || value <= maximumDate),
  );
  if (dateWithinTrip) return dateWithinTrip;

  if (minimumDate && maximumDate) {
    return candidates
      .map((value, index) => {
        const distance =
          value < minimumDate
            ? Date.parse(`${minimumDate}T00:00:00Z`) -
              Date.parse(`${value}T00:00:00Z`)
            : Date.parse(`${value}T00:00:00Z`) -
              Date.parse(`${maximumDate}T00:00:00Z`);
        return { value, distance, index };
      })
      .sort(
        (left, right) =>
          left.distance - right.distance || left.index - right.index,
      )[0]?.value;
  }

  return candidates[0];
}
