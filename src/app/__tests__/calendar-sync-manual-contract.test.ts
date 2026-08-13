import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const calendarSyncScreen = readFileSync(
  join(process.cwd(), 'src/app/(tabs)/profile/calendar-sync.tsx'),
  'utf8',
);
const calendarScreen = readFileSync(
  join(process.cwd(), 'src/app/(tabs)/calendar.tsx'),
  'utf8',
);
const googleClient = readFileSync(
  join(process.cwd(), 'src/services/calendar/google-client.ts'),
  'utf8',
);
const appPrompt = readFileSync(
  join(process.cwd(), 'src/components/primitives/app-prompt.tsx'),
  'utf8',
);

describe('manual Google Calendar sync', () => {
  it('saves a direction change without starting an event sync', () => {
    const changeDirection = calendarSyncScreen.match(
      /const changeDirection = async[\s\S]*?\n  };\n/,
    )?.[0];

    expect(changeDirection).toContain('setGoogleCalendarDirection(direction)');
    expect(changeDirection).not.toContain('runSync()');
    expect(changeDirection).toContain('Tap Sync Now to apply pending changes.');
  });

  it('starts a new sync only from the Sync Now control', () => {
    expect(calendarSyncScreen).toMatch(
      /testID=\{AgentUiIds\.calendarSync\.sync\}[\s\S]*?onPress=\{\(\) => void reviewSync\(\)\}/,
    );
    expect(calendarSyncScreen).not.toContain('}, [backgroundSync.running]);');
    expect(calendarScreen).not.toContain('syncGoogleCalendarIfConnected');
    expect(googleClient).not.toContain('syncGoogleCalendarIfConnected');
  });

  it('does not sync automatically after connecting or reconnecting', () => {
    const runConnect = calendarSyncScreen.match(
      /const runConnect = async[\s\S]*?\n  };\n/,
    )?.[0];

    expect(runConnect).toContain('connectGoogleCalendar()');
    expect(runConnect).not.toContain('runSync()');
    expect(calendarSyncScreen).toContain(
      'Google Calendar connected. Tap Sync Now when you are ready.',
    );
    expect(googleClient).not.toMatch(
      /connectGoogleCalendar\(\)[\s\S]{0,220}startGoogleCalendarBackgroundSync/,
    );
  });

  it('reports manual sync completion or failure only through the background notification', () => {
    const runSync = calendarSyncScreen.match(
      /function runSync\(\)[\s\S]*?\n  }\n/,
    )?.[0];

    expect(runSync).toContain('notifyWhenComplete: true');
    expect(runSync).not.toContain('setMessage(`Synced:');
    expect(runSync).not.toContain("setError(caught instanceof Error");
  });

  it('requires confirmation after showing a read-only change preview', () => {
    const reviewSync = calendarSyncScreen.match(
      /const reviewSync = async[\s\S]*?\n  };\n/,
    )?.[0];

    expect(reviewSync).toContain('previewGoogleCalendarSync()');
    expect(reviewSync).toContain("'Review Sync Changes'");
    expect(reviewSync).toContain('content: <CalendarSyncReview preview={preview} />');
    expect(reviewSync).toContain("text: 'Sync Changes'");
    expect(reviewSync).toContain('AgentUiIds.calendarSync.confirmSync');
    expect(reviewSync).toContain('onPress: () => void runSync()');
    expect(reviewSync).toContain('scrollableMessage: true');
  });

  it('keeps long preview lists in a bounded scroll region', () => {
    expect(appPrompt).toContain('request.content ??');
    expect(appPrompt).toContain('request.scrollableMessage ?');
    expect(appPrompt).toContain('AgentUiIds.prompt.messageScroll');
    expect(appPrompt).toContain('showsVerticalScrollIndicator');
    expect(appPrompt).toContain('styles.messageScrollFrame');
  });

  it('does not start a write when the preview has no changes', () => {
    expect(calendarSyncScreen).toMatch(
      /if \(!preview\.changes\.length\) \{[\s\S]*?'Everything is up to date'[\s\S]*?return;/,
    );
  });

  it('uses operation-specific error copy when the change review fails', () => {
    expect(calendarSyncScreen).toContain('setError(googleCalendarReviewErrorMessage(caught))');
    expect(calendarSyncScreen).not.toContain("'Calendar changes could not be previewed.'");
  });

  it('describes From Google as a non-destructive import direction', () => {
    expect(calendarSyncScreen).toContain(
      'Google additions and updates come into onTrack. Nothing is removed or exported.',
    );
  });
});
