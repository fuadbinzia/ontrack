import fs from 'node:fs';
import path from 'node:path';

interface AppConfig {
  expo?: {
    android?: {
      intentFilters?: {
        autoVerify?: boolean;
        data?: { host?: string; pathPrefix?: string; scheme?: string }[];
      }[];
    };
    ios?: {
      associatedDomains?: string[];
    };
  };
}

interface AppleAppSiteAssociation {
  applinks?: {
    details?: {
      components?: { '/': string }[];
    }[];
  };
}

interface AssetLinksEntry {
  relation?: string[];
  target?: {
    namespace?: string;
    package_name?: string;
    sha256_cert_fingerprints?: string[];
  };
}

const SHARE_PATH_PREFIXES = ['/i/', '/j/', '/f/', '/c/', '/l/', '/v/', '/p/'] as const;
const SHARE_AASA_PATHS = ['/i/*', '/j/*', '/f/*', '/c/*', '/l/*', '/v/*', '/p/*'] as const;
const SHARE_HOST = 'ontrack--links.expo.app';
const ANDROID_PACKAGE = 'com.imtihoss.ontracknow';

describe('travel invitation links', () => {
  const root = path.resolve(__dirname, '../../../..');

  it('registers the hosted invitation domain and share paths on iOS', () => {
    const app = JSON.parse(
      fs.readFileSync(path.join(root, 'app.json'), 'utf8'),
    ) as AppConfig;
    const association = JSON.parse(
      fs.readFileSync(
        path.join(root, 'public/.well-known/apple-app-site-association'),
        'utf8',
      ),
    ) as AppleAppSiteAssociation;

    expect(app.expo?.ios?.associatedDomains).toContain(`applinks:${SHARE_HOST}`);
    const paths =
      association.applinks?.details?.flatMap((detail) =>
        detail.components?.map((component) => component['/']) ?? [],
      ) ?? [];
    for (const sharePath of SHARE_AASA_PATHS) {
      expect(paths).toContain(sharePath);
    }
  });

  it('registers the hosted short-link paths on Android in app.json', () => {
    const app = JSON.parse(
      fs.readFileSync(path.join(root, 'app.json'), 'utf8'),
    ) as AppConfig;
    const filters = app.expo?.android?.intentFilters ?? [];
    expect(filters.some((filter) => filter.autoVerify === true)).toBe(true);
    const data = filters.flatMap((filter) => filter.data ?? []);

    for (const pathPrefix of SHARE_PATH_PREFIXES) {
      expect(data).toContainEqual({
        scheme: 'https',
        host: SHARE_HOST,
        pathPrefix,
      });
    }
  });

  it('claims the same https App Link paths in the committed AndroidManifest', () => {
    const manifest = fs.readFileSync(
      path.join(root, 'android/app/src/main/AndroidManifest.xml'),
      'utf8',
    );

    expect(manifest).toContain('android:autoVerify="true"');
    expect(manifest).toContain(`android:host="${SHARE_HOST}"`);
    for (const pathPrefix of SHARE_PATH_PREFIXES) {
      expect(manifest).toContain(`android:pathPrefix="${pathPrefix}"`);
    }
  });

  it('publishes Digital Asset Links for the Android package', () => {
    const assetLinks = JSON.parse(
      fs.readFileSync(
        path.join(root, 'public/.well-known/assetlinks.json'),
        'utf8',
      ),
    ) as AssetLinksEntry[];

    const entry = assetLinks.find(
      (item) =>
        item.target?.namespace === 'android_app' &&
        item.target.package_name === ANDROID_PACKAGE,
    );
    expect(entry?.relation).toContain('delegate_permission/common.handle_all_urls');
    expect(entry?.target?.sha256_cert_fingerprints?.length).toBeGreaterThan(0);
    for (const fingerprint of entry?.target?.sha256_cert_fingerprints ?? []) {
      expect(fingerprint).toMatch(/^([0-9A-F]{2}:){31}[0-9A-F]{2}$/);
    }
  });
});
