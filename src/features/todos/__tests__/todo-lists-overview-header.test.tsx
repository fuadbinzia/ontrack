import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { render, screen } from '@testing-library/react-native';

import { ChecklistsOverviewHeader } from '@/features/todos/todo-lists-overview-header';
import { AgentUiIds } from '@/utils/agent-ui';

function renderHeader(
  overrides: Partial<Parameters<typeof ChecklistsOverviewHeader>[0]> = {},
) {
  return render(
    <ChecklistsOverviewHeader
      listCount={8}
      totalOpen={84}
      editMode={false}
      draft=""
      onDraftChange={jest.fn()}
      onSubmitDraft={jest.fn()}
      onToggleEditMode={jest.fn()}
      {...overrides}
    />,
  );
}

describe('ChecklistsOverviewHeader', () => {
  it('leads with the open-work summary instead of a redundant eyebrow', () => {
    renderHeader();

    expect(screen.getByText('Checklists')).toBeTruthy();
    expect(screen.getByText('84 open items across 8 lists.')).toBeTruthy();
    expect(screen.queryByText('Your Checklists')).toBeNull();
    expect(screen.queryByText('Your checklists')).toBeNull();
  });

  it('uses an edit icon instead of an Edit pill', () => {
    renderHeader();

    expect(screen.getByLabelText('Edit checklists')).toBeTruthy();
    expect(screen.queryByText('Edit')).toBeNull();
    expect(screen.queryByText('Done')).toBeNull();

    renderHeader({ editMode: true });
    expect(screen.getByLabelText('Finish editing checklists')).toBeTruthy();
    expect(screen.queryByText('Done')).toBeNull();
  });

  it('keeps the hub header free of an add-collaborator control', () => {
    renderHeader();

    expect(screen.queryByTestId(AgentUiIds.checklists.collaborators)).toBeNull();
    expect(screen.queryByLabelText('Add collaborators')).toBeNull();
  });

  it('creates from a name field without checklist or grocery chips', () => {
    renderHeader();

    expect(screen.getByLabelText('New list name')).toBeTruthy();
    expect(screen.queryByTestId(AgentUiIds.checklists.newListKind('checklist'))).toBeNull();
    expect(screen.queryByTestId(AgentUiIds.checklists.newListKind('grocery'))).toBeNull();
    expect(screen.queryByLabelText('Checklist')).toBeNull();
    expect(screen.queryByLabelText('Grocery')).toBeNull();
    expect(screen.queryByLabelText('New list kind')).toBeNull();
  });

  it('hides the composer while lists are being edited', () => {
    renderHeader({ editMode: true });

    expect(screen.queryByLabelText('New list name')).toBeNull();
    expect(screen.queryByLabelText('New list kind')).toBeNull();
  });

  it('does not fade the hub to 0 on focus, which would show the previous page', () => {
    const source = readFileSync(
      join(process.cwd(), 'src/features/todos/todo-lists-overview-header.tsx'),
      'utf8',
    );
    expect(source).not.toContain('useFocusEffect');
    expect(source).not.toContain('entrance.value = 0');
  });
});
