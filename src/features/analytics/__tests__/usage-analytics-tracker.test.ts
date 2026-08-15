import fs from 'node:fs';
import path from 'node:path';

describe('usage analytics tracker render purity', () => {
  const source = fs.readFileSync(
    path.resolve(__dirname, '../usage-analytics-tracker.tsx'),
    'utf8',
  );

  it('does not sample or mutate route timing during render', () => {
    const firstEffect = source.indexOf('useEffect(() => {');
    const firstPerformanceSample = source.indexOf('performance.now()');

    expect(firstPerformanceSample).toBeGreaterThan(firstEffect);
    expect(source).not.toContain('routeRenderRef');
  });

  it('starts page-load timing only after the route effect commits', () => {
    expect(source).toContain('const routeCommittedAt = performance.now();');
    expect(source).toContain('performance.now() - routeCommittedAt');
    expect(source).toContain('cancelAnimationFrame(firstFrame)');
    expect(source).toContain('if (secondFrame) cancelAnimationFrame(secondFrame)');
  });
});
