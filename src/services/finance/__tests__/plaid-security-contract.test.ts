import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();

function source(relativePath: string): string {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

describe('Plaid security contract', () => {
  it.each(['link-token', 'exchange', 'sync', 'disconnect'])(
    'keeps the %s route behind shared API authentication',
    (route) => {
      expect(source(`src/app/api/finance/plaid/${route}+api.ts`)).toContain('withPlaidApiAuth');
    },
  );

  it('never exposes or accepts an access token in the client Plaid service', () => {
    const client = source('src/services/finance/plaid.ts');
    expect(client).not.toContain('access_token');
    expect(client).not.toContain('SecureStore');
    expect(client).toContain('openAuthSessionAsync');
    expect(client).not.toContain("body: { accessToken");
    expect(client).not.toContain("body: { access_token");
  });

  it('uses authenticated user ownership for Link sessions and Plaid Items', () => {
    const server = source('src/services/finance/plaid-server.ts');
    const linkRoute = source('src/app/api/finance/plaid/link-token+api.ts');
    expect(linkRoute).toContain('client_user_id: userId');
    expect(server).toContain(".eq('user_id', userId)");
    expect(server).toContain(".eq('item_id', itemId)");
    expect(server).not.toContain('access_token_plaintext');
  });

  it('keeps Plaid credentials server-side and encrypted at rest', () => {
    const server = source('src/services/finance/plaid-server.ts');
    expect(server).toContain("{ name: 'AES-GCM', iv }");
    expect(server).toContain('access_token_ciphertext: await encryptAccessToken');
    expect(server).toContain('accessToken: await decryptAccessToken');
    expect(server).not.toContain('access_token: input.accessToken');
  });

  it('syncs and disconnects by Item id without accepting client credentials', () => {
    for (const route of ['sync', 'disconnect']) {
      const routeSource = source(`src/app/api/finance/plaid/${route}+api.ts`);
      expect(routeSource).toContain('item_id?: string');
      expect(routeSource).toContain('loadPlaidItem(userId, itemId)');
      expect(routeSource).not.toContain('body.access_token');
      expect(routeSource).not.toContain('body.accessToken');
    }
  });

  it('routes OAuth institutions back into the finance account surface', () => {
    expect(source('src/app/p/plaid.tsx')).toContain('/(tabs)/finance/accounts');
    expect(source('src/app/api/finance/plaid/link-token+api.ts')).toContain(
      'https://ontrack--links.expo.app/p/plaid',
    );
  });

  it('keeps the encrypted Plaid vault inaccessible to app roles', () => {
    const migration = source('supabase/migrations/202608120009_plaid_server_vault.sql');
    expect(migration).toContain('access_token_ciphertext text not null');
    expect(migration).toContain('revoke all on public.plaid_items from anon, authenticated');
    expect(migration).toContain('revoke all on public.plaid_link_sessions from anon, authenticated');
    expect(migration).toContain('primary key (user_id, item_id)');
    expect(migration).toContain('user_id uuid not null references auth.users on delete cascade');
  });

  it('preserves disconnect revocation even when the normal request bucket is exhausted', () => {
    expect(source('src/app/api/finance/plaid/disconnect+api.ts')).toContain(
      '{ rateLimit: false }',
    );
    expect(source('src/app/api/finance/plaid/disconnect+api.ts')).toContain(
      "error.code !== 'ITEM_NOT_FOUND'",
    );
  });
});
