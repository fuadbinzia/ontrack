import fs from 'node:fs';
import path from 'node:path';

describe('Overview hero glass contract', () => {
  const source = fs.readFileSync(
    path.resolve(__dirname, '../overview-screen.tsx'),
    'utf8',
  );

  it('uses high-frost glass instead of the opaque CTA accent material', () => {
    const hero = source.slice(
      source.indexOf('testID={AgentUiIds.overview.hero}'),
      source.indexOf('testID={AgentUiIds.overview.section}'),
    );

    expect(hero).toContain('<GlassPlate');
    expect(hero).toContain('intensity={64}');
    expect(hero).toContain('borderColor: heroTone');
    expect(hero).not.toContain('accent="green"');
  });

  it('keeps attention copy on high-contrast semantic text colors', () => {
    expect(source).toContain(
      'variant="overline" fit style={{ color: heroTone }}',
    );
    expect(source).toContain('variant="callout"');
    expect(source).toContain('color="primary"');
    expect(source).toContain("summary.attentionCount ? 'warning' : 'habit'");
  });

  it('does not show a next prediction in the hero', () => {
    const hero = source.slice(
      source.indexOf('testID={AgentUiIds.overview.hero}'),
      source.indexOf('testID={AgentUiIds.overview.section}'),
    );

    expect(hero).not.toContain('Next:');
    expect(hero).not.toContain('summary.nextEvent');
    expect(source).not.toContain('nextCalendarEvent');
  });

  it('uses registered glass check controls to acknowledge individual items', () => {
    expect(source).toContain('<IconButton');
    expect(source).toContain('icon="check"');
    expect(source).toContain(
      'testID={AgentUiIds.overview.acknowledge(item.key)}',
    );
    expect(source).toContain('onPress={() => acknowledgeAttention(item.key)}');
  });
});
