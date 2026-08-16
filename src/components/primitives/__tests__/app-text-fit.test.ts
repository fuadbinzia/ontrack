import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { appTextShouldFit } from '@/components/primitives/app-text-fit';

describe('appTextShouldFit', () => {
  it('fit-shrinks single-line chrome', () => {
    expect(appTextShouldFit({ fit: true })).toBe(true);
    expect(appTextShouldFit({ adjustsFontSizeToFit: true })).toBe(true);
    expect(appTextShouldFit({ fit: true, numberOfLines: 1 })).toBe(true);
  });

  it('does not fit-shrink multiline sentences', () => {
    expect(
      appTextShouldFit({
        adjustsFontSizeToFit: true,
        numberOfLines: 5,
      }),
    ).toBe(false);
    expect(appTextShouldFit({ fit: true, numberOfLines: 2 })).toBe(false);
    expect(appTextShouldFit({ numberOfLines: 4 })).toBe(false);
  });

  it('is the AppText fit gate', () => {
    const source = readFileSync(
      join(process.cwd(), 'src/components/primitives/app-text.tsx'),
      'utf8',
    );
    expect(source).toContain('appTextShouldFit');
  });
});
