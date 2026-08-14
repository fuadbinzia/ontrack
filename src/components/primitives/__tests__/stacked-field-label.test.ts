import { fieldTitleCase, titleCaseTextChildren } from '../field-title-case';

describe('fieldTitleCase', () => {
  it('title-cases multi-word field titles and keeps the required marker', () => {
    expect(fieldTitleCase('Departing name *')).toBe('Departing Name *');
    expect(fieldTitleCase('Returning name *')).toBe('Returning Name *');
    expect(fieldTitleCase('Outbound name *')).toBe('Outbound Name *');
  });

  it('leaves already-title-cased labels stable', () => {
    expect(fieldTitleCase('Stay Name *')).toBe('Stay Name *');
    expect(fieldTitleCase('Confirmation Code')).toBe('Confirmation Code');
    expect(fieldTitleCase('Flight Number')).toBe('Flight Number');
  });

  it('normalizes all-caps and mixed labels used in forms', () => {
    expect(fieldTitleCase('FROM')).toBe('From');
    expect(fieldTitleCase('Duration (minutes) *')).toBe('Duration (Minutes) *');
    expect(fieldTitleCase('Pick-up *')).toBe('Pick-Up *');
    expect(fieldTitleCase('What for?')).toBe('What for?');
  });

  it('preserves short all-caps acronyms', () => {
    expect(fieldTitleCase('UI font')).toBe('UI Font');
    expect(fieldTitleCase('FX rate')).toBe('FX Rate');
    expect(fieldTitleCase('API key')).toBe('API Key');
  });

  it('preserves intentional camel casing in product and platform names', () => {
    expect(fieldTitleCase('StraiAway')).toBe('StraiAway');
    expect(fieldTitleCase('Connect StraiAway')).toBe('Connect StraiAway');
    expect(fieldTitleCase('Open in onTrack for iOS')).toBe('Open in onTrack for iOS');
    expect(fieldTitleCase('E-ZPass activity')).toBe('E-ZPass Activity');
  });

  it('title-cases compact count and activity metadata', () => {
    expect(fieldTitleCase('2 activities')).toBe('2 Activities');
    expect(fieldTitleCase('expense')).toBe('Expense');
    expect(fieldTitleCase('$8.25 · 2 refunds')).toBe('$8.25 · 2 Refunds');
  });

  it('title-cases labels composed from multiple JSX text fragments', () => {
    expect(titleCaseTextChildren(['expense', ' · ', 'Sample Friend'])).toEqual([
      'Expense',
      ' · ',
      'Sample Friend',
    ]);
    expect(titleCaseTextChildren(['$150.84 tolls · ', '-$9.00 refunds'])).toEqual([
      '$150.84 Tolls · ',
      '-$9.00 Refunds',
    ]);
  });

  it('keeps short prepositions lowercase unless first', () => {
    expect(fieldTitleCase('Starts in 34 days')).toBe('Starts in 34 Days');
    expect(fieldTitleCase('Day 3 of 4')).toBe('Day 3 of 4');
    expect(fieldTitleCase('What for?')).toBe('What for?');
    expect(fieldTitleCase('Start a New Trip')).toBe('Start a New Trip');
    expect(fieldTitleCase('Start A New Trip')).toBe('Start a New Trip');
    expect(fieldTitleCase('A New Trip')).toBe('A New Trip');
    expect(fieldTitleCase('Cards & accounts')).toBe('Cards & Accounts');
    expect(fieldTitleCase('Cash vs debt rates')).toBe('Cash vs Debt Rates');
  });

  it('title-cases button labels', () => {
    expect(fieldTitleCase('Open day')).toBe('Open Day');
    expect(fieldTitleCase('Save check-in')).toBe('Save Check-in');
    expect(fieldTitleCase('Create playbook')).toBe('Create Playbook');
    expect(fieldTitleCase('Jump to today')).toBe('Jump to Today');
  });

  it('keeps possessive s lowercase for ASCII and curly apostrophes', () => {
    expect(fieldTitleCase("Imtiaz's Icon")).toBe("Imtiaz's Icon");
    expect(fieldTitleCase('Imtiaz’s Icon')).toBe('Imtiaz’s Icon');
    expect(fieldTitleCase("imtiaz's icon")).toBe("Imtiaz's Icon");
    expect(fieldTitleCase('imtiaz’s icon')).toBe('Imtiaz’s Icon');
  });
});
