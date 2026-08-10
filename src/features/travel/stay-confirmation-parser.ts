import { findConfirmationMoney } from './confirmation-money';
import {
    emptyStayDetailsDraft,
    type StayDetailsDraft,
} from './stay-details';

export interface ParsedStayConfirmation {
  stay: StayDetailsDraft;
  title?: string;
  date?: string;
  startMinutes?: number;
  details?: string;
  bookingUrl?: string;
  amount?: number;
  currency?: string;
  detectedFieldCount: number;
}

const MONTH_NAMES =
  'January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec';

const MONTH_INDEX: Record<string, number> = {
  january: 1,
  february: 2,
  march: 3,
  april: 4,
  may: 5,
  june: 6,
  july: 7,
  august: 8,
  september: 9,
  october: 10,
  november: 11,
  december: 12,
  jan: 1,
  feb: 2,
  mar: 3,
  apr: 4,
  jun: 6,
  jul: 7,
  aug: 8,
  sep: 9,
  sept: 9,
  oct: 10,
  nov: 11,
  dec: 12,
};

/** Line-anchored so "Special check-in instructions" / "checkout page" are ignored. */
const CHECKIN_LABEL =
  /(?:^|\n)\s*check[\s-]?in(?:\s+date|\s+time)?\b(?!\s+(?:instructions|age))/i;
const CHECKOUT_LABEL =
  /(?:^|\n)\s*check[\s-]?out(?:\s+date|\s+time)?\b(?!\s+page)/i;

/** Browser/print headers like "8/1/26, 11:10 AM Booking: …" — not stay times. */
const PRINT_HEADER =
  /\b\d{1,2}\/\d{1,2}\/\d{2,4},\s*\d{1,2}:\d{2}\s*(?:AM|PM|am|pm)\b/g;

function firstMatch(text: string, patterns: RegExp[]): string | undefined {
  for (const pattern of patterns) {
    const match = pattern.exec(text);
    if (match?.[1]) return match[1].trim();
  }
  return undefined;
}

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

/** Avoid `new Date('Sep 09, 2026')` — Hermes is unreliable with that form. */
function dateKeyFromMonthName(
  monthName: string,
  dayText: string,
  yearText: string,
): string | undefined {
  const month = MONTH_INDEX[monthName.toLowerCase()];
  if (!month) return undefined;
  return dateKey(Number(yearText), month, Number(dayText));
}

function collectDates(text: string, fallbackYear?: number): string[] {
  const candidates: string[] = [];
  for (const match of text.matchAll(/\b(20\d{2})[-/](\d{1,2})[-/](\d{1,2})\b/g)) {
    const value = dateKey(Number(match[1]), Number(match[2]), Number(match[3]));
    if (value) candidates.push(value);
  }
  for (const match of text.matchAll(/\b(\d{1,2})\/(\d{1,2})\/(20\d{2})\b/g)) {
    const value = dateKey(Number(match[3]), Number(match[1]), Number(match[2]));
    if (value) candidates.push(value);
  }
  const monthPattern = new RegExp(
    `\\b(${MONTH_NAMES})\\s+(\\d{1,2})(?:st|nd|rd|th)?[,]?\\s+(20\\d{2})\\b`,
    'gi',
  );
  for (const match of text.matchAll(monthPattern)) {
    const value = dateKeyFromMonthName(match[1], match[2], match[3]);
    if (value) candidates.push(value);
  }
  // "Monday 8 September 2026" / "8 September 2026"
  const dayMonthPattern = new RegExp(
    `\\b(?:Mon(?:day)?|Tue(?:sday)?|Wed(?:nesday)?|Thu(?:rsday)?|Fri(?:day)?|Sat(?:urday)?|Sun(?:day)?)?\\s*(\\d{1,2})(?:st|nd|rd|th)?\\s+(${MONTH_NAMES})[,]?\\s+(20\\d{2})\\b`,
    'gi',
  );
  for (const match of text.matchAll(dayMonthPattern)) {
    const value = dateKeyFromMonthName(match[2], match[1], match[3]);
    if (value) candidates.push(value);
  }
  if (fallbackYear) {
    const monthDayPattern = new RegExp(
      `\\b(${MONTH_NAMES})\\s+(\\d{1,2})(?:st|nd|rd|th)?\\b(?!\\s*,?\\s*20\\d{2})`,
      'gi',
    );
    for (const match of text.matchAll(monthDayPattern)) {
      const value = dateKeyFromMonthName(
        match[1],
        match[2],
        String(fallbackYear),
      );
      if (value) candidates.push(value);
    }
    // Airbnb trip header: "August 10 – 14" / "August 10 - August 14"
    const monthDayRange = new RegExp(
      `\\b(${MONTH_NAMES})\\s+(\\d{1,2})(?:st|nd|rd|th)?\\s*[–—-]\\s*(?:(${MONTH_NAMES})\\s+)?(\\d{1,2})(?:st|nd|rd|th)?\\b`,
      'gi',
    );
    for (const match of text.matchAll(monthDayRange)) {
      const start = dateKeyFromMonthName(
        match[1],
        match[2],
        String(fallbackYear),
      );
      let end = dateKeyFromMonthName(
        match[3] || match[1],
        match[4],
        String(fallbackYear),
      );
      // "December 28 – January 3" → checkout lands in the next calendar year.
      if (start && end && end < start) {
        end = bumpDateKeyYear(end, 1) ?? end;
      }
      if (start) candidates.push(start);
      if (end) candidates.push(end);
    }
  }
  return candidates;
}

