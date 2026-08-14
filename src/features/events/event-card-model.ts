import type { EventCardSection } from '@/services/events';

export type FightCardMatchup = {
  redCorner: string;
  blueCorner?: string;
};

export type FighterMetaPart = 'flag' | 'record';

/** Keep flags on the portrait-facing edge while mirroring opposing corners. */
export function fighterMetaOrder(side: 'left' | 'right'): FighterMetaPart[] {
  return side === 'right' ? ['record', 'flag'] : ['flag', 'record'];
}

export function fightCardBoutCountLabel(count: number) {
  return `${count} ${count === 1 ? 'Bout' : 'Bouts'}`;
}

/** Expand ESPN's abbreviated women's divisions, including persisted older events. */
export function fightCardWeightClassLabel(label: string | undefined) {
  return label?.trim().replace(/^W\s+/i, "Women's ");
}

export function fightCardSectionLabel(section: EventCardSection) {
  switch (section) {
    case 'main': return 'Main';
    case 'prelims': return 'Prelims';
    case 'early-prelims': return 'Early Prelims';
  }
}

export function fightCardBoutBilling(section: EventCardSection, sectionIndex: number) {
  if (section !== 'main') return undefined;
  if (sectionIndex === 0) return 'Main Event';
  if (sectionIndex === 1) return 'Co-Main';
  return undefined;
}

export function fightCardBoutStatusLabel(
  status: string | undefined,
  period: number | undefined,
  displayClock: string | undefined,
) {
  const normalized = status?.trim().toLowerCase();
  if (!normalized || normalized.includes('scheduled')) return undefined;
  if (normalized.includes('progress') || normalized === 'live') {
    return [period ? `Round ${period}` : 'Live', displayClock].filter(Boolean).join(' · ');
  }
  if (normalized.includes('final') || normalized.includes('complete')) {
    return ['Final', period ? `R${period}` : undefined, displayClock]
      .filter(Boolean)
      .join(' · ');
  }
  return status?.trim();
}

/** Split provider fight labels without losing malformed or one-sided entries. */
export function splitFightCardMatchup(label: string): FightCardMatchup {
  const normalized = label.trim();
  const separator = /\s+(?:vs?\.?|versus)\s+/i.exec(normalized);
  if (!separator || separator.index == null) {
    return { redCorner: normalized };
  }

  const redCorner = normalized.slice(0, separator.index).trim();
  const blueCorner = normalized
    .slice(separator.index + separator[0].length)
    .trim();

  if (!redCorner || !blueCorner) {
    return { redCorner: normalized };
  }

  return { redCorner, blueCorner };
}
