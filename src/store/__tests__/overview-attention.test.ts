import { useOverviewAttention } from '../overview-attention';

describe('overview attention acknowledgements', () => {
  beforeEach(() => {
    useOverviewAttention.getState().reset();
  });

  it('acknowledges each item once and can reset local visibility state', () => {
    useOverviewAttention.getState().acknowledge('activity:event:v1');
    useOverviewAttention.getState().acknowledge('activity:event:v1');
    useOverviewAttention.getState().acknowledge('bill:internet:2026-08-13');

    expect(useOverviewAttention.getState().acknowledgedKeys).toEqual([
      'activity:event:v1',
      'bill:internet:2026-08-13',
    ]);

    useOverviewAttention.getState().reset();
    expect(useOverviewAttention.getState().acknowledgedKeys).toEqual([]);
  });

  it('caps old acknowledgement history so local persistence stays bounded', () => {
    for (let index = 0; index < 300; index += 1) {
      useOverviewAttention.getState().acknowledge(`attention:${index}`);
    }

    const keys = useOverviewAttention.getState().acknowledgedKeys;
    expect(keys).toHaveLength(256);
    expect(keys[0]).toBe('attention:44');
    expect(keys.at(-1)).toBe('attention:299');
  });
});
