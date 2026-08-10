const NON_AIRPORT_CODES = new Set([
  'AND',
  'ARE',
  'DUE',
  'FOR',
  'FROM',
  'HAS',
  'NOT',
  'THE',
  'THIS',
  'TO',
  'TRIP',
  'WAS',
  'WITH',
  'YOU',
  'YOUR',
]);

export function firstMatch(text: string, patterns: RegExp[]): string | undefined {
  for (const pattern of patterns) {
    const match = pattern.exec(text);
    if (match?.[1]) return match[1].trim();
  }
  return undefined;
}

export function parseMinutes(
  hourText: string,
  minuteText: string,
  suffix?: string,
): number {
  let hour = Number(hourText);
  const minute = Number(minuteText);
  if (suffix) {
    const normalized = suffix.toUpperCase();
    if (normalized === 'PM' && hour < 12) hour += 12;
    if (normalized === 'AM' && hour === 12) hour = 0;
  }
  return hour * 60 + minute;
}

export function findLabeledClockMinutes(
  text: string,
  label: RegExp,
): number | undefined {
  const labeledBlock = label.exec(text);
  const labeled = labeledBlock
    ? /\b(\d{1,2})[:.](\d{2})\s*(AM|PM)\b/i.exec(labeledBlock[1])
    : undefined;
  if (labeled) return parseMinutes(labeled[1], labeled[2], labeled[3]);
  return undefined;
}

export function findDepartureTime(text: string): number | undefined {
  // Prefer "Departs" over "Boards" / "Doors close" on airline trip-detail UIs.
  const departs = findLabeledClockMinutes(
    text,
    /(?:^|\n)\s*departs?\s*[:\-]?([\s\S]{0,80})/i,
  );
  if (departs !== undefined) return departs;
  const labeled = findLabeledClockMinutes(
    text,
    /(?:depart(?:ure|ing)?|takeoff|return)\s*(?:time)?\s*[:\-]?([\s\S]{0,220})/i,
  );
  if (labeled !== undefined) return labeled;
  const generic = /\b(\d{1,2}):(\d{2})\s*(AM|PM)\b/i.exec(text);
  return generic ? parseMinutes(generic[1], generic[2], generic[3]) : undefined;
}

export function findArrivalTime(text: string): number | undefined {
  return findLabeledClockMinutes(
    text,
    /(?:^|\n)\s*(?:arriv(?:e|es|al|ing))\s*(?:time)?\s*[:\-]?([\s\S]{0,80})/i,
  );
}

export function findDurationMinutes(text: string): number | undefined {
  const iso = /\bPT(?:(\d{1,2})H)?(?:(\d{1,2})M)?\b/i.exec(text);
  if (iso) {
    const duration = Number(iso[1] ?? 0) * 60 + Number(iso[2] ?? 0);
    if (duration > 0 && duration <= 1440) return duration;
  }

  const hoursAndMinutes =
    /\b(\d{1,2})\s*(?:h|hr|hrs|hour|hours)\s*(?:(\d{1,2})\s*(?:m|min|mins|minute|minutes))?\b/i.exec(
      text,
    );
  if (hoursAndMinutes) {
    const duration =
      Number(hoursAndMinutes[1]) * 60 + Number(hoursAndMinutes[2] ?? 0);
    if (duration > 0 && duration <= 1440) return duration;
  }

  const labeledMinutes =
    /\bduration\s*[:\-]?\s*(\d{1,4})\s*(?:m|min|mins|minute|minutes)\b/i.exec(
      text,
    );
  if (labeledMinutes) {
    const duration = Number(labeledMinutes[1]);
    if (duration > 0 && duration <= 1440) return duration;
  }

  return undefined;
}

export function validAirportCode(value: string | undefined): value is string {
  return Boolean(
    value && /^[A-Z]{3}$/.test(value) && !NON_AIRPORT_CODES.has(value),
  );
}

