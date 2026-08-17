import { resolveCloudMediaUri } from '@/services/cloud/media';
import {
    ONTRACK_BACKUP_KIND,
    ONTRACK_BACKUP_VERSION,
    type OnTrackBackup,
} from '../backup-archive';
import {
    collectLocalMediaUris,
    documentsRelativePath,
    mimeFromMediaUri,
    packBackupMedia,
    unpackBackupMedia,
} from '../backup-media';

jest.mock('@/services/cloud/media', () => ({
  resolveCloudMediaUri: jest.fn(),
}));

function backup(patch: Partial<OnTrackBackup> = {}): OnTrackBackup {
  return {
    kind: ONTRACK_BACKUP_KIND,
    version: ONTRACK_BACKUP_VERSION,
    createdAt: '2026-08-16T18:00:00.000Z',
    appVersion: '1.0.0-test',
    domains: {},
    local: {},
    ...patch,
  };
}

describe('user-owned backup media', () => {
  beforeEach(() => {
    (resolveCloudMediaUri as jest.Mock).mockReset();
  });
  it('collects local photos, videos, and voice notes and skips remote or sample URIs', () => {
    const uris = collectLocalMediaUris({
      photo: 'file:///Documents/travel-moments/cover.jpg',
      video: 'file:///Documents/travel-moments/story.mp4',
      voice: 'file:///Documents/journal-voice/note.m4a',
      sample: 'sample://plants/monstera',
      hero: 'https://images.example.com/lisbon.jpg',
      marker: 'ontrack-media:user-1/travel/cover.jpg',
    });
    expect(uris).toEqual(expect.arrayContaining([
      'file:///Documents/travel-moments/cover.jpg',
      'file:///Documents/travel-moments/story.mp4',
      'file:///Documents/journal-voice/note.m4a',
      'ontrack-media:user-1/travel/cover.jpg',
    ]));
    expect(uris).not.toContain('sample://plants/monstera');
    expect(uris).not.toContain('https://images.example.com/lisbon.jpg');
    expect(mimeFromMediaUri('story.mp4')).toBe('video/mp4');
    expect(mimeFromMediaUri('note.m4a')).toBe('audio/mp4');
    expect(documentsRelativePath('file:///var/mobile/Containers/Data/Application/ABC/Documents/journal-voice/note.m4a'))
      .toBe('journal-voice/note.m4a');
  });

  it('packs attachment bytes and restores them onto new document paths', async () => {
    const files = new Map<string, string>([
      ['file:///old/Documents/journal-voice/note.m4a', 'dm9pY2U='],
      ['file:///old/Documents/travel-moments/cover.jpg', 'cGhvdG8='],
    ]);
    const io = {
      readBase64: async (uri: string) => files.get(uri),
      writeBytes: async (path: string, bytes: Uint8Array) => {
        const uri = `file:///new/Documents/${path}`;
        files.set(uri, Buffer.from(bytes).toString('base64'));
        return uri;
      },
    };
    const packed = await packBackupMedia(backup({
      local: {
        journal: {
          version: 1,
          aiDisclosureAccepted: false,
          pages: [{
            id: 'page-1',
            dateKey: '2026-08-16',
            createdAt: '2026-08-16T00:00:00.000Z',
            updatedAt: '2026-08-16T00:00:00.000Z',
            blocks: [{
              id: 'voice-1',
              kind: 'voice',
              uri: 'file:///old/Documents/journal-voice/note.m4a',
              durationMs: 1200,
              createdAt: '2026-08-16T00:00:00.000Z',
              updatedAt: '2026-08-16T00:00:00.000Z',
            }],
          }],
        },
      },
      domains: {
        travel: {
          plans: [{
            id: 'trip-1',
            title: 'Lisbon',
            coverUris: ['file:///old/Documents/travel-moments/cover.jpg'],
          }],
        },
      },
    }), io);

    expect(packed.media?.['file:///old/Documents/journal-voice/note.m4a']?.data).toBe('dm9pY2U=');
    expect(packed.media?.['file:///old/Documents/travel-moments/cover.jpg']?.path)
      .toBe('travel-moments/cover.jpg');

    const restored = await unpackBackupMedia(packed, io);
    const voice = restored.local.journal?.pages[0]?.blocks[0];
    expect(voice && voice.kind === 'voice' ? voice.uri : undefined)
      .toBe('file:///new/Documents/journal-voice/note.m4a');
    expect(
      (restored.domains.travel?.plans as { coverUris?: string[] }[] | undefined)?.[0]?.coverUris,
    ).toEqual(['file:///new/Documents/travel-moments/cover.jpg']);
    expect(restored.media).toBeUndefined();
  });

  it('skips missing files without dropping the rest of the archive', async () => {
    const packed = await packBackupMedia(backup({
      local: {
        journal: {
          version: 1,
          aiDisclosureAccepted: false,
          pages: [{
            id: 'page-1',
            dateKey: '2026-08-16',
            createdAt: '2026-08-16T00:00:00.000Z',
            updatedAt: '2026-08-16T00:00:00.000Z',
            blocks: [{
              id: 'voice-1',
              kind: 'voice',
              uri: 'file:///Documents/journal-voice/missing.m4a',
              durationMs: 800,
              createdAt: '2026-08-16T00:00:00.000Z',
              updatedAt: '2026-08-16T00:00:00.000Z',
            }],
          }],
        },
      },
    }), {
      readBase64: async () => undefined,
      writeBytes: async () => 'file:///unused',
    });
    expect(packed.media).toBeUndefined();
    expect(packed.local.journal?.pages[0]?.blocks[0]).toMatchObject({
      kind: 'voice',
      uri: 'file:///Documents/journal-voice/missing.m4a',
    });
  });

  it('resolves cloud media markers through the shared media client when packing', async () => {
    (resolveCloudMediaUri as jest.Mock).mockResolvedValue('https://cdn.example.com/cover.jpg');
    const fetchMock = jest.fn(async () => ({
      ok: true,
      arrayBuffer: async () => Uint8Array.from([1, 2, 3]).buffer,
    }));
    const previousFetch = globalThis.fetch;
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const packed = await packBackupMedia(backup({
      domains: {
        travel: {
          plans: [{
            id: 'trip-1',
            title: 'Lisbon',
            coverUris: ['ontrack-media:user-1/travel/cover.jpg'],
          }],
        },
      },
    }));

    expect(resolveCloudMediaUri).toHaveBeenCalledWith('ontrack-media:user-1/travel/cover.jpg');
    expect(fetchMock).toHaveBeenCalledWith('https://cdn.example.com/cover.jpg');
    expect(packed.media?.['ontrack-media:user-1/travel/cover.jpg']?.data).toBe(
      Buffer.from([1, 2, 3]).toString('base64'),
    );

    globalThis.fetch = previousFetch;
  });

  it('keeps packing when cloud media resolution fails', async () => {
    (resolveCloudMediaUri as jest.Mock).mockRejectedValue(new Error('offline'));
    const packed = await packBackupMedia(backup({
      domains: {
        travel: {
          plans: [{
            id: 'trip-1',
            title: 'Lisbon',
            coverUris: ['ontrack-todo-recipe-media:list-1/recipe.jpg'],
          }],
        },
      },
    }));
    expect(packed.media).toBeUndefined();
  });
});
