import fs from 'node:fs';
import path from 'node:path';

const migration = fs.readFileSync(
  path.join(
    process.cwd(),
    'supabase/migrations/202608140006_travel_cohost_itinerary_management.sql',
  ),
  'utf8',
);

describe('travel co-host itinerary management migration', () => {
  it('allows a trip manager to update itinerary rows owned by another traveler', () => {
    expect(migration).toContain(
      'actor_is_manager := public.is_travel_trip_manager(normalized_trip);',
    );
    expect(migration).toMatch(
      /owner_user_id = actor\s+or actor_is_manager/,
    );
  });

  it('keeps ordinary member writes limited to their own itinerary rows', () => {
    expect(migration).toContain(
      'public.travel_trip_itinerary_items.owner_user_id = actor',
    );
    expect(migration).not.toMatch(
      /grant execute on function public\.upsert_travel_trip_itinerary_items\(text, jsonb\)\s+to anon/,
    );
  });
});
