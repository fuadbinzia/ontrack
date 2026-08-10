jest.mock('expo-file-system', () => {
  class File {
    uri: string;
    exists: boolean;
    size: number;
    constructor(uriOrRoot: string | { uri: string }, ...segments: string[]) {
      if (typeof uriOrRoot === 'string') {
        this.uri = segments.length
          ? `${uriOrRoot.replace(/\/$/, '')}/${segments.join('/')}`
          : uriOrRoot;
      } else {
        this.uri = segments.length
          ? `${uriOrRoot.uri.replace(/\/$/, '')}/${segments.join('/')}`
          : uriOrRoot.uri;
      }
      const meta = (globalThis as { __travelPhotoFiles?: Record<string, { exists: boolean; size: number }> })
        .__travelPhotoFiles?.[this.uri];
      this.exists = meta?.exists ?? false;
      this.size = meta?.size ?? 0;
    }
  }
  return {
    File,
    Directory: class {},
    Paths: { document: { uri: 'file:///app/Documents' } },
  };
});

import {
  isLoadableTravelPhotoUri,
  resolveTravelPhotoUris,
} from '@/features/travel/travel-moment-media';

function setFiles(
  files: Record<string, { exists: boolean; size: number }>,
) {
  (globalThis as { __travelPhotoFiles?: typeof files }).__travelPhotoFiles =
    files;
}

describe('travel-moment-media photo resolve', () => {
  beforeEach(() => {
    setFiles({});
  });

  it('keeps cloud markers for async display resolve', () => {
    expect(
      resolveTravelPhotoUris(['ontrack-media:user-1/travel/moment.jpg']),
    ).toEqual(['ontrack-media:user-1/travel/moment.jpg']);
  });

  it('drops missing or zero-byte local files so the strip cannot reserve a blank tile', () => {
    setFiles({
      'file:///app/Documents/travel-moments/dead.jpg': { exists: true, size: 0 },
      'file:///app/Documents/travel-moments/gone.jpg': {
        exists: false,
        size: 0,
      },
      'file:///app/Documents/travel-moments/ok.jpg': { exists: true, size: 1200 },
    });
    expect(
      resolveTravelPhotoUris([
        'file:///app/Documents/travel-moments/dead.jpg',
        'file:///app/Documents/travel-moments/gone.jpg',
        'file:///app/Documents/travel-moments/ok.jpg',
      ]),
    ).toEqual(['file:///app/Documents/travel-moments/ok.jpg']);
  });

  it('treats https and content URIs as loadable without a local file probe', () => {
    expect(isLoadableTravelPhotoUri('https://cdn.example/a.jpg')).toBe(true);
    expect(isLoadableTravelPhotoUri('content://media/1')).toBe(true);
    expect(isLoadableTravelPhotoUri('ontrack-media:user/x.jpg')).toBe(false);
  });
});
