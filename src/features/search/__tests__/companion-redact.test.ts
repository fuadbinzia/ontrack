import { formatDateLong, formatWeekday, todayKey } from '@/utils/date';

import { redactToolResult } from '../companion-redact';

describe('redactToolResult', () => {
  it('keeps ISO calendar dates that the phone matcher used to swallow', () => {
    const redacted = redactToolResult({
      date: '2026-08-17',
      spoken: 'Today is Monday, August 17, 2026.',
      subtitle: '2026-08-17 · 9:00 AM',
    }) as Record<string, string>;
    expect(redacted.date).toBe('2026-08-17');
    expect(redacted.spoken).toBe('Today is Monday, August 17, 2026.');
    expect(redacted.subtitle).toBe('2026-08-17 · 9:00 AM');
    expect(JSON.stringify(redacted)).not.toContain('[redacted]');
  });

  it('keeps dashed calendar dates and ISO timestamps in spoken trip answers', () => {
    const redacted = redactToolResult({
      startDate: '2026-10-03',
      spoken: 'Your next trip is Lisbon on October 3, 2026.',
      createdAt: '2026-01-01T00:00:00.000Z',
      usDate: '08-17-2026',
    }) as Record<string, string>;
    expect(redacted.startDate).toBe('2026-10-03');
    expect(redacted.spoken).toContain('October 3, 2026');
    expect(redacted.createdAt).toBe('2026-01-01T00:00:00.000Z');
    expect(redacted.usDate).toBe('08-17-2026');
  });

  it('redacts phones in the same sentence as a kept date', () => {
    const redacted = redactToolResult(
      'Call 555-123-4567 on 2026-08-17 at jordan@example.com',
    );
    expect(redacted).toBe('Call [redacted] on 2026-08-17 at [redacted]');
  });

  it('does not treat dotted dates, slashed dates, ZIP+4, or IPs as phones', () => {
    const redacted = redactToolResult({
      dotted: '2026.08.17',
      slashed: '08/17/2026',
      zip: '10001-1234',
      ip: '192.168.1.100',
    }) as Record<string, string>;
    expect(redacted).toEqual({
      dotted: '2026.08.17',
      slashed: '08/17/2026',
      zip: '10001-1234',
      ip: '192.168.1.100',
    });
  });

  it('still redacts emails, formatted phones, and omitted Health keys', () => {
    const redacted = redactToolResult({
      title: 'Call jordan@example.com at 555-123-4567 or (555) 987-6543',
      backup: '+1 555-222-3333',
      attendeeEmails: ['jordan@example.com'],
      appleHealth: { uuid: 'secret' },
      vin: '1HGCM82633A004352',
      policyNumber: 'POL-99',
      goal: 'private goal',
    }) as Record<string, unknown>;
    expect(redacted.title).toBe('Call [redacted] at [redacted] or [redacted]');
    expect(redacted.backup).toBe('[redacted]');
    expect(redacted.attendeeEmails).toBeUndefined();
    expect(redacted.appleHealth).toBeUndefined();
    expect(redacted.vin).toBeUndefined();
    expect(redacted.policyNumber).toBeUndefined();
    expect(redacted.goal).toBeUndefined();
  });

  it('keeps a live get_today payload after redaction', () => {
    const date = todayKey();
    const spoken = `Today is ${formatWeekday(date)}, ${formatDateLong(date, { year: true })}.`;
    const redacted = redactToolResult({
      date,
      weekday: formatWeekday(date),
      label: formatDateLong(date, { year: true }),
      spoken,
      activities: [{ time: '9:00 AM', title: 'Run' }],
    }) as { date: string; spoken: string };
    expect(redacted.date).toBe(date);
    expect(redacted.spoken).toBe(spoken);
    expect(redacted.spoken).not.toContain('[redacted]');
  });
});
