import {
  beginRuntimeOperation,
  getRuntimeActivitiesSnapshot,
  removeRuntimeActivity,
  resetRuntimeActivitiesForTests,
  setRuntimeActivity,
} from '../runtime-activity';

describe('runtime activity registry', () => {
  beforeEach(resetRuntimeActivitiesForTests);

  it('tracks lifecycle, counters, traffic, and cleanup', () => {
    const definition = { id: 'network.test', label: 'Test request', category: 'network' as const };
    setRuntimeActivity(definition, { status: 'idle' });
    const finish = beginRuntimeOperation(definition, { sentBytes: 12 });
    expect(getRuntimeActivitiesSnapshot()[0]).toMatchObject({ status: 'running', pending: 1, operations: 1 });
    finish({ receivedBytes: 40 });
    expect(getRuntimeActivitiesSnapshot()[0]).toMatchObject({
      status: 'idle', pending: 0, sentBytes: 12, receivedBytes: 40, errors: 0,
    });
    removeRuntimeActivity(definition.id);
    expect(getRuntimeActivitiesSnapshot()).toEqual([]);
  });

  it('counts a failed operation once', () => {
    const finish = beginRuntimeOperation({ id: 'sync.test', label: 'Sync', category: 'sync' });
    finish({ error: true });
    finish({ error: true });
    expect(getRuntimeActivitiesSnapshot()[0]).toMatchObject({ status: 'error', errors: 1, pending: 0 });
  });
});
