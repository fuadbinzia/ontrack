import {
  collaboratorInitial,
  checklistIcon,
} from '@/features/todos/list-icon';

describe('to-do list icons', () => {
  it('uses category icons for grocery and maintenance lists', () => {
    expect(checklistIcon('Groceries')).toBe('groceries');
    expect(checklistIcon('Weekly grocery run')).toBe('groceries');
    expect(checklistIcon('Home Maintenance')).toBe('maintenance');
    expect(checklistIcon('Car repairs')).toBe('maintenance');
  });

  it('keeps the checklist icon independent from collaboration state', () => {
    expect(checklistIcon('Weekend')).toBe('tasks');
    expect(checklistIcon('App Stuff')).toBe('tasks');
  });

  it('creates initials for accepted collaborator avatars', () => {
    expect(collaboratorInitial('Alex')).toBe('A');
    expect(collaboratorInitial(' rocky')).toBe('R');
  });
});