/** Year for yearless stay dates ("Monday, August 10", "August 10 – 14"). */
function resolveFallbackYear(): number {
  return new Date().getFullYear();
}

function bumpDateKeyYear(
  value: string,
  deltaYears: number,
): string | undefined {
  const year = Number(value.slice(0, 4));
  const month = Number(value.slice(5, 7));
  const day = Number(value.slice(8, 10));
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) {
    return undefined;
  }
  return dateKey(year + deltaYears, month, day);
}

/** When checkout sorted before check-in (Dec → Jan), roll checkout into next year. */
function ensureCheckoutOnOrAfterCheckin(
  checkinDate: string | undefined,
  checkoutDate: string | undefined,
): string | undefined {
  if (!checkoutDate) return undefined;
  if (!checkinDate || checkoutDate >= checkinDate) return checkoutDate;
  return bumpDateKeyYear(checkoutDate, 1) ?? checkoutDate;
}

/**
 * Prefer dates on explicit "Check-in …" / "Check-out …" lines (Trivago/Booking).
 */
function findLabeledStayDates(text: string, fallbackYear?: number): {
  checkin?: string;
  checkout?: string;
} {
  const linePattern = new RegExp(
    `check[\\s-]?in(?:\\s+date|\\s+time)?\\s*[:#]?\\s*((?:${MONTH_NAMES})\\s+\\d{1,2}(?:st|nd|rd|th)?[,]?\\s+20\\d{2}|\\d{1,2}\\/\\d{1,2}\\/20\\d{2}|20\\d{2}[-/]\\d{1,2}[-/]\\d{1,2}|(?:Mon(?:day)?|Tue(?:sday)?|Wed(?:nesday)?|Thu(?:rsday)?|Fri(?:day)?|Sat(?:urday)?|Sun(?:day)?)?\\s*\\d{1,2}(?:st|nd|rd|th)?\\s+(?:${MONTH_NAMES})[,]?\\s+20\\d{2})`,
    'i',
  );
  const outPattern = new RegExp(
    `check[\\s-]?out(?:\\s+date|\\s+time)?\\s*[:#]?\\s*((?:${MONTH_NAMES})\\s+\\d{1,2}(?:st|nd|rd|th)?[,]?\\s+20\\d{2}|\\d{1,2}\\/\\d{1,2}\\/20\\d{2}|20\\d{2}[-/]\\d{1,2}[-/]\\d{1,2}|(?:Mon(?:day)?|Tue(?:sday)?|Wed(?:nesday)?|Thu(?:rsday)?|Fri(?:day)?|Sat(?:urday)?|Sun(?:day)?)?\\s*\\d{1,2}(?:st|nd|rd|th)?\\s+(?:${MONTH_NAMES})[,]?\\s+20\\d{2})`,
    'i',
  );
  const checkinMatch = linePattern.exec(text);
  const checkoutMatch = outPattern.exec(text);
  return {
    checkin: checkinMatch
      ? collectDates(checkinMatch[1], fallbackYear)[0]
      : undefined,
    checkout: checkoutMatch
      ? collectDates(checkoutMatch[1], fallbackYear)[0]
      : undefined,
  };
}

