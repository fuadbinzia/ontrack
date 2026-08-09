import { readFileSync } from 'fs';
import { join } from 'path';

import { resolveTravelSkyGroundKind } from '@/features/travel/travel-sky-ground-kind';

describe('resolveTravelSkyGroundKind', () => {
  it('maps Reykjavík / Iceland to the nordic ground (church + town)', () => {
    expect(resolveTravelSkyGroundKind('Reykjavík, Iceland')).toBe('nordic');
    expect(resolveTravelSkyGroundKind('Iceland')).toBe('nordic');
    expect(resolveTravelSkyGroundKind('Akureyri')).toBe('nordic');
  });

  it('maps climate and city families', () => {
    expect(resolveTravelSkyGroundKind('Bali, Indonesia')).toBe('tropical');
    expect(resolveTravelSkyGroundKind('Dubai, UAE')).toBe('desert');
    expect(resolveTravelSkyGroundKind('Zermatt, Switzerland')).toBe('alpine');
    expect(resolveTravelSkyGroundKind('New York, NY')).toBe('metro');
    expect(resolveTravelSkyGroundKind('Lisbon, Portugal')).toBe('coastal');
    expect(resolveTravelSkyGroundKind('Nashville, TN')).toBe('pastoral');
  });

  it('uses latitude when the label is unknown', () => {
    expect(resolveTravelSkyGroundKind('Somewhere', 10)).toBe('tropical');
    expect(resolveTravelSkyGroundKind('Somewhere', 64)).toBe('nordic');
  });
});

describe('travel sky ground frost', () => {
  it('puts PeakFrost snow caps on mountain ridges', () => {
    const primitives = readFileSync(
      join(process.cwd(), 'src/features/travel/travel-sky-ground-primitives.tsx'),
      'utf8',
    );
    const kinds = readFileSync(
      join(process.cwd(), 'src/features/travel/travel-sky-ground-kinds.tsx'),
      'utf8',
    );
    expect(primitives).toContain('export function PeakFrost');
    expect(kinds).toContain('PeakFrost');
    expect(kinds).toContain('frost:');
    expect(kinds).toContain('GroundFarMountains');
    expect(kinds).toContain('frost={p.frost}');
    expect(kinds).toContain('alpine-frost-');
    expect(kinds).toContain('nordic-frost-');
  });
});
