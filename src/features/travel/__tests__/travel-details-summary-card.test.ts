import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('TravelDetailsSummaryCard chrome', () => {
  const source = readFileSync(
    join(process.cwd(), 'src/features/travel/travel-details-summary-card.tsx'),
    'utf8',
  );

  it('wraps title and confirmation code to two lines instead of fit-shrinking', () => {
    expect(source).toMatch(/variant="heading"[\s\S]*?numberOfLines=\{2\}/);
    expect(source).not.toMatch(/variant="heading"[\s\S]{0,80}\bfit\b/);

    const confirmationBlock = source.slice(
      source.indexOf('confirmationCode ?'),
      source.indexOf('{rows.length'),
    );
    expect(confirmationBlock).toContain('Confirmation');
    expect(confirmationBlock).toContain('numberOfLines={2}');
    expect(confirmationBlock).not.toMatch(/\bfit\b/);
  });
});
