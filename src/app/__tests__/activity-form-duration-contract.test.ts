import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const form = readFileSync(join(process.cwd(), 'src/app/activity-form.tsx'), 'utf8');
const schedule = readFileSync(
  join(process.cwd(), 'src/app/activity-form-sections.tsx'),
  'utf8',
);
const durationField = readFileSync(
  join(process.cwd(), 'src/components/primitives/duration-field.tsx'),
  'utf8',
);
const scheduleCard = schedule.slice(
  schedule.indexOf('export function ActivityFormScheduleCard'),
  schedule.indexOf('export function ActivityFormPhotoCard'),
);

describe('activity form duration fields', () => {
  it('shows hours and mins inside one composed duration field', () => {
    expect(schedule).toContain('<DurationField');
    expect(durationField).toContain('hours');
    expect(durationField).toContain('mins');
    expect(schedule).not.toContain('label="Duration (min)"');
  });

  it('uses one glass field with a centered timer cue and internal divider', () => {
    expect(durationField).toContain('fieldLeadingIconRowStyle({');
    expect(durationField).toContain('<GlassPlate');
    expect(durationField).toContain('airy');
    expect(durationField).toContain('<FieldLeadingIcon name="timer" />');
    expect(durationField).toContain('styles.divider');
  });

  it('renders every schedule control on glass without a milky outer card', () => {
    expect(schedule).toContain('AgentUiIds.activityForm.scheduleSection');
    expect(schedule).toContain('<ActivityFormGlassField label="Date">');
    expect(schedule).toContain('<ActivityFormGlassField label="Start Time">');
    expect(schedule).toContain('<ActivityFormGlassField label="Notes">');
    expect(scheduleCard).not.toContain(
      '<GlassPlate airy style={activityFormGlassCardStyle}>',
    );
  });

  it('pairs date with start time and gives duration a full-width row', () => {
    expect(schedule).toMatch(
      /<View style=\{\[allDay \? styles\.singleColumn : styles\.twoColumns[\s\S]*?<DateField[\s\S]*?<TimeField/,
    );
    expect(schedule).toMatch(/<\/View>\s*\{allDay \? \([\s\S]*?<DurationField/);
  });

  it('keeps distinct agent targets for both numeric controls', () => {
    expect(schedule).toContain('AgentUiIds.activityForm.durationHours');
    expect(schedule).toContain('AgentUiIds.activityForm.durationMinutes');
  });

  it('combines the two fields into total minutes before validation and storage', () => {
    expect(form).toContain(
      'durationPartsToMinutes(durationHours, durationMinutes)',
    );
    expect(form).toContain('durationMinutes: totalDurationMinutes');
  });
});
