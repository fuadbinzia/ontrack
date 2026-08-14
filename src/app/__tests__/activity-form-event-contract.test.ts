import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const form = readFileSync(join(process.cwd(), 'src/app/activity-form.tsx'), 'utf8');
const assistant = readFileSync(join(process.cwd(), 'src/app/activity-form-assistant.tsx'), 'utf8');
const discovery = readFileSync(join(process.cwd(), 'src/features/events/event-discovery-editor.tsx'), 'utf8');
const detail = readFileSync(join(process.cwd(), 'src/app/(tabs)/(today)/detail/generic/[id].tsx'), 'utf8');
const fightCard = readFileSync(join(process.cwd(), 'src/features/events/ufc-fight-card.tsx'), 'utf8');
const todayLayout = readFileSync(join(process.cwd(), 'src/app/(tabs)/(today)/_layout.tsx'), 'utf8');

describe('Event activity form contract', () => {
  it('exposes Event as a guided discovery editor while preserving manual title entry', () => {
    expect(form).toContain('mergeDefaultCategories(storedCategories)');
    expect(assistant).toContain("category.detailKind === 'event'");
    expect(assistant).toContain('<EventDiscoveryEditor');
    expect(assistant).toContain('label="Event Title"');
    expect(assistant).toContain('setAllDay(!hasDateTime)');
  });

  it('prefills and saves normalized event metadata with the regular schedule form', () => {
    expect(form).toContain('storedEventDetails');
    expect(form).toContain("category.detailKind === 'event' && eventDetails");
    expect(form).toContain('eventDetails.broadcasts');
  });

  it('provides discovery, follow modes, review suggestions, cancellation, and stable selectors', () => {
    expect(discovery).toContain("{ value: 'sports', label: 'Sports' }");
    expect(discovery).toContain("{ value: 'concert', label: 'Music' }");
    expect(discovery).toContain("{ value: 'all', label: 'All sports' }");
    expect(discovery).toContain("{ value: 'football', label: 'Football' }");
    expect(discovery).toContain("{ value: 'combat', label: 'Combat sports' }");
    expect(discovery).toContain('Team, league, fight, race, or event…');
    expect(discovery).toContain('AgentUiIds.activityForm.event.upcoming');
    expect(discovery).toContain(".catch(() => ({ results: [] }))");
    expect(discovery).toContain('followModeReview');
    expect(discovery).toContain('followModeAuto');
    expect(discovery).toContain('acceptEventSuggestion');
    expect(discovery).toContain('dismissEventSuggestion');
  });

  it('keeps ticket actions while omitting source and watch controls', () => {
    expect(detail).toContain('eventDetails.ticketUrl');
    expect(detail).toContain('openHttpsUrl');
    expect(detail).not.toContain('eventDetails.watchUrl');
    expect(detail).not.toContain('eventDetails.sourceUrl');
    expect(detail).not.toContain('AgentUiIds.eventDetail.watch');
    expect(detail).not.toContain('AgentUiIds.eventDetail.source');
  });

  it('keeps participants and every fight-card bout readable instead of shrinking them into metadata rows', () => {
    expect(detail).toContain('bouts={eventDetails.bouts}');
    expect(fightCard).toContain('splitFightCardMatchup(label)');
    expect(fightCard).toContain('styles.fighterCopy');
    expect(detail).not.toContain('<MetaList');
  });

  it('keeps adjacent event context visible without repeating the imported summary', () => {
    expect(detail).toContain('activity.summary && !eventDetails');
    expect(detail).toContain('eventDetails.venue.name');
    expect(fightCard).toContain('fightCardBoutCountLabel(resolved.length)');
  });

  it('uses true frosted glass for the event composition instead of airy cream panels', () => {
    expect(detail).toContain('<GlassPlate intensity={64} style={styles.eventCard}>');
    expect(fightCard).toContain('intensity={78}');
    expect(fightCard).toContain('tintColor={colors.board}');
    expect(fightCard).toContain('tintColor={colors.header}');
    expect(detail).toContain('<SheetScaffold');
    expect(detail).toContain('surface="glass"');
    expect(detail).toContain('borderWidth: 1');
    expect(detail).not.toContain('<GlassPlate airy');
  });

  it('keeps the primary glass summary venue-only', () => {
    expect(detail).toContain('>Venue</AppText>');
    expect(detail).toContain('Venue information');
    expect(detail).not.toContain('Official source');
    expect(detail).not.toContain('>Watch</AppText>');
    expect(detail).not.toContain('eventDetails.broadcasts');
    expect(detail.match(/<GlassPlate intensity=\{64\} style=\{styles\.eventCard\}>/g)).toHaveLength(1);
  });

  it('places the polished event summary above the fight card', () => {
    const metadataIndex = detail.indexOf('testID={AgentUiIds.eventDetail.metadata}');
    const fightCardIndex = detail.indexOf('testID={AgentUiIds.eventDetail.fightCard}');
    expect(metadataIndex).toBeGreaterThan(-1);
    expect(fightCardIndex).toBeGreaterThan(metadataIndex);
    expect(detail).toContain('<GlassIconWell size={40} borderRadius={radii.md}>');
    expect(detail).toContain('borderRadius: radii.lg');
    expect(detail).toContain('paddingHorizontal: spacing.lg');
    expect(detail).toContain('Venue information');
  });

  it('uses an official broadcast-style card with red identity and opposing corners', () => {
    expect(detail).toContain('testID={AgentUiIds.eventDetail.fightCard}');
    expect(fightCard).toContain('fightCardSectionLabel(section)');
    expect(fightCard).toContain('setActiveSection(group.section)');
    expect(fightCard).toContain('activeGroup?.bouts.map');
    expect(fightCard).toContain('AgentUiIds.eventDetail.fightCardTab(section)');
    expect(fightCard).toContain("bout.billing === 'Main Event'");
    expect(fightCard).toContain('variant="callout"');
    expect(fightCard).toContain('side="right"');
  });

  it('renders real fighter portraits, records, flags, weight classes, and title bouts', () => {
    expect(fightCard).toContain('fighter.imageUrl');
    expect(fightCard).toContain('fighter.record');
    expect(fightCard).toContain('fighter.countryFlagUrl');
    expect(fightCard).toContain('bout.weightClass');
    expect(fightCard).toContain('fightCardWeightClassLabel(bout.weightClass)');
    expect(fightCard).toContain("bout.title ? 'Title Bout'");
    expect(detail).toContain('refreshUfcEventDetails(activityId');
    expect(detail).toContain('refreshLiveUfcEventDetails(activityId');
    expect(detail).toContain('UFC_LIVE_POLL_MS');
    expect(detail).toContain("AppState.addEventListener('change'");
    expect(fightCard).toContain('fightCardBoutStatusLabel(');
    expect(fightCard).toContain('fighter.winner');
  });

  it('uses one consistent fighter-name size and wraps long names onto two lines', () => {
    expect(fightCard).toContain('variant="bodyMedium"');
    expect(fightCard).toContain('numberOfLines={2}');
    expect(fightCard).not.toContain('fitMinimumScale');
  });

  it('opens every bout as a registered, accessible matchup modal', () => {
    expect(fightCard).toContain('<Pressable');
    expect(fightCard).toContain('AgentUiIds.eventDetail.fightCardBout(');
    expect(fightCard).toContain('accessibilityRole="button"');
    expect(fightCard).toContain('appPrompt.alert(');
    expect(fightCard).toContain('AgentUiIds.eventDetail.fightCardModal');
    expect(fightCard).toContain('<ModalFighter fighter={first} />');
    expect(fightCard).toContain('<ModalFighter fighter={second} />');
  });

  it('passes essential event context into the bout modal while keeping the list row compact', () => {
    expect(detail).toContain('eventTitle={activity.title}');
    expect(detail).toContain('eventTiming={activityTimingLabel(activity)}');
    expect(fightCard).toContain('<Symbol name="chevron-right"');
    expect(fightCard).toContain('numberOfLines={2}');
  });

  it('keeps venue details on the event summary instead of repeating them in the bout modal', () => {
    expect(detail).toContain('eventDetails.venue.name');
    expect(detail).not.toContain('venueName={eventDetails.venue?.name}');
    expect(fightCard).not.toContain('Venue:');
    expect(fightCard).not.toContain('venueName');
  });

  it('shows the mirrored fighter comparison without a redundant section heading', () => {
    const taleStyle = fightCard.match(/tale:\s*\{([\s\S]*?)\n  \},/)?.[1] ?? '';
    expect(fightCard).toContain('fetchUfcFighterProfiles(');
    expect(fightCard).not.toContain('Tale of the tape');
    expect(taleStyle).not.toContain('borderTopWidth');
    expect(taleStyle).toContain('borderBottomWidth: StyleSheet.hairlineWidth');
    for (const label of ['Age', 'Height', 'Weight', 'Reach']) {
      expect(fightCard).toContain(`label: '${label}'`);
    }
    expect(fightCard).toContain("left ?? '—'");
    expect(fightCard).toContain("right ?? '—'");
    expect(fightCard).toContain('styles.taleRow');
  });

  it('keeps flags vertically centered and edge-aligned in mirrored fighter metadata', () => {
    expect(fightCard).toContain('fighterMetaOrder(align)');
    expect(fightCard).toContain('styles.fighterMetaRight');
    expect(fightCard).toContain("fighterMetaRight: { justifyContent: 'flex-end' }");
    expect(fightCard).not.toContain("alignRight: { alignItems: 'flex-end'");
  });

  it('keeps the sports board contrast theme-aware in both light and dark app themes', () => {
    expect(fightCard).toContain('ufcFightCardColors(theme)');
    expect(fightCard).toContain("inverted={theme.name === 'dark'}");
    expect(fightCard).toContain('colors.header');
    expect(fightCard).toContain('colors.headerText');
    expect(fightCard).toContain('color="onAccent"');
    expect(fightCard).toContain('borderTopColor: colors.divider');
    expect(fightCard).not.toMatch(/#[0-9a-f]{3,8}/i);
  });

  it('uses saturated UFC accents and full-contrast metadata instead of a washed-out opacity wash', () => {
    expect(fightCard).toContain('borderBottomWidth: 4');
    expect(fightCard).toContain('color: colors.secondaryText');
    expect(fightCard).not.toContain('mutedOnDark');
    expect(fightCard).not.toContain('opacity: 0.7');
  });

  it('keeps fighter portraits neutral without red or blue rings', () => {
    expect(fightCard).toContain('<FighterPortrait fighter={fighter} featured={featured} />');
    expect(fightCard).not.toContain('cornerColor');
    expect(fightCard).not.toContain('colors.redCorner');
    expect(fightCard).not.toContain('colors.blueCorner');
  });

  it('clips the complete UFC board and its header into one rounded glass card', () => {
    expect(fightCard).toContain('borderRadius: radii.lg');
    expect(fightCard).toContain('cardBanner: {');
    expect(fightCard).toContain('borderRadius: 0');
  });

  it('hosts the app bottom sheet without nesting it inside a native form sheet', () => {
    expect(todayLayout).toContain("'detail/generic/[id]'");
    expect(todayLayout).toContain("presentation: 'transparentModal'");
    expect(todayLayout).toContain("animation: 'none'");
    expect(todayLayout).toContain('gestureEnabled: false');
    expect(todayLayout).toContain("contentStyle: { backgroundColor: 'transparent' }");
    expect(todayLayout).not.toContain("presentation: 'formSheet'");
    expect(todayLayout).not.toContain('sheetAllowedDetents');
  });

  it('uses the app sheet grabber and backdrop as the two sheet-level dismissal paths', () => {
    expect(detail).toContain('closeAccessibilityLabel="Dismiss event details"');
    expect(detail).toContain('backdropTestID={AgentUiIds.eventDetail.backdrop}');
    expect(detail).toContain('maxHeight={Math.round(windowHeight * 0.9)}');
    expect(detail.match(/closeTestID=\{AgentUiIds\.eventDetail\.close\}/g)).toHaveLength(1);
    expect(detail).not.toContain('<IconButton');
  });
});
