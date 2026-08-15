import fs from 'node:fs';
import path from 'node:path';

const migrationPath = path.join(
  process.cwd(),
  'supabase/migrations/202608020007_travel_roster_preferred_display_name.sql',
);

describe('travel roster preferred display name migration', () => {
  const migration = fs.readFileSync(migrationPath, 'utf8');

  it('prefers fuller invitee names over truncated profile prefixes', () => {
    expect(migration).toContain(
      'create or replace function public.travel_preferred_display_name(',
    );
    expect(migration).toContain(
      "lower(btrim(invitee_name)) like lower(btrim(profile_name)) || ' %'",
    );
    expect(migration).toContain('public.travel_preferred_display_name(');
  });
});
