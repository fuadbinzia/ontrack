import { useFlowAnalytics } from '../flow-analytics';

describe('flow analytics store', () => {
  beforeEach(() => useFlowAnalytics.getState().reset());

  it('records a route visit and a completed transition without duplicating path entries', () => {
    useFlowAnalytics.getState().visitRoute('/travel', 1_700_000_000_000);
    useFlowAnalytics.getState().visitRoute('/travel/[id]', 1_700_000_001_000);
    useFlowAnalytics.getState().visitRoute('/travel/[id]', 1_700_000_002_000);

    const state = useFlowAnalytics.getState();
    expect(state.pending.map((item) => item.lifecycle)).toEqual([
      'visit', 'visit', 'complete', 'visit',
    ]);
    expect(state.pending[2]).toMatchObject({ fromRoute: '/travel', route: '/travel/[id]' });
    expect(state.session?.path).toEqual(['/travel', '/travel/[id]']);
  });

  it('ends a session with a capped path and acknowledges only accepted events', () => {
    useFlowAnalytics.getState().visitRoute('/plants', 1_700_000_000_000);
    useFlowAnalytics.getState().recordOutcome('plants.watering', 'fail', 1_700_000_001_000);
    useFlowAnalytics.getState().endSession(1_700_000_002_000);
    const before = useFlowAnalytics.getState().pending;
    expect(before.at(-1)).toMatchObject({ lifecycle: 'session-end', path: ['/plants'] });
    useFlowAnalytics.getState().acknowledge([before[0]!.id]);
    expect(useFlowAnalytics.getState().pending).toHaveLength(before.length - 1);
  });

  it('starts a new session after the live-session expiry boundary', () => {
    useFlowAnalytics.getState().visitRoute('/travel', 1_700_000_000_000);
    const first = useFlowAnalytics.getState().session?.id;
    useFlowAnalytics.getState().visitRoute('/plants', 1_700_000_091_000);
    expect(useFlowAnalytics.getState().session?.id).not.toBe(first);
    expect(useFlowAnalytics.getState().session?.path).toEqual(['/plants']);
  });

  it('records privacy-coarsened page, transition, and named-action timings', () => {
    const store = useFlowAnalytics.getState();
    store.visitRoute('/travel', 1_700_000_000_000);
    store.visitRoute('/travel/[id]', 1_700_000_000_100);
    store.recordPageLoad('/travel/[id]', '/travel', 347, 1_700_000_000_450);
    store.recordActionDuration('travel.trip.save', 121_000, 1_700_000_001_000);

    expect(useFlowAnalytics.getState().pending.slice(-2)).toEqual([
      expect.objectContaining({
        lifecycle: 'measure', metric: 'page-load', durationMs: 350,
        route: '/travel/[id]', fromRoute: '/travel',
      }),
      expect.objectContaining({
        lifecycle: 'measure', metric: 'action', durationMs: 120_000,
        route: '/travel/[id]', outcomeId: 'travel.trip.save',
      }),
    ]);
  });

  it('drops timing samples when no foreground flow session exists', () => {
    useFlowAnalytics.getState().recordPageLoad('/travel', undefined, 250);
    useFlowAnalytics.getState().recordActionDuration('travel.trip.save', 250);
    expect(useFlowAnalytics.getState().pending).toEqual([]);
  });
});