function preferDateInRange(
  candidates: string[],
  minimumDate?: string,
  maximumDate?: string,
): string | undefined {
  const withinTrip = candidates.find(
    (value) =>
      (!minimumDate || value >= minimumDate) &&
      (!maximumDate || value <= maximumDate),
  );
  if (withinTrip) return withinTrip;
  return candidates[0];
}

function parseMinutes(hourText: string, minuteText: string, suffix?: string): number {
  let hour = Number(hourText);
  const minute = Number(minuteText);
  const normalized = suffix?.toLowerCase();
  if (normalized === 'pm' && hour < 12) hour += 12;
  if (normalized === 'am' && hour === 12) hour = 0;
  return hour * 60 + minute;
}

/** Times with From/Until/After/Before — hotel policy lines, not print headers. */
function findPrefixedTimes(text: string): number[] {
  const times: number[] = [];
  for (const match of text.matchAll(
    /\b(?:from|until|after|before)\s+(\d{1,2}):(\d{2})\s*(AM|PM|am|pm)?\b/gi,
  )) {
    times.push(parseMinutes(match[1], match[2], match[3]));
  }
  return times;
}

function findTimes(text: string): number[] {
  const times: number[] = [];
  for (const match of text.matchAll(
    /\b(\d{1,2}):(\d{2})\s*(AM|PM|am|pm)?\b/g,
  )) {
    times.push(parseMinutes(match[1], match[2], match[3]));
  }
  for (const match of text.matchAll(/\b(\d{1,2})(\d{2})\s*(AM|PM|am|pm)\b/g)) {
    times.push(parseMinutes(match[1], match[2], match[3]));
  }
  return times;
}

function sectionBetween(text: string, start: RegExp, end?: RegExp): string {
  const startMatch = start.exec(text);
  if (!startMatch || startMatch.index === undefined) return '';
  const from = startMatch.index;
  const afterLabel = text.slice(from + startMatch[0].length);
  if (!end) return text.slice(from, from + 400);
  const endMatch = end.exec(afterLabel);
  if (!endMatch || endMatch.index === undefined) {
    return text.slice(from, from + 400);
  }
  return text.slice(from, from + startMatch[0].length + endMatch.index);
}

/** Collect every Check-in…Check-out (or Check-out…next) slice for times/dates. */
function collectLabeledSections(
  text: string,
  start: RegExp,
  end?: RegExp,
): string[] {
  const sections: string[] = [];
  const flags = start.flags.includes('g') ? start.flags : `${start.flags}g`;
  const globalStart = new RegExp(start.source, flags);
  let match: RegExpExecArray | null;
  while ((match = globalStart.exec(text)) !== null) {
    const from = match.index;
    const afterLabel = text.slice(from + match[0].length);
    if (!end) {
      sections.push(text.slice(from, from + 400));
      continue;
    }
    const endFlags = end.flags.includes('g') ? end.flags : `${end.flags}g`;
    const endMatcher = new RegExp(end.source, endFlags);
    const endMatch = endMatcher.exec(afterLabel);
    if (!endMatch || endMatch.index === undefined) {
      sections.push(text.slice(from, from + 400));
    } else {
      sections.push(text.slice(from, from + match[0].length + endMatch.index));
    }
  }
  return sections;
}

