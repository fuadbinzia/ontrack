/** Headline never drops below the heading token. */
export const AUTH_RING_HEADLINE_MIN_PT = 23;
/** Intro never drops below the body token. */
export const AUTH_RING_INTRO_MIN_PT = 15.5;

export function authRingCopyType(
  scale: number,
  tokens: {
    display: { fontSize: number; lineHeight: number };
    body: { fontSize: number; lineHeight: number };
  },
): {
  headline: { fontSize: number; lineHeight: number };
  intro: { fontSize: number; lineHeight: number };
  ruleScale: number;
} {
  const safe = Math.min(1, Math.max(0.75, scale));
  const headlineSize = Math.max(
    AUTH_RING_HEADLINE_MIN_PT,
    tokens.display.fontSize * safe,
  );
  const headlineRatio = headlineSize / tokens.display.fontSize;
  return {
    headline: {
      fontSize: headlineSize,
      lineHeight: tokens.display.lineHeight * headlineRatio,
    },
    intro: {
      fontSize: Math.max(AUTH_RING_INTRO_MIN_PT, tokens.body.fontSize),
      lineHeight: tokens.body.lineHeight,
    },
    ruleScale: safe,
  };
}
