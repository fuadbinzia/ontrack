import fs from 'node:fs';
import path from 'node:path';

const migrationPath = path.join(
  process.cwd(),
  'supabase/migrations/202608140007_travel_revoke_duplicate_member_invites.sql',
);

describe('travel duplicate member removal migration', () => {
  const migration = fs.readFileSync(migrationPath, 'utf8');

  it('revokes every live accepted invite for the same user on the same trip', () => {
    expect(migration).toContain('candidate.trip_id = invite.trip_id');
    expect(migration).toContain(
      'candidate.accepted_by_user_id = invite.accepted_by_user_id',
    );
    expect(migration).toContain('candidate.revoked_at is null');
  });

  it('only revokes the selected code when the invitation is still pending', () => {
    expect(migration).toMatch(
      /candidate\.code = invite\.code\s+or \(\s+invite\.accepted_by_user_id is not null/,
    );
  });

  it('removes a revoked traveler from the co-host table too', () => {
    expect(migration).toContain('delete from public.travel_trip_cohosts');
    expect(migration).toContain('user_id = invite.accepted_by_user_id');
  });
});
