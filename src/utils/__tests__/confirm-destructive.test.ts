import { confirmDestructiveAction } from '../confirm-destructive';

jest.mock('@/components/primitives', () => ({
  appPrompt: {
    alert: jest.fn(),
  },
}));

const { appPrompt } = jest.requireMock('@/components/primitives') as {
  appPrompt: { alert: jest.Mock };
};

describe('confirmDestructiveAction', () => {
  beforeEach(() => {
    appPrompt.alert.mockClear();
  });

  it('presents cancel + destructive buttons', () => {
    const onConfirm = jest.fn();
    confirmDestructiveAction({
      title: 'Delete item?',
      message: 'Gone for good.',
      actionLabel: 'Remove',
      onConfirm,
    });
    expect(appPrompt.alert).toHaveBeenCalledWith(
      'Delete item?',
      'Gone for good.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Remove', style: 'destructive', onPress: onConfirm },
      ],
    );
  });

  it('forwards a stable selector to the destructive action', () => {
    const onConfirm = jest.fn();
    confirmDestructiveAction({
      title: 'Delete expense?',
      actionLabel: 'Delete Expense',
      confirmTestID: 'ontrack.travel.expenses.confirmDelete',
      onConfirm,
    });

    expect(appPrompt.alert).toHaveBeenCalledWith(
      'Delete expense?',
      undefined,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Expense',
          style: 'destructive',
          testID: 'ontrack.travel.expenses.confirmDelete',
          onPress: onConfirm,
        },
      ],
    );
  });

  it('keeps confirmation prompts in the requested orientation', () => {
    const onConfirm = jest.fn();
    confirmDestructiveAction({
      title: 'Unpin this place?',
      actionLabel: 'Unpin',
      supportedOrientations: ['landscape-left', 'landscape-right'],
      onConfirm,
    });

    expect(appPrompt.alert).toHaveBeenCalledWith(
      'Unpin this place?',
      undefined,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Unpin', style: 'destructive', onPress: onConfirm },
      ],
      { supportedOrientations: ['landscape-left', 'landscape-right'] },
    );
  });
});
