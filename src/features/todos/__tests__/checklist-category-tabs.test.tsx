import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { fireEvent, render, screen } from '@testing-library/react-native';

import { ChecklistCategoryTabs } from '@/features/todos/checklist-category-tabs';

const tabsSource = readFileSync(
  join(process.cwd(), 'src/features/todos/checklist-category-tabs.tsx'),
  'utf8',
);

describe('ChecklistCategoryTabs', () => {
  it('keeps category chips to a selected border instead of status dots', () => {
    expect(tabsSource).toContain('titleCase');
    expect(tabsSource).toContain('borderColor: theme.accentPrimary');
    expect(tabsSource).not.toContain('styles.dot');
    expect(tabsSource).not.toContain('backgroundColor: selected');
  });

  it('marks the active category selected and notifies on change', () => {
    const onSelect = jest.fn();
    render(
      <ChecklistCategoryTabs
        categories={[
          {
            id: 'travel',
            listId: 'list-1',
            name: 'Travel',
            position: 0,
            createdAt: '2026-08-12T00:00:00.000Z',
            updatedAt: '2026-08-12T00:00:00.000Z',
          },
        ]}
        selectedId="all"
        onSelect={onSelect}
      />,
    );

    expect(screen.getByLabelText('All category').props.accessibilityState).toEqual({
      selected: true,
    });
    expect(screen.getByLabelText('Travel category').props.accessibilityState).toEqual({
      selected: false,
    });
    fireEvent.press(screen.getByLabelText('Travel category'));
    expect(onSelect).toHaveBeenCalledWith('travel');
  });
});
