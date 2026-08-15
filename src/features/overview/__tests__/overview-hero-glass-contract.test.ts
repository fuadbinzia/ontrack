import fs from 'node:fs';
import path from 'node:path';

describe('Overview hero glass contract', () => {
  const screen = fs.readFileSync(
    path.resolve(__dirname, '../overview-screen.tsx'),
    'utf8',
  );
  const hero = fs.readFileSync(
    path.resolve(__dirname, '../overview-hero.tsx'),
    'utf8',
  );

  it('uses high-frost glass instead of the opaque CTA accent material', () => {
    expect(hero).toContain('testID={AgentUiIds.overview.hero}');
    expect(hero).toContain('<GlassPlate');
    expect(hero).toContain('intensity={64}');
    expect(hero).toContain('borderColor: heroTone');
    expect(hero).not.toContain('accent="green"');
  });

  it('keeps attention copy on high-contrast semantic text colors', () => {
    expect(hero).toContain(
      'variant="overline" fit style={{ color: heroTone }}',
    );
    expect(hero).toContain('variant="callout"');
    expect(hero).toContain('color="primary"');
    expect(hero).toContain('attentionCount');
    expect(hero).toContain("'warning'");
    expect(hero).toContain("'habit'");
  });

  it('puts event logos in the pulse well instead of a generic ticket glyph', () => {
    expect(hero).toContain('artwork={eventArtwork}');
    expect(hero).toContain('<OverviewHeroMark');
    expect(screen).toContain('buildOverviewSummary');
  });

  it('does not show a next prediction in the hero', () => {
    expect(hero).not.toContain('Next:');
    expect(hero).not.toContain('summary.nextEvent');
    expect(screen).not.toContain('nextCalendarEvent');
  });

  it('does not keep the Across onTrack section heading or caption', () => {
    expect(screen).not.toContain('Tap Any Section To Go Deeper');
    expect(screen).not.toMatch(/<AppText[^>]*>\s*Across onTrack\s*<\/AppText>/);
  });

  it('uses registered glass check controls to acknowledge individual items', () => {
    expect(hero).toContain('<IconButton');
    expect(hero).toContain('icon="check"');
    expect(hero).toContain(
      'testID={AgentUiIds.overview.acknowledge(item.key)}',
    );
    expect(hero).toContain('onPress={() => onAcknowledge(item.key)}');
  });
});