function findConfirmationCode(text: string): string {
  return (
    firstMatch(text, [
      /(?:confirmation\s+(?:number|code|#)|booking\s+(?:number|reference|code)|reservation\s+(?:number|code|#|id)|pin\s+code)\s*[:#]?\s*([A-Z0-9][A-Z0-9.·-]{2,24})\b/i,
      /\b(?:conf|res)\s*[:#]\s*([A-Z0-9.·-]{5,24})\b/i,
      /(?:airbnb\s+(?:reservation|itinerary))\s*[:#-]?\s*(?:(?:\r?\n\s*)?)([A-Z0-9]{8,14})\b/i,
    ])
      ?.replace(/[·.]/g, '')
      .toUpperCase() ?? ''
  );
}

function looksLikeStreetAddress(value: string): boolean {
  const trimmed = value.trim();
  if (trimmed.length < 5 || trimmed.length > 120) return false;

  // Reject phone numbers, host contact, or communication keywords
  if (
    /(?:\+\d|\b(?:call|phone|tel|contact|cell|whatsapp|email|host)\b|@)/i.test(
      trimmed,
    )
  ) {
    return false;
  }

  // Reject dates, days of week, months, or time strings
  if (
    /\b(?:mon|tue|tues|wed|thu|thur|thurs|fri|sat|sun|sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/i.test(
      trimmed,
    ) ||
    /\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec|january|february|march|april|june|july|august|september|october|november|december)\b/i.test(
      trimmed,
    ) ||
    /\b(?:am|pm)\b/i.test(trimmed) ||
    /\b\d{1,2}:\d{2}\b/.test(trimmed) ||
    /\b\d{1,2}\/\d{1,2}(?:\/\d{2,4})?\b/.test(trimmed)
  ) {
    return false;
  }

  // Reject booking, financial, guest, or policy metadata
  if (
    /\b(?:booking|confirmation|itinerary|reservation|pin\s+code|trivago|expedia|airbnb|vrbo|marriott|hilton|hyatt|nights?|guests?|adults?|children|bedrooms?|beds?|baths?|check[\s-]?in|check[\s-]?out|payment|total|cost|price|amount|refund|cancellation|policy|rules?|instructions?|code|wifi|entire\s+|private\s+room|who(?:'|’)?s)\b/i.test(
      trimmed,
    )
  ) {
    return false;
  }

  // Reject URLs or symbols not used in addresses
  if (
    /\b(?:https?:\/\/|www\.|\.com|\.deals|\.org)\b/i.test(trimmed) ||
    /[|•·=<>~^{}_]/.test(trimmed)
  ) {
    return false;
  }

  // Positive Pattern 1: Geographic multi-part place (e.g. "Santa Cruz la Laguna, Sololá Department, Guatemala")
  // Reject room/rate product phrases that look comma-separated but are not places.
  const roomProductPart =
    /\b(?:room|suite|view|rate|deluxe|standard|king|queen|twin|double|single|occupancy|non[\s-]?smoking|accessible|balcony)\b/i;
  const parts = trimmed.split(',').map((p) => p.trim()).filter(Boolean);
  if (parts.length >= 2 && parts.length <= 4) {
    const allValidParts = parts.every(
      (p) =>
        p.length >= 2 &&
        p.length <= 50 &&
        /^[A-Za-z0-9\s.'-–—]+$/.test(p) &&
        /[A-Za-z]{2,}/.test(p) &&
        !roomProductPart.test(p),
    );
    if (allValidParts) {
      return true;
    }
  }

  // Positive Pattern 2: Street number with recognized street type or European format
  const hasStreetDesignator =
    /\b\d{1,5}\s+[A-Za-z0-9.'\s-]{2,40}\s+(?:Street|St\.?|Avenue|Ave\.?|Boulevard|Blvd\.?|Road|Rd\.?|Way|Lane|Ln\.?|Drive|Dr\.?|Court|Ct\.?|Place|Pl\.?|Square|Sq\.?|Circle|Cir\.?|Terrace|Ter\.?|Highway|Hwy\.?|Stræti|Gata|Veggur|Vegi|Strasse|Straße|Rue|Via|Calle|Avenida|Carretera)\b/i.test(
      trimmed,
    ) ||
    /\b[A-Z][A-Za-z0-9\s.'-]{2,35}\s+\d{1,5},\s*\d{3,6}\s+[A-Za-z]/i.test(
      trimmed,
    );

  if (hasStreetDesignator) {
    return true;
  }

  return false;
}

function findHotelName(text: string): string {
  // Do not use bare "stay" — Airbnb "Your stay\nHosted by…" steals the host line.
  const labeled = firstMatch(text, [
    /(?:hotel(?:\s+name)?|property(?:\s+name)?|accommodation(?:\s+name)?|lodging)\s*[:#-]?\s*([^\n]{3,80})/i,
    /(?:listing|listing\s+title|unit\s+name)\s*[:#-]?\s*([^\n]{3,80})/i,
    /(?:^|\n)\s*stay\s*[:#-]\s*([^\n]{3,80})/i,
  ]);
  if (
    labeled &&
    !/^(?:details|information|confirmation|itinerary|hosted\s+by)$/i.test(
      labeled.trim(),
    ) &&
    !/^hosted\s+by\b/i.test(labeled.trim())
  ) {
    return labeled.replace(/\s+/g, ' ').trim();
  }

  // Airbnb / Vacation rental titles with pipe separator e.g. "Villa Patziac | Private Cove | Serene Retreat"
  const pipeTitle = firstMatch(text, [
    /\b([A-Za-z0-9\s'’-]{3,50}\s*\|\s*[^\n]{3,80})/,
    /\b([A-Za-z0-9\s'’-]{3,50}\s*[·•]\s*[^\n]{3,80})/,
  ]);
  if (
    pipeTitle &&
    !/^(?:booking|check[\s-]?in|reservation|trivago|expedia)/i.test(pipeTitle) &&
    !/(?:guest|bedroom|bed|bath|night|adult|review|rating)/i.test(pipeTitle)
  ) {
    return pipeTitle.replace(/\s+/g, ' ').trim();
  }

  // Headline line before Check-in / Reservation details
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  for (const line of lines.slice(0, 10)) {
    if (
      line.length >= 4 &&
      line.length <= 80 &&
      !/^(?:airbnb|booking(?:\.com)?|marriott|hilton|hyatt|expedia|trivago|vrbo|reservation|itinerary|confirmation|travel|receipt|invoice|where\s+you|who(?:'|’)?s|check[\s-]?in|check[\s-]?out|payment|total|entire\s+|private\s+room|your\s+(?:reservation|booking|stay|trip|itinerary)|you(?:'|’)?re\s+all\s+set|hosted\s+by|getting\s+there|province|state|department|municipality|district|county|region)\b/i.test(
        line,
      ) &&
      !/(?:guest|bedroom|bed|bath|night|adult|is\s+confirmed|confirmed)/i.test(line) &&
      !/^\d{1,2}\/\d{1,2}\/\d{2,4}/.test(line) &&
      !/^\d{3,6}\b/.test(line) &&
      !/^(?:after|before|from|until)\b/i.test(line) &&
      !/\b(?:am|pm)\b/i.test(line) &&
      !/\b\d{1,2}:\d{2}\b/.test(line) &&
      !/\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec|january|february|march|april|june|july|august|september|october|november|december)\b/i.test(
        line,
      ) &&
      !looksLikeStreetAddress(line) &&
      !looksLikeAddressContinuation(line) &&
      !/^[A-Z0-9-]{5,24}$/.test(line) &&
      /[A-Za-z]{3,}/.test(line)
    ) {
      return line.replace(/\s+/g, ' ').trim();
    }
  }

  // Known hotel / lodging brand / types in name
  const brandMatch = firstMatch(text, [
    /\b([A-Z][A-Za-z0-9 &'’.-]{2,40}\s+(?:Hotel|Hostel|Inn|Resort|Suites?|Apartments?|Villa|Cottage|Chalet|Cabin|Lodge))\b/,
    /\b((?:Centerhotel|Hotel|Hostel|Inn|Resort|Suites?|Apartments?|Guesthouse|Villa|Cottage|Chalet|Cabin|Lodge)\s+[^\n,]{2,60})/i,
  ]);
  if (brandMatch) {
    return brandMatch.replace(/\s+/g, ' ').trim();
  }

  // Vacation rental prefix "Entire villa in Santa Cruz..."
  const rentalPrefix = firstMatch(text, [
    /\b(Entire\s+(?:villa|home|house|apartment|condo|cabin|chalet|place|loft|cottage|suite|room)\s+in\s+[^\n]{3,60})/i,
    /\b(Private\s+room\s+in\s+[^\n]{3,60})/i,
  ]);
  if (rentalPrefix) {
    return rentalPrefix.replace(/\s+/g, ' ').trim();
  }

  return '';
}

/** Airbnb wraps geo lines mid-phrase ("La Altagracia" / "Province 23000,"). */
function looksLikeAddressContinuation(line: string): boolean {
  const trimmed = line.trim().replace(/,\s*$/, '');
  if (trimmed.length < 2 || trimmed.length > 80) return false;
  if (
    /^(?:check[\s-]?in|check[\s-]?out|getting\s+there|hosted\s+by|book\s+a|host\s+recommendations?|scape\s+park|your\s+stay)\b/i.test(
      trimmed,
    )
  ) {
    return false;
  }
  if (looksLikeStreetAddress(trimmed)) return true;
  if (
    /^(?:province|state|department|municipality|district|county|region)\b/i.test(
      trimmed,
    )
  ) {
    return true;
  }
  if (/^\d{3,6}\b/.test(trimmed)) return true;
  // Country / territory line (e.g. "Dominican Republic")
  if (
    /^(?:[A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,3})$/.test(trimmed) &&
    /\b(?:republic|kingdom|states|islands|federation|emirates)\b/i.test(trimmed)
  ) {
    return true;
  }
  return false;
}

function appendAddressFragment(base: string, next: string): string {
  const cleanBase = base.replace(/,\s*$/, '').replace(/\s+/g, ' ').trim();
  const cleanNext = next.replace(/,\s*$/, '').replace(/\s+/g, ' ').trim();
  if (!cleanNext) return cleanBase;
  if (
    /^(?:province|state|department|municipality|district|county|region)\b/i.test(
      cleanNext,
    )
  ) {
    return `${cleanBase} ${cleanNext}`;
  }
  return `${cleanBase}, ${cleanNext}`;
}

function extendAddressLines(lines: string[], start: number): string {
  let address = lines[start]?.trim() ?? '';
  for (let i = start + 1; i < Math.min(lines.length, start + 4); i += 1) {
    const line = lines[i]?.trim() ?? '';
    if (!looksLikeAddressContinuation(line)) break;
    const next = appendAddressFragment(address, line);
    if (next.length > 160) break;
    address = next;
  }
  return address.replace(/\s+/g, ' ').trim();
}

function findAddress(text: string): string {
  // 1. Explicit labeled address
  const labeled = firstMatch(text, [
    /(?:address|location|where\s+you(?:'|’)?re\s+going|where\s+to\s+go)\s*[:#-]?\s*(?:(?:\r?\n\s*)?)([^\n]{5,120})/i,
  ]);
  if (labeled && looksLikeStreetAddress(labeled)) {
    return labeled.replace(/\s+/g, ' ').trim();
  }

  // 2. High-confidence line (+ wrapped Airbnb geo continuations)
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  for (let i = 0; i < lines.length; i += 1) {
    if (!looksLikeStreetAddress(lines[i])) continue;
    const extended = extendAddressLines(lines, i);
    if (looksLikeStreetAddress(extended) || extended.includes(',')) {
      return extended;
    }
  }

  // If unclear or not found with high confidence, return empty string so the user can manually enter it
  return '';
}

function findStayNotes(text: string): string {
  const notesParts: string[] = [];

  const host = firstMatch(text, [
    /(?:hosted\s+by|host)\s*[:#-]?\s*(?:(?:\r?\n\s*)?)([A-Za-z0-9 &',.-]{2,60})/i,
  ]);
  if (
    host &&
    !/^(?:details|information|guest|airbnb|booking|payment|who)$/i.test(
      host.trim(),
    )
  ) {
    const cleanHost = host.replace(/^hosted\s+by\s+/i, '').trim();
    if (cleanHost) notesParts.push(`Hosted by ${cleanHost}`);
  }

  const hostContact = firstMatch(text, [
    /(?:call\s+host|host\s+phone|host\s+contact|contact\s+host|phone)\s*[:#-]?\s*(?:(?:\r?\n\s*)?)([+\d\s().-]{7,25})/i,
  ]);
  if (hostContact) {
    notesParts.push(`Host phone: ${hostContact.trim()}`);
  }

  const guests = firstMatch(text, [
    /(?:who(?:'|’)?s\s+coming|guests?)\s*[:#-]?\s*(?:(?:\r?\n\s*)?)(\d+\s+guests?|\d+\s+adults?(?:,\s*\d+\s+children)?)/i,
    /\b(\d+\s+guests?)\b/i,
  ]);
  if (guests) {
    notesParts.push(guests.trim());
  }

  const instructions = firstMatch(text, [
    /(?:check[\s-]?in\s+instructions?|access\s+code|door\s+code|lockbox|wifi\s+network|wifi\s+password|wifi)\s*[:#-]?\s*([^\n]{3,120})/i,
  ]);
  if (instructions && !/^(?:minimum|you\s+may)/i.test(instructions.trim())) {
    notesParts.push(instructions.trim());
  }

  return notesParts.join('\n');
}

function findBookingUrl(text: string): string {
  return (
    firstMatch(text, [
      /\b(https?:\/\/(?:www\.)?(?:booking\.com|hotels\.com|airbnb\.com|expedia\.com|hilton\.com|marriott\.com|ihg\.com|trivago\.(?:com|deals))[^\s]*)/i,
      /\b(https?:\/\/[^\s]{12,160})/i,
    ]) ?? ''
  );
}

function hotelNameFromFileName(fileName?: string): string | undefined {
  if (!fileName) return undefined;
  const base = fileName
    .replace(/\.[^.]+$/, '')
    .replace(/^booking[_\s-]*/i, '')
    .replace(/^airbnb[_\s-]*/i, '')
    .replace(/[_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (base.length < 3) return undefined;
  if (
    /^(?:airbnb|itinerary|reservation|confirmation|document|scan|image|screenshot)/i.test(
      base,
    )
  ) {
    return undefined;
  }
  if (/^[A-Z0-9-]{6,24}$/i.test(base)) return undefined;
  return base;
}

function pickStayTime(
  prefixed: number[],
  fallback: number[],
): number | undefined {
  if (prefixed.length > 0) return prefixed[0];
  if (fallback.length > 0) return fallback[0];
  return undefined;
}

export function parseStayConfirmation(
  sourceText: string,
  tripRange?: { startDate: string; endDate: string },
  options?: { fileName?: string },
): ParsedStayConfirmation {
  const text = sourceText
    .replace(/\r/g, '\n')
    .replace(PRINT_HEADER, ' ')
    .replace(/[ \t]+/g, ' ');
  const stay = emptyStayDetailsDraft();
  stay.checkoutMinutes = '';
  stay.confirmationCode = findConfirmationCode(text);

  const fallbackYear = resolveFallbackYear();

  const labeledDates = findLabeledStayDates(text, fallbackYear);

  const checkinSections = collectLabeledSections(text, CHECKIN_LABEL, CHECKOUT_LABEL);
  const checkoutSections = collectLabeledSections(text, CHECKOUT_LABEL);
  const checkinSection = checkinSections[0] || sectionBetween(text, CHECKIN_LABEL, CHECKOUT_LABEL);
  const checkoutSection =
    checkoutSections[0] || sectionBetween(text, CHECKOUT_LABEL);

  const checkinDates = [
    ...(labeledDates.checkin ? [labeledDates.checkin] : []),
    ...collectDates(checkinSection || text, fallbackYear),
  ];
  const checkoutDates = [
    ...(labeledDates.checkout ? [labeledDates.checkout] : []),
    ...collectDates(checkoutSection || text, fallbackYear),
  ];
  const allDates = [...new Set(collectDates(text, fallbackYear))].sort();
  const inRange = allDates.filter(
    (value) =>
      (!tripRange?.startDate || value >= tripRange.startDate) &&
      (!tripRange?.endDate || value <= tripRange.endDate),
  );
  const datePool = inRange.length >= 2 ? inRange : allDates;

  let checkinDate =
    labeledDates.checkin ??
    preferDateInRange(checkinDates, tripRange?.startDate, tripRange?.endDate);
  const resolvedCheckin = checkinDate;
  const checkoutOnOrAfterCheckin = resolvedCheckin
    ? checkoutDates.filter((value) => value >= resolvedCheckin)
    : checkoutDates;
  const checkoutRolledToNextYear =
    resolvedCheckin && checkoutOnOrAfterCheckin.length === 0
      ? checkoutDates
          .map((value) => bumpDateKeyYear(value, 1))
          .filter(
            (value): value is string =>
              typeof value === 'string' && value >= resolvedCheckin,
          )
      : [];
  let checkoutDate =
    ensureCheckoutOnOrAfterCheckin(resolvedCheckin, labeledDates.checkout) ??
    preferDateInRange(
      checkoutOnOrAfterCheckin.length
        ? checkoutOnOrAfterCheckin
        : checkoutRolledToNextYear.length
          ? checkoutRolledToNextYear
          : checkoutDates,
      tripRange?.startDate,
      tripRange?.endDate,
    );
  if (!checkinDate && datePool[0]) checkinDate = datePool[0];
  if (!checkoutDate && datePool.length > 1) {
    checkoutDate = datePool[datePool.length - 1];
  }
  checkoutDate = ensureCheckoutOnOrAfterCheckin(checkinDate, checkoutDate);
  if (checkoutDate) stay.checkoutDate = checkoutDate;

  const checkinPrefixed = checkinSections.flatMap(findPrefixedTimes);
  const checkoutPrefixed = checkoutSections.flatMap(findPrefixedTimes);
  // Global From/Until as last resort (Arrival details block).
  const globalPrefixed = findPrefixedTimes(text);
  const checkinFallback = checkinSections.flatMap(findTimes);
  const checkoutFallback = checkoutSections.flatMap(findTimes);

  const startMinutes = pickStayTime(
    checkinPrefixed.length ? checkinPrefixed : globalPrefixed.slice(0, 1),
    checkinFallback,
  );
  // For checkout, prefer Until/After in checkout sections; if only one global
  // prefixed pair exists, use the second (Until) when check-in took the first.
  const checkoutPrefixedOrGlobal =
    checkoutPrefixed.length > 0
      ? checkoutPrefixed
      : globalPrefixed.length > 1
        ? globalPrefixed.slice(1)
        : globalPrefixed.length === 1 && startMinutes === undefined
          ? globalPrefixed
          : [];
  const checkoutMinutes = pickStayTime(checkoutPrefixedOrGlobal, checkoutFallback);
  if (checkoutMinutes !== undefined) {
    stay.checkoutMinutes = String(checkoutMinutes);
  }

  const fromText = findHotelName(text);
  const fromFile = hotelNameFromFileName(options?.fileName);
  let hotelName =
    (fromFile &&
    /hotel|inn|resort|hostel|suite|apartment|guesthouse|centerhotel/i.test(
      fromFile,
    )
      ? fromFile
      : fromText) ||
    fromFile ||
    fromText ||
    '';
  const address = findAddress(text);
  // Airbnb trip pages often omit a listing title — use the city from the address.
  const weakTitle =
    !hotelName ||
    /^hosted\s+by\b/i.test(hotelName) ||
    /^(?:after|before|from|until)\b/i.test(hotelName) ||
    /\b(?:am|pm)\b/i.test(hotelName) ||
    looksLikeAddressContinuation(hotelName);
  if (weakTitle && address) {
    const city = address.split(',')[0]?.trim();
    if (city && city.length >= 3 && city.length <= 60) {
      hotelName = city;
    }
  }
  const bookingUrl = findBookingUrl(text);
  const details = address || undefined;

  const money = findConfirmationMoney(text);
  if (money.amount !== undefined) {
    stay.price = String(money.amount);
    if (money.currency) stay.currency = money.currency;
  }

  const notes = findStayNotes(text);
  if (notes) stay.notes = notes;

  const detectedFieldCount =
    (stay.confirmationCode ? 1 : 0) +
    (stay.checkoutDate ? 1 : 0) +
    (checkinDate ? 1 : 0) +
    (startMinutes !== undefined ? 1 : 0) +
    (hotelName ? 1 : 0) +
    (details ? 1 : 0) +
    (bookingUrl ? 1 : 0) +
    (stay.notes ? 1 : 0) +
    (money.amount !== undefined ? 1 : 0);

  return {
    stay,
    title: hotelName || undefined,
    date: checkinDate,
    startMinutes,
    details,
    bookingUrl: bookingUrl || undefined,
    amount: money.amount,
    currency: money.currency,
    detectedFieldCount,
  };
}
