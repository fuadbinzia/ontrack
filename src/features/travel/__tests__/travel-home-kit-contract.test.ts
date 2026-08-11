import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
    travelHomeFixture,
    travelHomeTokenContract,
    travelHomeVisualScenarios,
} from '@/features/travel/fixtures/travel-home';
import { travelHomeAtmosphereHeight } from '@/features/travel/travel-home-background';
import {
    TRAVEL_HOME_PLANE_ROTATION_DEG,
    travelHomePlaneRearAxisUnit,
    travelHomePlaneTailMidVb,
    travelHomePlaneTransformPoint,
    travelHomeTrailStartVb,
} from '@/features/travel/travel-home-icons';
import { travelHomeTokens } from '@/features/travel/travel-home-tokens';

describe('travel home kit contract', () => {
  it('keeps the trip hero ScrollView always mounted (Fabric crash guard)', () => {
    // Conditionally mounting ScrollView / dots as Fabric siblings SIGABRTs on
    // iOS (`unmountChildComponentView` index mismatch on the 362×199 hero).
    const source = readFileSync(
      join(process.cwd(), 'src/features/travel/travel-home-hero-carousel.tsx'),
      'utf8',
    );
    expect(source).toContain('collapsable={false}');
    expect(source).toContain('heroPageSlots');
    expect(source).toContain('scrollEnabled={scrollInteractive}');
    // Uploads win; else rotating live destination heroes. Scenic underlay is
    // loading/miss only — never a static stand-in carousel page.
    expect(source).toContain('TravelHomeCarouselStepper');
    expect(source).toContain('uploadedTripCoverUris');
    expect(source).toContain('fetchDestinationHeroUris');
    expect(source).not.toContain('fetchRemoteDestinationCoverUri');
    expect(source).not.toMatch(
      /fetchDestinationCoverUri\s*\(/,
    );
    expect(source).not.toContain('placeholderUri');
    expect(source).toContain(
      'count={hasPaintedRemote ? visibleUris.length : 0}',
    );
    expect(source).not.toMatch(
      /visibleUris\.length\s*>\s*0\s*\?\s*\(\s*<ScrollView/,
    );
  });

  it('biases trip-card heroes below center so sky-heavy plates are not empty', () => {
    const source = readFileSync(
      join(process.cwd(), 'src/features/travel/travel-home-hero-carousel.tsx'),
      'utf8',
    );
    expect(source).toContain('travelHomeHeroContentPosition');
    expect(source).toContain('travelHomeHeroOverscanStyle');
    expect(source).toContain('peekUnsplashCoverColor');
  });

  it('keeps scenic underlay until a remote hero actually paints', () => {
    // URI presence alone hid the fixture on Android while proxies were loading
    // → brandBlueSoft empty cards. Remotes must stay opaque underneath (iOS
    // never fires onLoad inside opacity:0) with the scenic plate covering on top.
    const source = readFileSync(
      join(process.cwd(), 'src/features/travel/travel-home-hero-carousel.tsx'),
      'utf8',
    );
    expect(source).toContain('hasPaintedRemote');
    expect(source).toContain('paintedRemoteUri');
    expect(source).toContain('onLoad');
    expect(source).toContain('scenicUnderlay');
    expect(source).toContain('opacity: hasPaintedRemote ? 0 : 1');
    // Scenic plate sits above the paging remotes until one paints.
    expect(source).toContain('zIndex: 2');
    expect(source).not.toContain('{ opacity: hasPaintedRemote ? 1 : 0 }');
    expect(source).not.toContain('opacity: fixtureSource && !hasRemoteHeroes ? 1 : 0');
  });

  it('keeps the trip-card stepper shell always mounted (Fabric crash guard)', () => {
    // Conditionally returning null from the stepper SIGABRTs when remounting
    // near hero / frost BlurView siblings — collapse via height/opacity instead.
    const stepper = readFileSync(
      join(process.cwd(), 'src/features/travel/travel-home-carousel-stepper.tsx'),
      'utf8',
    );
    expect(stepper).toContain('wrapCollapsed');
    expect(stepper).not.toMatch(/if\s*\(\s*pageCount\s*<=\s*1\s*\)\s*return\s*null/);
  });

  it('stacks weekdays + soft day-count pill in the dates slot', () => {
    const dateBlock = readFileSync(
      join(process.cwd(), 'src/features/travel/travel-home-date-block.tsx'),
      'utf8',
    );
    const card = readFileSync(
      join(process.cwd(), 'src/features/travel/travel-home-trip-card.tsx'),
      'utf8',
    );
    expect(dateBlock).toContain('formatTripDateRangeLabel');
    expect(dateBlock).toContain('formatTripWeekdayRangeLabel');
    expect(dateBlock).toContain('tripDayCount');
    expect(dateBlock).toContain('dayPill');
    expect(dateBlock).not.toContain('TravelHomeCalendarIcon');
    expect(dateBlock).toContain('dayPillSurface');
    expect(dateBlock).not.toContain('metaRule');
    expect(dateBlock).toContain('travelHomeTokens.radius.itineraryButton');
    // Content-sized height — stretch-to-CTA clips the calendar range.
    expect(dateBlock).toContain("alignSelf: 'center'");
    expect(card).toContain("alignItems: compact ? 'stretch' : 'center'");
    expect(dateBlock).not.toContain('DATES');
    // Soft grey duration pill — not inverted glass / brand-blue soft.
    expect(dateBlock).not.toContain('TravelHomeGlass');
    expect(dateBlock).not.toContain('brandBlueSoft');
    // Plain pin + destination (no glass pill); frosted meta body; no hairline.
    expect(card).toContain('styles.locationRow');
    expect(card).not.toContain('styles.locationChip');
    expect(card).not.toContain('styles.divider');
    expect(card).toContain('styles.metaBody');
    expect(card).toMatch(/<TravelHomeGlass[\s\S]*?styles\.metaBody/);
    // Pin matches View Itinerary sage (not brand blue).
    expect(card).toContain('itineraryGlassGreen');
    expect(card).not.toContain('brandBlue');
    // View Itinerary = frosted sage glass (both themes); not solid ink/brand.
    expect(card).toContain('TravelHomeGlass');
    expect(card).toContain('accent="green"');
    // Android: hug CTA (no flex grow) + never shrink below the full label.
    expect(card).toContain('compact || Platform.OS === \'android\' ? undefined : 1');
    expect(card).toContain("flexGrow: Platform.OS === 'android' && !compact ? 0");
    expect(card).toContain("flexShrink: Platform.OS === 'android' ? 0 : 1");
    expect(card).toContain('View Itinerary');
    expect(card).toMatch(/flexShrink:\s*0/);
  });

  it('frosts trip-card scoops with BlurView over the live hero', () => {
    // Photo→paper: iOS BlurView + paper title veil + separate paper milk.
    // No single black→white ramp (muddy shelf); no Android blur Image plate.
    const scoop = readFileSync(
      join(process.cwd(), 'src/features/travel/travel-home-trip-frost-scoop.tsx'),
      'utf8',
    );
    const card = readFileSync(
      join(process.cwd(), 'src/features/travel/travel-home-trip-card.tsx'),
      'utf8',
    );
    const glass = readFileSync(
      join(process.cwd(), 'src/features/travel/travel-home-glass.tsx'),
      'utf8',
    );
    const tokens = readFileSync(
      join(process.cwd(), 'src/features/travel/travel-home-tokens.ts'),
      'utf8',
    );
    const stepper = readFileSync(
      join(process.cwd(), 'src/features/travel/travel-home-carousel-stepper.tsx'),
      'utf8',
    );
    expect(scoop).toContain('tint="light"');
    expect(scoop).toContain('<BlurView');
    expect(scoop).toContain("Platform.OS === 'ios'");
    expect(card).toContain('titleInk = dark ? theme.textPrimary : travelHomeTokens.colors.ink');
    expect(scoop).toContain('blurKey');
    expect(scoop).toContain('LinearGradient');
    expect(scoop).toContain('fadeBleed');
    expect(scoop).toContain('paperColor');
    expect(scoop).toContain('hexToRgba');
    expect(scoop).toContain('fadeHeight = totalHeight');
    expect(scoop).toContain('milkHeight');
    expect(scoop).toContain('borderWidth: 0');
    // Join milk + SVG continuous swoop (soft left lift → crest → ease right).
    expect(scoop.match(/<LinearGradient/g)?.length ?? 0).toBeGreaterThanOrEqual(1);
    expect(scoop).not.toContain('rgba(0,0,0,');
    expect(scoop).toContain('joinHeight');
    expect(scoop).toContain('titleMilk');
    expect(scoop).toContain('titleSide');
    expect(scoop).toContain('sideBoost');
    expect(scoop).toContain('veilPath');
    expect(scoop).toContain('valleyY');
    expect(scoop).toContain('leftY');
    expect(scoop).toContain('rightY');
    expect(scoop).toContain('titleMidGlow');
    expect(scoop).toContain('<Ellipse');
    expect(scoop).not.toContain('midGlowPath');
    expect(scoop).toMatch(/C 16 \$\{leftY\}/);
    expect(scoop).not.toContain('leftTop');
    expect(scoop).toContain('preserveAspectRatio="none"');
    expect(scoop).toContain("from 'react-native-svg'");
    // Gradient-led milk-out — no Android expo-image blur plate.
    expect(scoop).not.toContain("from 'expo-image'");
    expect(scoop).not.toContain('blurRadius');
    expect(scoop).not.toContain('heroHeight');
    // Bleed sealed solid under the ramp.
    expect(scoop).toContain('backgroundColor: paperColor');
    // Scoop shell itself must stay overflow-visible for UIVisualEffect.
    expect(scoop).toMatch(/scoop:\s*\{[^}]*backgroundColor:\s*'transparent'/);
    expect(scoop).not.toMatch(/scoop:\s*\{[^}]*overflow:\s*'hidden'/);
    expect(card).toContain('TravelHomeTripFrostScoop');
    expect(card).toContain('frostFadeBleed');
    expect(card).toContain('styles.frostBand');
    expect(card).toContain('styles.heroMedia');
    expect(card).toContain('blurKey=');
    expect(card).toContain('frostBlurKey');
    expect(card).toContain('frostBandHeight');
    expect(card).toContain('numberOfLines={1}');
    expect(card).toContain('ellipsizeMode="tail"');
    expect(card).not.toContain('heroFrostSource');
    expect(card).not.toContain('styles.clip');
    expect(card).not.toContain('frost=');
    expect(card).not.toContain('BlurTargetView');
    expect(glass).not.toContain('frost?:');
    expect(glass).not.toContain('TravelHomeGlassFrost');
    expect(tokens).toMatch(/bodyOverlap:\s*66/);
    expect(card).toContain('styles.locationRow');
    expect(card).toContain('titleCluster');
    // Location in frost scoop; title (+ travelers) on paper when destination set.
    expect(card).toContain('locationRow ?? titleBlock');
    expect(card).toContain('styles.metaBody');
    // Serif title ink room — tight 1.1× lineHeight clips glyph bottoms in metaBody.
    expect(card).toContain('titleSize * 1.22');
    // Ticks mount inside the hero carousel (visibleUris) with a dark plate so
    // they read on pale sky without waiting for a swipe.
    expect(stepper).toContain('wrapCollapsed');
    expect(stepper).toContain('styles.plate');
    expect(stepper).toContain("rgba(0,0,0,0.42)");
  });

  it('keeps the section search plate as a row (glass children stay flex kids)', () => {
    const header = readFileSync(
      join(process.cwd(), 'src/features/travel/travel-home-section-header.tsx'),
      'utf8',
    );
    expect(header).toContain('flexDirection: \'row\'');
    expect(header).toContain('styles.search');
    expect(header).toContain('styles.badge');
    // Compact title chip until tap; width + crossfade expand/collapse.
    expect(header).toContain('withTiming');
    expect(header).toContain('shellStyle');
    expect(header).toContain('onTextLayout');
    expect(header).toContain('setSearchOpen(true)');
    expect(header).toContain('collapseSearch');
    expect(header).toContain('searchMinimize');
    expect(header).toContain('{title}');
    // Theme-native plate/scoop; count badge stays inverted + white ink.
    expect(header).toMatch(/<TravelHomeGlass[\s\S]*?\binverted\b/);
    expect(header).toMatch(
      /inverted[\s\S]*?color:\s*'#FFFFFF'[\s\S]*?\{count\}/,
    );
    expect(header).not.toContain('plateDark');
    expect(header).not.toContain('scoopLight');
    // Count sits at the far right inside the search scoop.
    expect(header).toMatch(/\{renderCountBadge\(\)\}/);
  });

  it('grounds a solo trip with an atmosphere-tinted bottom shadow', () => {
    const card = readFileSync(
      join(process.cwd(), 'src/features/travel/travel-home-trip-card.tsx'),
      'utf8',
    );
    const yourTrips = readFileSync(
      join(process.cwd(), 'src/features/travel/travel-home-your-trips.tsx'),
      'utf8',
    );
    const screen = readFileSync(
      join(
        process.cwd(),
        'src/features/travel/travel-home-screen-content.tsx',
      ),
      'utf8',
    );
    expect(card).toContain('soloAtmosphereShadow');
    expect(card).toContain('travelHomeSoloTripCardShadow');
    expect(yourTrips).toContain('soloAtmosphereShadow={plans.length === 1}');
    expect(screen).toContain(
      'atmosphereAverageColor={atmosphereImage.averageColor}',
    );
  });

  it('replays trip-card FadeInDown on every Travel focus (tab land bounce)', () => {
    // FadeInDown is mount-only; tab stays mounted (and preload can mount
    // off-screen) — entranceKey + useFocusEffect remounts the list each land.
    const yourTrips = readFileSync(
      join(process.cwd(), 'src/features/travel/travel-home-your-trips.tsx'),
      'utf8',
    );
    const card = readFileSync(
      join(process.cwd(), 'src/features/travel/travel-home-trip-card.tsx'),
      'utf8',
    );
    expect(yourTrips).toContain('useFocusEffect');
    expect(yourTrips).toContain('entranceKey');
    expect(yourTrips).toContain('key={`${entranceKey}-');
    expect(card).toContain('FadeInDown');
    expect(card).toContain('springify()');
  });

  it('keeps search results on static card geometry', () => {
    const yourTrips = readFileSync(
      join(process.cwd(), 'src/features/travel/travel-home-your-trips.tsx'),
      'utf8',
    );
    const card = readFileSync(
      join(process.cwd(), 'src/features/travel/travel-home-trip-card.tsx'),
      'utf8',
    );
    expect(yourTrips).toContain("searchActive ? 'search' : 'browse'");
    expect(yourTrips).toContain('animateEntrance={!searchActive}');
    expect(card).toContain('animateEntrance = true');
    expect(card).toMatch(/animateEntrance[\s\S]*?FadeInDown[\s\S]*?: undefined/);
  });

  it('keeps the travel map full-page, including the status bar', () => {
    const windowHeight = 852;
    const topInset = 59;
    const band = travelHomeAtmosphereHeight(windowHeight, topInset);
    expect(band).toBe(windowHeight);
    const emptyBand = travelHomeAtmosphereHeight(windowHeight, topInset, {
      empty: true,
    });
    expect(emptyBand).toBe(windowHeight);
    const travelTab = readFileSync(
      join(
        process.cwd(),
        'src/features/travel/travel-home-screen-content.tsx',
      ),
      'utf8',
    );
    const atmosphereChrome = readFileSync(
      join(
        process.cwd(),
        'src/features/travel/use-travel-home-atmosphere-chrome.tsx',
      ),
      'utf8',
    );
    const background = readFileSync(
      join(
        process.cwd(),
        'src/features/travel/travel-home-background.tsx',
      ),
      'utf8',
    );
    // AppSafeArea owns the full-window map so it continues under the status bar.
    expect(travelTab).toContain('TravelHomeBackground');
    expect(travelTab).toContain('empty={hasNoTrips}');
    expect(travelTab).toContain('TravelHomeEmpty');
    expect(atmosphereChrome).toContain('backgroundImage: atmosphereImage.source');
    expect(atmosphereChrome).toContain('TRAVEL_HOME_MAP_BACKGROUND');
    expect(background).toContain('travel-home-map-full-v2.png');
    expect(background).not.toContain('LinearGradient');
    expect(atmosphereChrome).toContain('priority: 1');
    expect(travelTab).toContain('style={styles.transparentScreen}');
  });

  it('does not auto-open New Trip over the zero-trip welcome', () => {
    const screenHook = readFileSync(
      join(process.cwd(), 'src/features/travel/use-travel-home-screen.ts'),
      'utf8',
    );
    expect(screenHook).toContain('const [showForm, setShowForm] = useState(false)');
    expect(screenHook).not.toContain('useState(plans.length === 0)');
  });

  it('uses one glass primary action for the zero-trip departure card', () => {
    const empty = readFileSync(
      join(process.cwd(), 'src/features/travel/travel-home-empty.tsx'),
      'utf8',
    );
    const screen = readFileSync(
      join(
        process.cwd(),
        'src/features/travel/travel-home-screen-content.tsx',
      ),
      'utf8',
    );
    expect(empty).toContain('<TravelHomeGlass');
    expect(empty).toContain('<TravelHomeRouteIcon');
    expect(empty).toContain('Your next adventure starts here.');
    expect(empty).toContain('Add Your First Trip');
    expect(screen).toContain(
      'onAddTrip={!showForm && !hasNoTrips ? openCreateTrip : undefined}',
    );
  });

  it('keeps layout tokens aligned with design/travel', () => {
    expect(travelHomeTokens.spacing.headerToSection).toBe(12);
    expect(travelHomeTokens.spacing.sectionGap).toBe(8);
    expect(travelHomeTokenContract()).toEqual({
      screenHorizontal: 20,
      cardGap: 14,
      tripCardRadius: 28,
      imageHeight: 193,
      editButton: 40,
      avatar: 40,
      avatarOverlap: 12,
      itineraryHeight: 42,
      itineraryRadius: 12,
      activeDot: 7,
      inactiveDot: 5,
      heroCrossfadeMs: 350,
      navy: '#000000',
    });
  });

  it('keeps header flight motif on Material flight + mock gold', () => {
    expect(travelHomeTokens.colors.motifTan).toBe('#D0AE6E');
    expect(TRAVEL_HOME_PLANE_ROTATION_DEG).toBe(-62);
    const kit = readFileSync(
      join(process.cwd(), 'design/travel/assets/icons/travel-route.svg'),
      'utf8',
    );
    const bundled = readFileSync(
      join(process.cwd(), 'assets/images/travel/icons/travel-route.svg'),
      'utf8',
    );
    for (const svg of [kit, bundled]) {
      expect(svg).toContain('M21 16v-2l-8-5V3.5');
      expect(svg).toContain('rotate(-62)');
      expect(svg).toContain('stroke-dasharray');
      expect(svg).not.toContain('M5 25.5L14.5 18.2');
    }
  });

  it('aims the trail at the mid-tail between both stabilizer tips', () => {
    const left = travelHomePlaneTransformPoint(8, 22);
    const right = travelHomePlaneTransformPoint(15, 22);
    const mid = travelHomePlaneTailMidVb();
    expect(mid.x).toBeCloseTo((left.x + right.x) / 2, 5);
    expect(mid.y).toBeCloseTo((left.y + right.y) / 2, 5);
    // Mid sits between tips vertically (not glued to the upper tip).
    const tipYs = [left.y, right.y].sort((a, b) => a - b);
    expect(mid.y).toBeGreaterThan(tipYs[0]!);
    expect(mid.y).toBeLessThan(tipYs[1]!);

    const rotated = travelHomePlaneTailMidVb(-82);
    expect(rotated.y).not.toBeCloseTo(mid.y, 1);
    // Trail leaves mid-tail along the fuselage axis (not a raw +X nudge).
    const axis = travelHomePlaneRearAxisUnit();
    const start = travelHomeTrailStartVb(34);
    expect(start.x).toBeCloseTo(mid.x + axis.x * start.gap, 5);
    expect(start.y).toBeCloseTo(mid.y + axis.y * start.gap, 5);
    expect(start.gap).toBeGreaterThan(0);
  });

  it('exposes deterministic fixture trips without live image URLs', () => {
    expect(travelHomeFixture.trips).toHaveLength(2);
    expect(travelHomeFixture.trips[0]?.destination).toBe('Iceland');
    expect(travelHomeFixture.trips[0]?.id).toBe('trip-travel-home-iceland');
    expect(travelHomeFixture.trips[1]?.destination).toBe('Antigua, Guatemala');
    for (const trip of travelHomeFixture.trips) {
      expect(trip).not.toHaveProperty('imageUrl');
      expect(trip.imageQuery.length).toBeGreaterThan(0);
      // 3+ members → UI shows self + +N (fixture lists the self face only).
      expect(trip.visibleMembers.length).toBeLessThanOrEqual(2);
      expect(trip.memberCount).toBeGreaterThanOrEqual(trip.visibleMembers.length);
      if (trip.memberCount > 2) {
        expect(trip.visibleMembers).toHaveLength(1);
      }
    }
    expect(travelHomeFixture.trips[0]?.memberCount).toBe(4);
    expect(travelHomeFixture.trips[0]?.visibleMembers).toHaveLength(1);
    expect(travelHomeFixture.trips[1]?.memberCount).toBe(5);
    expect(travelHomeFixture.trips[1]?.visibleMembers).toHaveLength(1);
  });

  it('lists required visual regression scenarios', () => {
    expect(travelHomeVisualScenarios).toEqual([
      'travel-home-two-trips',
      'travel-home-one-trip',
      'travel-home-empty',
      'travel-home-dark',
      'travel-home-long-destination',
      'travel-home-image-loading',
    ]);
  });
});