export function findRoute(text: string): {
  departureAirport: string;
  arrivalAirport: string;
} {
  // Allow OCR line breaks inside city names ("New\\nYork (LGA)").
  const parenthesizedRoute =
    /\(([A-Z]{3})\)\s*(?:→|->|–|—|-|\bTO\b)\s*[\s\S]{0,80}?\(([A-Z]{3})\)/i.exec(
      text,
    );
  if (
    validAirportCode(parenthesizedRoute?.[1]?.toUpperCase()) &&
    validAirportCode(parenthesizedRoute?.[2]?.toUpperCase())
  ) {
    return {
      departureAirport: parenthesizedRoute[1].toUpperCase(),
      arrivalAirport: parenthesizedRoute[2].toUpperCase(),
    };
  }

  const arrowRoute = /\b([A-Z]{3})\s*(?:→|->|–|—)\s*([A-Z]{3})\b/.exec(text);
  if (validAirportCode(arrowRoute?.[1]) && validAirportCode(arrowRoute?.[2])) {
    return {
      departureAirport: arrowRoute[1],
      arrivalAirport: arrowRoute[2],
    };
  }

  for (const line of text.split('\n')) {
    const codeRoute = /\b([A-Z]{3})\s+(?:TO|-)\s+([A-Z]{3})\b/.exec(line);
    if (validAirportCode(codeRoute?.[1]) && validAirportCode(codeRoute?.[2])) {
      return {
        departureAirport: codeRoute[1],
        arrivalAirport: codeRoute[2],
      };
    }
  }

  // Prefer the earliest route evidence so footer noise like a later "EWR KEF"
  // payment line cannot override timed standalone codes (Chase return legs).
  type RouteHit = {
    index: number;
    departureAirport: string;
    arrivalAirport: string;
  };
  const routeHits: RouteHit[] = [];

  for (const match of text.matchAll(/^\s*([A-Z]{3})\s+([A-Z]{3})\s*$/gm)) {
    const departureAirport = match[1]?.toUpperCase();
    const arrivalAirport = match[2]?.toUpperCase();
    if (
      match.index === undefined ||
      !validAirportCode(departureAirport) ||
      !validAirportCode(arrivalAirport)
    ) {
      continue;
    }
    routeHits.push({ index: match.index, departureAirport, arrivalAirport });
  }

  const standaloneMatches = [
    ...text.matchAll(/^\s*([A-Z]{3})\s*$/gm),
    // JetBlue trip detail: "JFK Terminal 5" on one OCR line (same-line only —
    // `\s` would also match "SDQ\\nTerminal" and double-count the bare code).
    ...text.matchAll(/^\s*([A-Z]{3})[ \t]+(?:Terminal|Gate)\b/gim),
  ].filter((match) => validAirportCode(match[1]?.toUpperCase()));
  // Preserve document order (matchAll on two patterns is not merged by index).
  standaloneMatches.sort(
    (left, right) => (left.index ?? 0) - (right.index ?? 0),
  );
  // One hit per index; then first two *distinct* codes (dep ≠ arr).
  const orderedCodes: { index: number; code: string }[] = [];
  const seenIndexes = new Set<number>();
  for (const match of standaloneMatches) {
    if (match.index === undefined || seenIndexes.has(match.index)) continue;
    seenIndexes.add(match.index);
    orderedCodes.push({ index: match.index, code: match[1]!.toUpperCase() });
  }
  const departureHit = orderedCodes[0];
  const arrivalHit = orderedCodes.find(
    (hit) => hit.code !== departureHit?.code,
  );
  if (departureHit && arrivalHit) {
    routeHits.push({
      index: departureHit.index,
      departureAirport: departureHit.code,
      arrivalAirport: arrivalHit.code,
    });
  }

  const parenthesizedCodes = Array.from(text.matchAll(/\(([A-Z]{3})\)/g)).filter(
    (match) => validAirportCode(match[1]?.toUpperCase()),
  );
  if (parenthesizedCodes.length >= 2) {
    const first = parenthesizedCodes[0]!;
    const second = parenthesizedCodes[1]!;
    if (first.index !== undefined && second.index !== undefined) {
      routeHits.push({
        index: first.index,
        departureAirport: first[1]!.toUpperCase(),
        arrivalAirport: second[1]!.toUpperCase(),
      });
    }
  }

  routeHits.sort((left, right) => left.index - right.index);
  const earliest = routeHits[0];
  if (earliest) {
    return {
      departureAirport: earliest.departureAirport,
      arrivalAirport: earliest.arrivalAirport,
    };
  }

  return { departureAirport: '', arrivalAirport: '' };
}

