import { peoplePickerIdentity } from '../people-picker';

const friend = {
  displayName: 'Alex Rivera',
};

describe('PeoplePicker identity display', () => {
  it('exposes only the name', () => {
    const identity = peoplePickerIdentity(friend);

    expect(identity).toEqual({
      name: 'Alex Rivera',
      detail: undefined,
      searchText: 'alex rivera',
    });
    expect(JSON.stringify(identity)).not.toContain('@');
  });

  it('trims names and searches without carrying email metadata', () => {
    expect(peoplePickerIdentity({ displayName: '  Jordan Lee  ' })).toEqual({
      name: 'Jordan Lee',
      detail: undefined,
      searchText: 'jordan lee',
    });
  });
});
