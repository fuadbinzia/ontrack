import { redirectIncomingSystemPath } from '../navigation';

describe('incoming share navigation', () => {
  it('redirects only the Expo sharing host', () => {
    expect(redirectIncomingSystemPath('ontrack://expo-sharing')).toBe('/share-event');
    expect(redirectIncomingSystemPath('ontrack://expo-sharing?id=1')).toBe('/share-event');
  });

  it('preserves existing app paths', () => {
    expect(redirectIncomingSystemPath('/l/abc')).toBe('/l/abc');
    expect(redirectIncomingSystemPath('ontrack:///c/abc')).toBe('ontrack:///c/abc');
  });

  it('normalizes hosted share universal / app links to app paths', () => {
    expect(redirectIncomingSystemPath('https://ontrack--links.expo.app/c/abc')).toBe(
      '/c/abc',
    );
    expect(redirectIncomingSystemPath('https://ontrack--links.expo.app/l/abc?x=1')).toBe(
      '/l/abc?x=1',
    );
    expect(
      redirectIncomingSystemPath('https://ontrack--links.expo.app/invite/travel?invite=s.x'),
    ).toBe('/invite/travel?invite=s.x');
    expect(redirectIncomingSystemPath('https://ontrack--links.expo.app/p/straiaway?connected=1')).toBe(
      '/p/straiaway?connected=1',
    );
  });

  it('leaves unrelated https URLs unchanged', () => {
    expect(redirectIncomingSystemPath('https://example.com/l/abc')).toBe(
      'https://example.com/l/abc',
    );
  });
});
