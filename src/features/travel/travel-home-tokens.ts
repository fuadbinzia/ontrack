/**
 * Travel Home design tokens — locked to `design/travel/references/original-user-reference.png`
 * (also copied to `travel-home-reference.png` for the compare tool).
 *
 * Geometry is width-relative to the 853px reference canvas.
 * Prefer `travelHomeImageHeight(cardWidth)` over a fixed image height.
 */
import { Platform } from 'react-native';

import { glassMaterials } from '@/design-system/glass';

export const TRAVEL_HOME_REFERENCE_WIDTH = 853;

/** Travel Home display face — iOS Times New Roman; Android platform serif. */
export const travelHomeFontFamily = Platform.select({
  ios: 'Times New Roman',
  android: 'serif',
  default: 'Times New Roman',
}) as string;

export const travelHomeTokens = {
  colors: {
    ink: '#000000',
    /** @deprecated Prefer `ink` — kept for fixture snapshot keys. */
    navy: '#000000',
    /** Secondary / meta ink — neutral gray. */
    inkMuted: '#5A5A5A',
    /** Atmosphere-band copy over the photo wash (title / tagline / section). */
    atmosphereInk: '#000000',
    atmosphereInkMuted: '#1A1A1A',
    brandBlue: '#2F6FED',
    brandBlueSoft: '#E8F1FF',
    /** Header flight motif — warm gold (richer than mock-sample tan). */
    motifTan: '#D0AE6E',
    surface: '#FFFFFF',
    surfaceMuted: '#F4F6F9',
    /** Top-of-atmosphere sky (status-bar chrome fill) — light. */
    atmosphereSky: '#F3EAE2',
    /** Top-of-atmosphere night (status-bar chrome fill) — dark. */
    atmosphereNight: '#000000',
    divider: '#E4EAF2',
    /** Outlined location chip stroke (mock light-grey bar). */
    locationChipBorder: '#D7DDE6',
    locationChipBorderDark: 'rgba(255,255,255,0.18)',
    /** Duration pill fill — soft grey, not inverted glass. */
    dayPillSurface: '#EEF1F5',
    dayPillSurfaceDark: 'rgba(255,255,255,0.12)',
    overlayLight: 'rgba(255,255,255,0.92)',
    shadow: 'rgba(0,0,0,0.12)',
    cardShadow: '0 10px 28px rgba(0,0,0,0.12)',
    cardShadowDark: '0 10px 28px rgba(0,0,0,0.35)',
    /** White circular + / edit FABs — soft lift over atmosphere & hero photos. */
    circleFabShadow: '0 8px 20px rgba(0,0,0,0.16)',
    circleFabBorder: 'rgba(0,0,0,0.08)',
    /** Soft lift for glass View Itinerary CTA (light paper). */
    itineraryButtonShadow: glassMaterials.accentGreen.shadow,
    /** Soft lift for glass View Itinerary CTA (dark meta). */
    itineraryButtonShadowDark: glassMaterials.accentGreen.shadowDark,
    itineraryButtonBorder: glassMaterials.border.light,
    /** Solid sage for glyphs that match View Itinerary glass (rgb of fills). */
    itineraryGlassGreen: glassMaterials.accentGreen.solid,
    /** View Itinerary — frosted sage glass (dark meta). */
    itineraryGlassGreenFill: glassMaterials.accentGreen.fill,
    itineraryGlassGreenFillFallback: glassMaterials.accentGreen.fillFallback,
    itineraryGlassGreenBorder: glassMaterials.accentGreen.border,
    /** View Itinerary — denser sage on light paper so white ink stays crisp. */
    itineraryGlassGreenFillLight: glassMaterials.accentGreen.fillLight,
    itineraryGlassGreenFillLightFallback:
      glassMaterials.accentGreen.fillLightFallback,
    itineraryGlassGreenBorderLight: glassMaterials.accentGreen.borderLight,
    itineraryGlassGreenHighlight: 'rgba(160, 210, 170, 0.22)',
    avatarCountText: '#000000',
    avatarCountSurface: '#EBEBEB',
    countCapsule: '#FFFFFF',
    /** Trip-count badge fill in light mode (dark mode inverts to white). */
    countCircle: '#000000',
  },
  radius: {
    /** Outer trip-card corners — design kit `card: 28` (tighter than prior 32). */
    tripCard: 28,
    /** Destination image top corners — match card. */
    heroTop: 28,
    /**
     * White meta panel top corners that overlap the hero photo
     * (the scoop under the destination image).
     */
    bodyTop: 24,
    /** Page paper sheet under Your Trips (atmosphere peeks in wedges). */
    sheetTop: 32,
    /** Full-width location chip under the title. */
    locationChip: 14,
    button: 16,
    itineraryButton: 12,
    pill: 999,
    circleButton: 999,
    sm: 10,
    md: 14,
    lg: 18,
  },
  spacing: {
    screenHorizontal: 20,
    /** Small breath between the Travel subtitle and “Your Trips” search. */
    headerToSection: 12,
    /** Modest gap between “Your Trips” and the first trip card. */
    sectionGap: 8,
    cardHorizontal: 18,
    /** Tight bottom inset — mock white panel is compact, not airy. */
    cardBottom: 12,
    /** Compact title → location gap on the paper body. */
    titleToLocation: 8,
    /** Location chip → footer (dates + View Itinerary). */
    locationToFooter: 14,
    /** Dates meta ↔ View Itinerary in the trip-card footer. */
    datesToItinerary: 16,
    locationToDivider: 6,
    dividerToMeta: 6,
    avatarOverlap: 12,
    cardGap: 14,
    editInset: 14,
    headerBottom: 8,
    /**
     * Minimum frosted title scoop height over the hero (1-line title +
     * travelers). Titles ellipsize on one line — keep this floor in sync with
     * `travelHomeImageHeight`.
     */
    bodyOverlap: 66,
    /**
     * Title band top inset inside the frost scoop — keep enough milk above
     * the baseline so serifs don’t ride the photo→paper seam.
     */
    bodyTop: 26,
    /** Location chip vertical padding. */
    locationChipPadV: 10,
    locationChipPadH: 12,
  },
  sizes: {
    touchTargetMin: 44,
    touchTargetMinAndroid: 48,
    /** Visual diameter; press target padded via hitSlop when needed. */
    addButton: 48,
    editButton: 40,
    avatar: 40,
    avatarCount: 40,
    avatarBorder: 2,
    /**
     * Baseline image height at ~350pt card width (mock ~2.05:1).
     * Prefer `travelHomeImageHeight` for layout.
     */
    tripImageHeightPhone: 193,
    /** Destination image width ÷ visible height (user mock ~2.0–2.1:1). */
    tripImageAspect: 2.05,
    /** Visual height; touch target padded via hitSlop when under 44. */
    itineraryButtonHeight: 42,
    itineraryButtonMaxWidth: 176,
    itineraryIcon: 22,
    itineraryHorizontalPadding: 12,
    /** Display title — matches reference visual cap-height (~69px @ 853 → ~46pt). */
    displayTitle: 46,
    /** “Your Trips” plain title — ref ~42–50px @ 863 → ~19–23pt @ 390; keep below trip titles. */
    sectionTitle: 20,
    /**
     * Search-field placeholder/value inside the ~38pt pill — sits with the
     * leading search glyph; sectionTitle is too tall for the field.
     */
    searchFieldText: 16,
    tripTitle: 28,
    heroMinHeight: 0,
    carouselActiveDot: 7,
    carouselInactiveDot: 5,
    carouselDotGap: 6,
    /** Inset above the glass scoop — page ticks sit on the visible hero band. */
    carouselBottomInset: 10,
    /** Keep atmosphere recognizable (0 = crisp photo). */
    heroBlurRadius: 0,
    countCircle: 24,
  },
  motion: {
    heroCrossfadeMs: 350,
    cardPressMs: 120,
  },
  type: {
    /** ~30% of displayTitle — matches reference title∶tagline proportion. */
    heroTagline: 14,
    /** Optical gap between title ink and tagline ink (ref ~30px @ 853). */
    titleToTaglineGap: 8,
    location: 15,
    metadataLabel: 13,
    /** Footer range — slightly above button label so the CTA doesn’t dominate. */
    date: 20,
    button: 14,
    countLabel: 13,
  },
} as const;

/** Width-relative scale against the user-reference 853px canvas. */
export function travelHomeRefScale(contentWidth: number): number {
  return Math.max(0.5, contentWidth / TRAVEL_HOME_REFERENCE_WIDTH);
}

/**
 * Destination hero height for a measured card width.
 * Adds `bodyOverlap` so the visible band above the overlapping white meta
 * panel keeps the mock aspect (overlap would otherwise shorten it).
 */
export function travelHomeImageHeight(cardWidth: number): number {
  const visible = cardWidth / travelHomeTokens.sizes.tripImageAspect;
  const height = visible + travelHomeTokens.spacing.bodyOverlap;
  return Math.round(Math.min(232, Math.max(160, height)));
}
