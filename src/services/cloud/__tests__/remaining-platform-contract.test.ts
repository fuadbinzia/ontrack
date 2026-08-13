import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const read = (relative: string) => readFileSync(join(process.cwd(), relative), 'utf8');

const migrations = [
  'supabase/migrations/202607210001_clinical_nutrition.sql',
  'supabase/migrations/202607260001_agents.sql',
  'supabase/migrations/202607270001_travel_invites.sql',
  'supabase/migrations/202607270002_travel_invite_participants.sql',
  'supabase/migrations/202607270003_travel_invite_management.sql',
  'supabase/migrations/202607270004_travel_chat.sql',
  'supabase/migrations/202607270008_anonymous_test_trip_chat.sql',
  'supabase/migrations/202607310004_social_friends.sql',
  'supabase/migrations/202608010001_friend_invite_slugs.sql',
  'supabase/migrations/202608020005_profile_avatars.sql',
  'supabase/migrations/202608020006_profile_avatar_icon_id_relax.sql',
  'supabase/migrations/202608030002_friend_realtime_refresh.sql',
  'supabase/migrations/202608050003_serialize_travel_trip_host_transfer.sql',
  'supabase/migrations/202608050004_travel_chat_rate_limit_by_user.sql',
  'supabase/migrations/202608050006_todo_update_recipe_image_path.sql',
  'supabase/migrations/202608050008_analytics_daily.sql',
  'supabase/migrations/202608060001_list_my_travel_chat_access.sql',
  'supabase/migrations/202608060002_travel_chat_messages_sender_user.sql',
  'supabase/migrations/202608070001_travel_trip_itinerary_items.sql',
  'supabase/migrations/202608080001_food_core.sql',
  'supabase/migrations/202608080002_food_ingredient_knowledge.sql',
  'supabase/migrations/202608100001_travel_chat_core.sql',
  'supabase/migrations/202608120002_todo_categories.sql',
  'supabase/migrations/202608120004_fix_todo_category_mutation_id.sql',
  'supabase/migrations/202608120005_fix_todo_category_mutation_vars.sql',
  'supabase/migrations/202608120006_todo_multi_assignees.sql',
  'supabase/migrations/202608120008_partner_links.sql',
  'supabase/migrations/202608130002_flow_analytics.sql',
] as const;

const nativeAndPluginFiles = [
  'modules/ontrack-healthkit/ios/OnTrackHealthKitModule.swift',
  'modules/ontrack-healthkit/src/OnTrackHealthKit.types.ts',
  'modules/ontrack-healthkit/src/OnTrackHealthKitModule.ts',
  'modules/ontrack-performance/index.ts',
  'modules/ontrack-performance/android/src/main/java/expo/modules/ontrackperformance/OnTrackPerformanceModule.kt',
  'modules/ontrack-performance/ios/OnTrackPerformanceModule.swift',
  'modules/ontrack-performance/src/OnTrackPerformance.types.ts',
  'modules/ontrack-performance/src/OnTrackPerformanceModule.ts',
  'modules/ontrack-voice-lists/android/src/main/java/expo/modules/ontrackvoicelists/OnTrackVoiceListsModule.kt',
  'modules/ontrack-voice-lists/android/src/main/java/expo/modules/ontrackvoicelists/OnTrackVoiceStore.kt',
  'modules/ontrack-voice-lists/android/src/main/java/expo/modules/ontrackvoicelists/VoiceListActivity.kt',
  'modules/ontrack-voice-lists/ios/OnTrackVoiceListsModule.swift',
  'modules/ontrack-voice-lists/src/OnTrackVoiceLists.types.ts',
  'modules/ontrack-voice-lists/src/OnTrackVoiceListsModule.ts',
  'modules/travel-document-reader/android/src/main/java/expo/modules/traveldocumentreader/TravelDocumentReaderModule.kt',
  'modules/travel-document-reader/ios/TravelDocumentReaderModule.swift',
  'modules/travel-document-reader/src/TravelDocumentReaderModule.web.ts',
  'plugins/ontrack-voice-lists/OnTrackVoiceIntents.swift',
  'plugins/with-local-notifications.js',
  'plugins/with-ontrack-healthkit.js',
] as const;

const toolingFiles = [
  'scripts/assert-node.js',
  'scripts/generate-travel-map-cities.mjs',
  'scripts/optimize-assets.mjs',
] as const;

describe('remaining persistence and platform contracts', () => {
  it.each(migrations)('%s is a substantive, identifier-safe SQL migration', (relative) => {
    const source = read(relative);
    expect(source).toMatch(/\b(?:create|alter|drop|revoke|grant|insert|update|delete|do)\b/i);
    expect(source).not.toMatch(/[a-z0-9._%+-]+@(gmail|outlook|icloud|yahoo)\.[a-z]{2,}/i);
  });

  it('keeps the nutrition edge function on the authenticated Deno HTTP boundary', () => {
    const source = read('supabase/functions/nutrition-api/index.ts');
    expect(source).toContain('Deno.serve');
    expect(source).toMatch(/authorization/i);
    expect(source).toMatch(/cors/i);
  });

  it.each(nativeAndPluginFiles)('%s declares a native or config-plugin surface', (relative) => {
    const source = read(relative);
    expect(source).toMatch(/\b(?:export|class|struct|object|module\.exports|AppIntent)\b/);
  });

  it.each(toolingFiles)('%s keeps an explicit executable or module entry', (relative) => {
    const source = read(relative);
    expect(source).toMatch(/(?:^#!|\b(?:import|require|const|function)\b)/m);
  });
});
