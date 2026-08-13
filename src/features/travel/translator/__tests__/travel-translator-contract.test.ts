import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const read = (path: string) => readFileSync(join(process.cwd(), path), 'utf8');

describe('destination translator integration contract', () => {
  it('ships native audio dependencies, permission copy, and a new runtime', () => {
    const app = JSON.parse(read('app.json')) as {
      expo: { runtimeVersion: string; plugins: unknown[] };
    };
    const pkg = JSON.parse(read('package.json')) as { dependencies: Record<string, string> };
    expect(app.expo.runtimeVersion).toBe('1.0.3');
    expect(JSON.stringify(app.expo.plugins)).toContain('expo-audio');
    expect(JSON.stringify(app.expo.plugins)).toContain('translate short phrases');
    expect(pkg.dependencies['expo-audio']).toBeTruthy();
    expect(pkg.dependencies['expo-speech']).toBeTruthy();
  });

  it('uses the canonical travel glass sheet and exposes the complete testID surface', () => {
    const grid = read('src/features/travel/travel-trip-action-grid.tsx');
    const sheet = read('src/features/travel/translator/travel-translator-sheet.tsx');
    const ids = read('src/utils/agent-ui/ids-travel.ts');
    const docs = read('docs/agent-ui-map.md');
    expect(grid).toContain('label="Translator"');
    expect(grid).toContain('list.translator(tripId)');
    expect(sheet).toContain('<TravelSheetModal');
    expect(sheet).toContain('TravelSheetModal');
    expect(sheet).toContain('GlassPlate');
    for (const token of [
      'translator.sheet',
      'translator.homeLanguage',
      'translator.destinationLanguage',
      'translator.microphoneHome',
      'translator.microphoneDestination',
      'translator.stop',
      'translator.input',
      'translator.translate',
      'translator.copy',
      'translator.replay',
      'translator.retry',
    ]) {
      expect(sheet).toContain(token);
    }
    expect(ids).toContain('ontrack.travel.translator.microphone.home');
    expect(docs).toContain('Destination translator');
  });
});
