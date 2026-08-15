import mockAsyncStorage from '@react-native-async-storage/async-storage/jest/async-storage-mock';

import { useJournal } from '@/store/journal';

jest.mock('@react-native-async-storage/async-storage', () => mockAsyncStorage);
jest.mock('expo-secure-store', () => ({
  WHEN_UNLOCKED_THIS_DEVICE_ONLY: 'WHEN_UNLOCKED_THIS_DEVICE_ONLY',
  getItemAsync: jest.fn(async () => 'test-journal-encryption-key'),
  setItemAsync: jest.fn(async () => undefined),
}));

const mockDeleteJournalVoice = jest.fn(async () => undefined);
jest.mock('@/features/journal/voice-persist', () => ({
  deleteJournalVoice: (...args: unknown[]) => mockDeleteJournalVoice(...args),
}));

describe('journal store', () => {
  beforeEach(() => {
    useJournal.getState().reset();
    mockDeleteJournalVoice.mockClear();
  });

  it('ensures one page per date and keeps a second ensure as the same page', () => {
    const first = useJournal.getState().ensurePage('2026-08-15');
    const second = useJournal.getState().ensurePage('2026-08-15');
    expect(first).toBe(second);
    expect(useJournal.getState().pages).toHaveLength(1);
    expect(useJournal.getState().ensurePage('2026-08-14')).not.toBe(first);
    expect(useJournal.getState().pages).toHaveLength(2);
  });

  it('adds text, voice, and link blocks then removes them', () => {
    useJournal.getState().ensurePage('2026-08-15');
    expect(useJournal.getState().addText('2026-08-15', '   ')).toBeUndefined();
    const textId = useJournal.getState().addText('2026-08-15', '  Morning light  ');
    const voiceId = useJournal.getState().addVoice('2026-08-15', 'file://journal-voice/note.m4a', 1250);
    const linkId = useJournal.getState().addLink('2026-08-15', 'travel', 'Travel');

    const page = useJournal.getState().pages[0];
    expect(page.blocks).toMatchObject([
      { id: textId, kind: 'text', text: 'Morning light' },
      { id: voiceId, kind: 'voice', uri: 'file://journal-voice/note.m4a', durationMs: 1250 },
      { id: linkId, kind: 'link', section: 'travel', label: 'Travel' },
    ]);
    for (const block of page.blocks) {
      expect(block.createdAt).toEqual(expect.any(String));
      expect(block.updatedAt).toBe(block.createdAt);
    }

    useJournal.getState().removeBlock('2026-08-15', voiceId!);
    expect(mockDeleteJournalVoice).toHaveBeenCalledWith('file://journal-voice/note.m4a');
    expect(useJournal.getState().pages[0].blocks.map((block) => block.id)).toEqual([
      textId,
      linkId,
    ]);
  });

  it('edits a text block and ignores empty, missing, or non-text updates', () => {
    jest.useFakeTimers();
    try {
      jest.setSystemTime(new Date('2026-08-15T12:00:00.000Z'));
      const textId = useJournal.getState().addText('2026-08-15', 'Morning light');
      const voiceId = useJournal.getState().addVoice(
        '2026-08-15',
        'file://journal-voice/note.m4a',
        800,
      );
      const createdAt = useJournal.getState().pages[0].blocks[0].createdAt;
      expect(createdAt).toBe('2026-08-15T12:00:00.000Z');

      jest.setSystemTime(new Date('2026-08-15T12:05:00.000Z'));
      expect(useJournal.getState().updateText('2026-08-15', textId!, '  Later light  ')).toBe(
        textId,
      );
      expect(useJournal.getState().pages[0].blocks[0]).toMatchObject({
        id: textId,
        text: 'Later light',
        createdAt,
        updatedAt: '2026-08-15T12:05:00.000Z',
      });

      expect(useJournal.getState().updateText('2026-08-15', textId!, 'Later light')).toBeUndefined();
      expect(useJournal.getState().updateText('2026-08-15', textId!, '   ')).toBeUndefined();
      expect(useJournal.getState().updateText('2026-08-15', voiceId!, 'Not text')).toBeUndefined();
      expect(useJournal.getState().updateText('2026-08-14', textId!, 'Wrong day')).toBeUndefined();
      expect(useJournal.getState().pages[0].blocks[0]).toMatchObject({ text: 'Later light' });
    } finally {
      jest.useRealTimers();
    }
  });

  it('creates a missing page when adding the first block and resets privately', () => {
    const id = useJournal.getState().addText('2026-08-16', 'First line');
    expect(useJournal.getState().pages[0]).toMatchObject({
      dateKey: '2026-08-16',
      blocks: [{ id, kind: 'text', text: 'First line' }],
    });
    expect(useJournal.getState().pages[0].blocks[0].createdAt).toEqual(expect.any(String));
    useJournal.getState().acceptAiDisclosure();
    expect(useJournal.getState().aiDisclosureAccepted).toBe(true);
    useJournal.getState().reset();
    expect(useJournal.getState().pages).toEqual([]);
    expect(useJournal.getState().aiDisclosureAccepted).toBe(false);
  });

  it('undoes and redoes text-block edits on that day only', () => {
    const todayId = useJournal.getState().addText('2026-08-15', 'Morning');
    const priorId = useJournal.getState().addText('2026-08-14', 'Yesterday');
    useJournal.getState().updateText('2026-08-15', todayId!, 'Noon');
    useJournal.getState().updateText('2026-08-15', todayId!, 'Night');
    useJournal.getState().updateText('2026-08-14', priorId!, 'Earlier');

    expect(useJournal.getState().undoText('2026-08-15')).toBe(todayId);
    expect(useJournal.getState().pages.find((page) => page.dateKey === '2026-08-15')?.blocks[0]).toMatchObject({
      text: 'Noon',
    });
    expect(useJournal.getState().pages.find((page) => page.dateKey === '2026-08-14')?.blocks[0]).toMatchObject({
      text: 'Earlier',
    });

    expect(useJournal.getState().redoText('2026-08-15')).toBe(todayId);
    expect(useJournal.getState().pages.find((page) => page.dateKey === '2026-08-15')?.blocks[0]).toMatchObject({
      text: 'Night',
    });

    useJournal.getState().undoText('2026-08-15');
    useJournal.getState().updateText('2026-08-15', todayId!, 'Dawn');
    expect(useJournal.getState().redoText('2026-08-15')).toBeUndefined();
    expect(useJournal.getState().pages.find((page) => page.dateKey === '2026-08-15')?.blocks[0]).toMatchObject({
      text: 'Dawn',
    });

    expect(useJournal.getState().undoText('2026-08-16')).toBeUndefined();
    useJournal.getState().reset();
    expect(useJournal.getState().textHistory).toEqual({});
  });
});
