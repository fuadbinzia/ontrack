import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const layout = readFileSync(
  join(process.cwd(), 'src/app/(tabs)/plants/_layout.tsx'),
  'utf8',
);

function screenOptions(name: string): string {
  const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = layout.match(
    new RegExp(`<AppStack\\.Screen\\s+name="${escapedName}"\\s+options=\\{\\{([\\s\\S]*?)\\}\\}\\s*/>`),
  );

  if (!match?.[1]) {
    throw new Error(`Missing inline options for plant screen ${name}`);
  }

  return match[1];
}

describe('plant modal contrast', () => {
  it('paints the new-plant modal with the active theme instead of the native white backing', () => {
    const options = screenOptions('new');

    expect(options).toContain("presentation: 'modal'");
    expect(options).toContain(
      'contentStyle: { backgroundColor: theme.backgroundPrimary }',
    );
  });

  it.each(['[id]/edit', '[id]/check-in'])(
    'keeps %s readable in dark mode with the same themed modal backing',
    (name) => {
      const options = screenOptions(name);

      expect(options).toContain("presentation: 'modal'");
      expect(options).toContain(
        'contentStyle: { backgroundColor: theme.backgroundPrimary }',
      );
    },
  );

  it('keeps non-modal plant routes transparent for the shared glass atmosphere', () => {
    expect(layout).toContain("contentStyle: { backgroundColor: 'transparent' }");
    expect(layout).toContain('<AppStack.Screen name="index" />');
    expect(layout).toContain('<AppStack.Screen name="[id]" />');
  });
});
