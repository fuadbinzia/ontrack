import {
  calendarAttendeeEmailsMatch,
  calendarInvitationDescription,
  googleAttendeeEmails,
  ONTRACK_APP_STORE_URL,
  ONTRACK_PLAY_STORE_URL,
  parseCalendarAttendeeEmails,
  stripCalendarInvitationFooter,
} from '../calendar-invitations';

describe('calendar invitations', () => {
  it('normalizes, deduplicates, and validates comma, semicolon, and line-separated emails', () => {
    expect(parseCalendarAttendeeEmails(
      ' ALEX@example.com, jordan@example.com; alex@example.com\ninvalid-address ',
    )).toEqual({
      emails: ['alex@example.com', 'jordan@example.com'],
      invalid: ['invalid-address'],
    });
  });

  it('adds both app download links only when an event has invitees', () => {
    const invited = calendarInvitationDescription({
      notes: 'Bring a jacket.',
      attendeeEmails: ['alex@example.com'],
    });

    expect(invited).toContain('Bring a jacket.');
    expect(invited).toContain(ONTRACK_APP_STORE_URL);
    expect(invited).toContain(ONTRACK_PLAY_STORE_URL);
    expect(calendarInvitationDescription({ notes: 'Private note.', attendeeEmails: [] }))
      .toBe('Private note.');
  });

  it('removes only the onTrack footer when an invited event syncs back', () => {
    const exported = calendarInvitationDescription({
      notes: 'Bring a jacket.',
      attendeeEmails: ['alex@example.com'],
    });

    expect(stripCalendarInvitationFooter(exported)).toBe('Bring a jacket.');
    expect(stripCalendarInvitationFooter('Unrelated Google Calendar notes.'))
      .toBe('Unrelated Google Calendar notes.');
  });

  it('ignores organizers and resources while preserving external guests', () => {
    const attendees = [
      { email: 'owner@example.com', organizer: true },
      { email: 'room@example.com', resource: true },
      { email: 'ALEX@example.com' },
    ];
    expect(googleAttendeeEmails(attendees)).toEqual(['alex@example.com']);
    expect(calendarAttendeeEmailsMatch(['alex@example.com'], attendees)).toBe(true);
    expect(calendarAttendeeEmailsMatch(['jordan@example.com'], attendees)).toBe(false);
  });
});
