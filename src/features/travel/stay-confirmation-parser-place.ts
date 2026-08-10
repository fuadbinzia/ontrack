function firstMatch(text: string, patterns: RegExp[]): string | undefined {
  for (const pattern of patterns) {
    const match = pattern.exec(text);
    if (match?.[1]) return match[1].trim();
  }
  return undefined;
}

export function looksLikeStreetAddress(value: string): boolean {
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

export function findHotelName(text: string): string {
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
export function looksLikeAddressContinuation(line: string): boolean {
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

export function appendAddressFragment(base: string, next: string): string {
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

export function extendAddressLines(lines: string[], start: number): string {
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

export function findAddress(text: string): string {
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

export function findStayNotes(text: string): string {
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

export function findBookingUrl(text: string): string {
  return (
    firstMatch(text, [
      /\b(https?:\/\/(?:www\.)?(?:booking\.com|hotels\.com|airbnb\.com|expedia\.com|hilton\.com|marriott\.com|ihg\.com|trivago\.(?:com|deals))[^\s]*)/i,
      /\b(https?:\/\/[^\s]{12,160})/i,
    ]) ?? ''
  );
}

export function hotelNameFromFileName(fileName?: string): string | undefined {
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

