import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const boundaries: Record<string, readonly string[]> = {
  'src/features/auth/agent-account-login.ts': ['account_flags'],
  'src/features/travel/chat.ts': ['delete_travel_chat_message'],
  'src/services/analytics/sync.ts': ['analytics_product_summary', 'upsert_analytics_daily'],
  'src/services/analytics/flow-server.ts': ['record_analytics_flow_batch'],
  'src/services/calendar/google-oauth.ts': [
    'google_calendar_connections',
    'google_calendar_event_links',
  ],
  'src/services/calendar/google-sync.ts': [
    'google_calendar_connections',
    'google_calendar_event_links',
  ],
  'src/services/cloud/account-flags.ts': ['account_flags'],
  'src/services/finance/plaid-server.ts': ['plaid_items', 'plaid_link_sessions'],
  'src/services/todos/collaboration-invites.ts': [
    'accept_todo_collaborator_link',
    'accept_todo_email_invite',
    'accept_todo_share_link',
    'create_todo_collaborator_link',
    'create_todo_email_invite',
    'create_todo_share_link',
    'list_todo_email_invites',
    'resolve_todo_collaborator_link',
    'resolve_todo_share_link',
    'revoke_todo_collaborator_link',
    'revoke_todo_email_invite',
    'revoke_todo_share_link',
    'todo_list_pending_invites',
  ],
  'src/services/todos/collaboration-members.ts': [
    'add_todo_friend_editors',
    'delete_todo_list',
    'leave_todo_list',
    'remove_todo_member',
    'set_todo_member_role',
    'transfer_todo_list_ownership',
  ],
  'src/services/todos/collaboration-mutations.ts': [
    'apply_todo_category_mutations',
    'publish_todo_list',
    'set_todo_categories',
    'todo_list_snapshot',
  ],
  'src/services/todos/collaboration-reload.ts': ['todo_shared_list_ids'],
  'src/services/travel/expense-collaboration.ts': [
    'fetch_travel_trip_expenses',
    'fetch_travel_trip_expenses_by_access',
    'publish_travel_trip_expenses',
    'travel_trip_id_for_access',
  ],
  'src/services/travel/itinerary-collaboration.ts': [
    'delete_travel_trip_itinerary_items',
    'fetch_travel_trip_itinerary',
    'fetch_travel_trip_itinerary_by_access',
    'travel_trip_id_for_access',
    'upsert_travel_trip_itinerary_items',
  ],
  'src/services/travel/travel-map-collaboration.ts': [
    'apply_travel_map_mutations',
    'list_friend_travel_maps',
    'list_my_travel_map',
    'list_visible_friend_map_profiles',
    'set_travel_map_visibility',
  ],
  'src/services/vehicles/collaboration.ts': [
    'accept_vehicle_share_link',
    'apply_vehicle_mutations',
    'delete_shared_vehicle',
    'leave_vehicle',
    'publish_vehicle',
    'remove_vehicle_member',
    'resolve_vehicle_share_link',
    'revoke_vehicle_share_link',
    'transfer_vehicle_ownership',
    'vehicle_shared_ids',
    'vehicle_snapshot',
  ],
};

describe('client-to-data boundary contracts', () => {
  it.each(Object.entries(boundaries))('%s names every reviewed table and RPC explicitly', (relative, objects) => {
    const source = readFileSync(join(process.cwd(), relative), 'utf8');

    for (const object of objects) {
      expect(source).toMatch(new RegExp(`\\.(?:from|rpc)\\(\\s*['"]${object}['"]`));
    }
  });
});
