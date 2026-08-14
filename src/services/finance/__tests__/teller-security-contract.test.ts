import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const source = (relativePath: string) => fs.readFileSync(path.join(root, relativePath), 'utf8');

describe('Teller security contract', () => {
  it.each(['session', 'finish', 'sync', 'disconnect'])(
    'keeps the %s route behind shared API authentication',
    (route) => expect(source(`src/app/api/finance/teller/${route}+api.ts`)).toContain('withTellerApiAuth'),
  );

  it('keeps normal app requests free of Teller credentials', () => {
    const client = source('src/services/finance/teller.ts');
    expect(client).not.toContain('access_token');
    expect(client).not.toContain('TELLER_SIGNING_KEY');
    expect(client).not.toContain('TELLER_GATEWAY_SHARED_SECRET');
    for (const route of ['sync', 'disconnect']) {
      const routeSource = source(`src/app/api/finance/teller/${route}+api.ts`);
      expect(routeSource).not.toContain('body.access_token');
      expect(routeSource).toContain('loadTellerEnrollment(userId, enrollmentId)');
    }
  });

  it('encrypts access tokens and verifies server-generated nonces before storage', () => {
    const server = source('src/services/finance/teller-server.ts');
    expect(server).toContain("{ name: 'AES-GCM', iv }");
    expect(server).toContain('verifyTellerEnrollmentSignature');
    expect(server).toContain("db.rpc('complete_teller_link_session'");
    expect(server).toContain('p_access_token_ciphertext: await encryptAccessToken');
    expect(server).not.toContain('access_token_plaintext');
  });

  it('keeps both Teller vault tables inaccessible to client database roles', () => {
    const migration = source('supabase/migrations/202608140001_teller_server_vault.sql');
    expect(migration).toContain('revoke all on public.teller_link_sessions from anon, authenticated');
    expect(migration).toContain('revoke all on public.teller_enrollments from anon, authenticated');
    expect(migration).toContain('access_token_ciphertext text not null');
    expect(migration).toContain('for update');
    expect(migration).toContain('completed_at is null');
    expect(migration).toContain('delete from public.teller_enrollments where user_id = target_user_id');
  });

  it('uses an mTLS binding, replay store, and strict operation allowlist in the gateway', () => {
    const worker = source('cloudflare/teller-gateway/src/index.ts');
    const config = source('cloudflare/teller-gateway/wrangler.jsonc');
    expect(worker).toContain('TELLER_MTLS');
    expect(worker).toContain('TELLER_REPLAY');
    expect(worker).not.toContain('body.url');
    expect(worker).toContain("body.operation === 'transactions'");
    expect(config).toContain('mtls_certificates');
    expect(config).toContain('kv_namespaces');
  });
});
