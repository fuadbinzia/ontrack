import { useDockSearch } from '../dock-search-store';

describe('useDockSearch', () => {
  beforeEach(() => {
    useDockSearch.getState().resetForTests();
  });

  it('clearTranscript empties transcript without collapsing or clearing unrelated state', () => {
    const store = useDockSearch.getState();
    store.expand({ listen: true });
    store.setQuery('plants');
    store.appendTranscript('user', 'Open plants');
    store.appendTranscript('agent', 'Opened Plants.');

    const before = useDockSearch.getState();
    expect(before.transcript).toHaveLength(2);
    expect(before.expanded).toBe(true);
    expect(before.query).toBe('plants');
    expect(before.listenOnExpand).toBe(true);
    const micGeneration = before.micGeneration;

    before.clearTranscript();

    const after = useDockSearch.getState();
    expect(after.transcript).toEqual([]);
    expect(after.expanded).toBe(true);
    expect(after.query).toBe('plants');
    expect(after.listenOnExpand).toBe(true);
    expect(after.micGeneration).toBe(micGeneration);
  });

  it('appends turns then clearTranscript leaves an empty conversation', () => {
    const store = useDockSearch.getState();
    store.appendTranscript('user', 'Hello');
    store.appendTranscript('agent', 'Hi there.');
    expect(useDockSearch.getState().transcript.map((turn) => [turn.role, turn.text])).toEqual([
      ['user', 'Hello'],
      ['agent', 'Hi there.'],
    ]);

    useDockSearch.getState().clearTranscript();
    expect(useDockSearch.getState().transcript).toEqual([]);

    useDockSearch.getState().appendTranscript('user', 'Again');
    expect(useDockSearch.getState().transcript).toHaveLength(1);
    expect(useDockSearch.getState().transcript[0]?.text).toBe('Again');
  });

  it('clearTranscript on an empty transcript is a no-op', () => {
    useDockSearch.getState().expand();
    useDockSearch.getState().setQuery('stay');
    const before = useDockSearch.getState();
    expect(before.transcript).toEqual([]);

    before.clearTranscript();

    const after = useDockSearch.getState();
    expect(after.transcript).toEqual([]);
    expect(after.expanded).toBe(true);
    expect(after.query).toBe('stay');
    expect(after.listenOnExpand).toBe(false);
    expect(after.micGeneration).toBe(0);
  });

  it('collapse preserves transcript until clearTranscript', () => {
    const store = useDockSearch.getState();
    store.expand();
    store.setQuery('plants');
    store.appendTranscript('user', 'Open plants');

    store.collapse();

    const collapsed = useDockSearch.getState();
    expect(collapsed.expanded).toBe(false);
    expect(collapsed.query).toBe('');
    expect(collapsed.transcript).toHaveLength(1);
    expect(collapsed.transcript[0]?.text).toBe('Open plants');

    collapsed.clearTranscript();
    expect(useDockSearch.getState().transcript).toEqual([]);
    expect(useDockSearch.getState().expanded).toBe(false);
  });

  it('resetForTests clears transcript with the rest of dock search state', () => {
    const store = useDockSearch.getState();
    store.expand({ listen: true });
    store.setQuery('plants');
    store.appendTranscript('user', 'Hello');

    store.resetForTests();

    const after = useDockSearch.getState();
    expect(after.expanded).toBe(false);
    expect(after.listenOnExpand).toBe(false);
    expect(after.listening).toBe(false);
    expect(after.listenStartedAt).toBeNull();
    expect(after.micGeneration).toBe(0);
    expect(after.stopGeneration).toBe(0);
    expect(after.query).toBe('');
    expect(after.fieldHeight).toBe(0);
    expect(after.transcript).toEqual([]);
  });

  it('setFieldHeight records the measured search field and collapse clears it', () => {
    const store = useDockSearch.getState();
    store.expand();
    store.setFieldHeight(88);
    expect(useDockSearch.getState().fieldHeight).toBe(88);

    store.setFieldHeight(88);
    expect(useDockSearch.getState().fieldHeight).toBe(88);

    store.collapse();
    expect(useDockSearch.getState().fieldHeight).toBe(0);
  });

  it('requestStop increments stopGeneration without starting a listen', () => {
    const store = useDockSearch.getState();
    store.requestMic();
    store.setListening(true, 1_700);
    const before = useDockSearch.getState();
    expect(before.stopGeneration).toBe(0);
    expect(before.micGeneration).toBe(1);
    expect(before.listening).toBe(true);
    expect(before.listenStartedAt).toBe(1_700);

    before.requestStop();

    const after = useDockSearch.getState();
    expect(after.stopGeneration).toBe(1);
    expect(after.micGeneration).toBe(1);
    expect(after.listening).toBe(true);
    expect(after.listenOnExpand).toBe(true);
  });

  it('collapse and resetForTests clear listening flags', () => {
    const store = useDockSearch.getState();
    store.expand();
    store.setListening(true, 42);
    store.requestStop();
    expect(useDockSearch.getState().listening).toBe(true);
    expect(useDockSearch.getState().listenStartedAt).toBe(42);

    store.collapse();

    const collapsed = useDockSearch.getState();
    expect(collapsed.expanded).toBe(false);
    expect(collapsed.listening).toBe(false);
    expect(collapsed.listenStartedAt).toBeNull();
    expect(collapsed.stopGeneration).toBe(1);

    collapsed.setListening(true, 99);
    collapsed.resetForTests();
    const after = useDockSearch.getState();
    expect(after.listening).toBe(false);
    expect(after.listenStartedAt).toBeNull();
    expect(after.stopGeneration).toBe(0);
  });
});
