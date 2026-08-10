/** Terminal and gate labels/parsers for flight confirmations and cards. */

type FlightFacility = 'terminal' | 'gate';

function formatFacility(
  facility: FlightFacility,
  value?: string,
): string | undefined {
  const text = value?.trim().replace(/\s+/g, ' ');
  if (!text) return undefined;
  const label = facility === 'terminal' ? 'Terminal' : 'Gate';
  return new RegExp(`^${facility}\\b`, 'i').test(text) ? text : `${label} ${text}`;
}

export function formatFlightTerminal(value?: string): string | undefined {
  return formatFacility('terminal', value);
}

export function formatFlightGate(value?: string): string | undefined {
  return formatFacility('gate', value);
}

function normalizeFacility(facility: FlightFacility, value?: string): string {
  return (
    value
      ?.replace(new RegExp(`^${facility}\\s*`, 'i'), '')
      .replace(/\s+/g, ' ')
      .replace(/[.,;:]+$/, '')
      .trim()
      .slice(0, 24) ?? ''
  );
}

function parseLabeledFacility(
  facility: FlightFacility,
  text: string,
  kind: 'departure' | 'arrival',
): string {
  const role =
    kind === 'departure'
      ? '(?:departure|departing|origin)'
      : '(?:arrival|arriving|destination)';
  const patterns = [
    new RegExp(
      `${role}(?:\\s+airport)?\\s+${facility}\\s*[:#-]?\\s*([^\\n|]{1,24})`,
      'i',
    ),
    new RegExp(
      `${facility}\\s+(?:for\\s+)?${role}\\s*[:#-]?\\s*([^\\n|]{1,24})`,
      'i',
    ),
  ];
  for (const pattern of patterns) {
    const value = pattern.exec(text)?.[1];
    if (value) return normalizeFacility(facility, value);
  }
  return '';
}

export function parseLabeledFlightTerminal(
  text: string,
  kind: 'departure' | 'arrival',
): string {
  return parseLabeledFacility('terminal', text, kind);
}

export function parseLabeledFlightGate(
  text: string,
  kind: 'departure' | 'arrival',
): string {
  const labeled = parseLabeledFacility('gate', text, kind);
  if (labeled || kind === 'arrival') return labeled;
  // A lone "Gate B12" on a boarding pass is always the departure gate.
  const bare = /\bgate\s*[:#-]?\s*([A-Z]{0,2}\s?\d{1,3}[A-Z]?)\b/i.exec(text);
  return normalizeFacility('gate', bare?.[1]);
}

/**
 * JetBlue-style trip detail stacks bare "Terminal …" / "Gate …" under each
 * airport column (departure then arrival). Ignore placeholder "-".
 */
function parseOrderedBareFacilities(
  facility: FlightFacility,
  text: string,
): { departure: string; arrival: string } {
  const values = Array.from(
    text.matchAll(new RegExp(`^\\s*${facility}\\s+([^\\n|]{1,24})\\s*$`, 'gim')),
  )
    .map((match) => normalizeFacility(facility, match[1]))
    .filter((value) => value.length > 0 && value !== '-');
  return {
    departure: values[0] ?? '',
    arrival: values[1] ?? '',
  };
}

export function parseOrderedBareFlightTerminals(text: string): {
  departure: string;
  arrival: string;
} {
  return parseOrderedBareFacilities('terminal', text);
}

export function parseOrderedBareFlightGates(text: string): {
  departure: string;
  arrival: string;
} {
  return parseOrderedBareFacilities('gate', text);
}
