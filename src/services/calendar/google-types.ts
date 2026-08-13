import type { Activity } from '@/types/models';

export type GoogleCalendarSyncDirection = 'two_way' | 'to_google' | 'from_google';

export const GOOGLE_CALENDAR_SYNC_DIRECTIONS = new Set<GoogleCalendarSyncDirection>([
  'two_way',
  'to_google',
  'from_google',
]);

export interface GoogleCalendarStatus {
  connected: boolean;
  email?: string;
  lastSyncedAt?: string;
  direction: GoogleCalendarSyncDirection;
}

export interface GoogleCalendarSyncResult {
  activities: Activity[];
  acknowledgedDeletionIds: string[];
  imported: number;
  exported: number;
  updated: number;
  removed: number;
  lastSyncedAt: string;
  hasMore: boolean;
  nextPhase?: 'pull' | 'push';
}

export type GoogleCalendarSyncPreviewItem = {
  id: string;
  title: string;
  action: 'create' | 'update' | 'delete' | 'relink';
  destination: 'google' | 'ontrack';
  details?: {
    label: string;
    before?: string;
    after?: string;
  }[];
  reason?: string;
};

export interface GoogleCalendarSyncPreview {
  direction: GoogleCalendarSyncDirection;
  changes: GoogleCalendarSyncPreviewItem[];
}

export type GoogleCalendarDeletion = {
  activityId: string;
  calendarId: string;
  eventId: string;
  origin: 'google' | 'ontrack';
};

export type GoogleCalendarConnectionRow = {
  user_id: string;
  google_email: string | null;
  refresh_token_ciphertext: string;
  calendar_id: string;
  connected_at: string;
  last_synced_at: string | null;
  sync_direction?: GoogleCalendarSyncDirection | null;
};

export type GoogleCalendarLinkRow = {
  user_id: string;
  calendar_id: string;
  google_event_id: string;
  activity_id: string;
  origin: 'google' | 'ontrack';
  google_updated_at: string | null;
  local_updated_at: string | null;
  created_at: string;
};

export type GoogleCalendarEvent = {
  id?: string;
  recurringEventId?: string;
  status?: string;
  summary?: string;
  description?: string;
  updated?: string;
  start?: { date?: string; dateTime?: string };
  end?: { date?: string; dateTime?: string };
  extendedProperties?: { private?: { ontrackActivityId?: string } };
};
