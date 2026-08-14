import type { EventDetails, EventFollow } from '@/services/events';

export type EventCalendarArtwork = {
  uri: string;
  contentFit: 'contain' | 'cover';
  accessibilityLabel: string;
};

const ESPN_LEAGUE_LOGO_ROOT = 'https://a.espncdn.com/i/teamlogos/leagues/500';

const LEAGUE_MATCHERS: { pattern: RegExp; slug: string; label: string }[] = [
  { pattern: /\bufc\b/i, slug: 'ufc', label: 'UFC' },
  { pattern: /\bwnba\b/i, slug: 'wnba', label: 'WNBA' },
  { pattern: /\bnba\b/i, slug: 'nba', label: 'NBA' },
  { pattern: /\bnfl\b/i, slug: 'nfl', label: 'NFL' },
  { pattern: /\bmlb\b/i, slug: 'mlb', label: 'MLB' },
  { pattern: /\bnhl\b/i, slug: 'nhl', label: 'NHL' },
  { pattern: /\bmls\b/i, slug: 'mls', label: 'MLS' },
  { pattern: /\b(?:formula\s*1|f1)\b/i, slug: 'f1', label: 'Formula 1' },
];

function leagueArtwork(title: string, details?: EventDetails): EventCalendarArtwork | undefined {
  const explicitKind = details?.kind === 'ufc'
    ? LEAGUE_MATCHERS[0]
    : details?.kind === 'nba'
      ? LEAGUE_MATCHERS[2]
      : undefined;
  const league = explicitKind ?? LEAGUE_MATCHERS.find(({ pattern }) => pattern.test(title));
  if (!league) return undefined;
  return {
    uri: `${ESPN_LEAGUE_LOGO_ROOT}/${league.slug}.png`,
    contentFit: 'contain',
    accessibilityLabel: `${league.label} logo`,
  };
}

/**
 * Logo-first artwork for calendar rows. Follow targets are the strongest identity
 * signal (usually a team, promotion, or artist mark); known league marks come
 * next, then provider event art. The caller owns the generic category fallback.
 */
export function resolveEventCalendarArtwork(
  title: string,
  details?: EventDetails,
  follow?: EventFollow,
): EventCalendarArtwork | undefined {
  if (follow?.imageUrl) {
    const isLogo = follow.targetKind !== 'artist';
    return {
      uri: follow.imageUrl,
      contentFit: isLogo ? 'contain' : 'cover',
      accessibilityLabel: `${follow.name} ${isLogo ? 'logo' : 'artwork'}`,
    };
  }

  const league = leagueArtwork(title, details);
  if (league) return league;

  if (!details?.imageUrl) return undefined;
  return {
    uri: details.imageUrl,
    contentFit: 'cover',
    accessibilityLabel: `${title} artwork`,
  };
}
