import fs from 'node:fs';
import path from 'node:path';

const migration = fs.readFileSync(
  path.join(process.cwd(), 'supabase/migrations/202608110001_travel_map.sql'),
  'utf8',
);
const optionalTripMigration = fs.readFileSync(
  path.join(
    process.cwd(),
    'supabase/migrations/202608110002_travel_map_optional_trip.sql',
  ),
  'utf8',
);

describe('travel map server privacy contract', () => {
  it('requires opt-in and active friendship for friend layers', () => {
    expect(migration).toContain('map_profile.share_with_friends');
    expect(migration).toContain('public.are_friends(auth.uid(), map_profile.owner_id)');
    expect(migration).toContain("map_profile.owner_id = any(coalesce(requested_friend_ids");
  });

  it('whitelists summaries and place fields instead of returning raw payloads', () => {
    expect(migration).toContain("'tripSummary', case");
    expect(migration).toContain('then jsonb_build_object(');
    expect(migration).toContain("'latitude', (place ->> 'latitude')::double precision");
    expect(migration).not.toContain("'places', visit.payload -> 'places'");
    expect(migration).not.toMatch(/#>> '\{tripSummary,(notes|itinerary|expenses)/);
  });

  it('checks trip membership before allowing a friend full-trip action', () => {
    expect(migration).toContain('can_open_friend_travel_map_trip');
    expect(migration).toContain('public.is_travel_trip_member(');
  });

  it('accepts standalone pins while requiring summaries for linked trips', () => {
    for (const source of [migration, optionalTripMigration]) {
      expect(source).toContain(
        "nullif(btrim(coalesce(visit ->> 'tripId', '')), '') is null",
      );
      expect(source).toContain(
        "jsonb_typeof(visit -> 'tripSummary') = 'object'",
      );
    }
  });

  it('stores deletion tombstones for last-write-wins reconciliation', () => {
    expect(migration).toContain('deleted_at timestamptz');
    expect(migration).toContain("values (visit_id, actor, '{}'::jsonb, mutation_at, mutation_at)");
  });
});
