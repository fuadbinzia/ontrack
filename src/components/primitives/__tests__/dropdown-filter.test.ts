import { filterDropdownOptions } from '../dropdown-filter';

const options = [
  { label: 'Alex Rivera', searchText: 'alex@example.com' },
  {
    label: 'Jordan Lee',
    searchText: 'jordan@example.com road trip',
  },
];

describe('filterDropdownOptions', () => {
  it('returns every option for an empty or whitespace-only query', () => {
    expect(filterDropdownOptions(options, '')).toEqual(options);
    expect(filterDropdownOptions(options, '   ')).toEqual(options);
  });

  it('matches visible labels and hidden search terms without regard to case', () => {
    expect(filterDropdownOptions(options, 'RIVERA')).toEqual([options[0]]);
    expect(filterDropdownOptions(options, 'JORDAN@EXAMPLE')).toEqual([options[1]]);
  });

  it('matches extra search terms and returns no unrelated options', () => {
    expect(filterDropdownOptions(options, 'road trip')).toEqual([options[1]]);
    expect(filterDropdownOptions(options, 'not-a-friend')).toEqual([]);
  });
});
