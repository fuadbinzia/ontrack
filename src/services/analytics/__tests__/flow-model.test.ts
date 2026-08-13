import fs from 'node:fs';
import path from 'node:path';

import {
  canonicalizeAnalyticsRoute,
  collapseFlowPath,
  FLOW_ANALYTICS_TAG_IDS,
  isKnownAnalyticsRoute,
} from '../flow-model';

describe('flow analytics route model', () => {
  it.each([
    ['/travel/private-trip-123/tools?tab=money', '/travel/[id]/tools'],
    ['/plants/550e8400-e29b-41d4-a716-446655440000/edit', '/plants/[id]/edit'],
    ['/l/private-invite-code', '/l/[code]'],
    ['/detail/food/meal-123#photo', '/detail/food/[id]'],
  ])('removes dynamic content from %s', (input, expected) => {
    expect(canonicalizeAnalyticsRoute(input)).toBe(expected);
    expect(isKnownAnalyticsRoute(expected)).toBe(true);
  });

  it('does not accept unknown or content-bearing routes', () => {
    expect(isKnownAnalyticsRoute('/overview')).toBe(true);
    expect(isKnownAnalyticsRoute('/unknown/private')).toBe(false);
    expect(isKnownAnalyticsRoute('/travel/person@example.com')).toBe(false);
  });

  it('collapses repeats and caps long sessions to the latest 30 routes', () => {
    const routes = Array.from({ length: 35 }, (_, index) => `/route-${index}`);
    expect(collapseFlowPath(['/travel', '/travel', '/plants'])).toEqual(['/travel', '/plants']);
    expect(collapseFlowPath(routes)).toHaveLength(30);
    expect(collapseFlowPath(routes)[0]).toBe('/route-5');
  });

  it('documents every analytics tag shown in the Living System Map', () => {
    const catalog = JSON.parse(fs.readFileSync(path.resolve('.living-system-map/analytics-tags.json'), 'utf8'));
    const ids = catalog.tags.map((tag: { id: string }) => tag.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.sort()).toEqual([...FLOW_ANALYTICS_TAG_IDS].sort());
    expect(catalog.tags).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'lifecycle.heartbeat', description: expect.stringContaining('active-session') }),
      expect.objectContaining({ id: 'event.route', description: expect.stringContaining('authored values') }),
      expect.objectContaining({ id: 'batch.installId', description: expect.stringContaining('never persists the raw value') }),
    ]));
  });
});
