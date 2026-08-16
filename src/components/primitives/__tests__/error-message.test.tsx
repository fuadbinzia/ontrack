import { render } from '@testing-library/react-native';

import { ErrorMessage } from '@/components/primitives/error-message';

const mockReport = jest.fn();

jest.mock('@/utils/operational-error', () => {
  const actual = jest.requireActual('@/utils/operational-error') as typeof import('@/utils/operational-error');
  return {
    ...actual,
    reportOperationalFailure: (...args: unknown[]) => mockReport(...args),
  };
});

describe('ErrorMessage', () => {
  beforeEach(() => {
    mockReport.mockReset();
  });

  it('does not render backend outage copy', () => {
    const screen = render(<ErrorMessage message="Sports schedules are not configured." />);
    expect(screen.queryByText('Sports schedules are not configured.')).toBeNull();
    expect(screen.queryByLabelText('Error: Sports schedules are not configured.')).toBeNull();
  });

  it('still renders user-facing validation', () => {
    const screen = render(<ErrorMessage message="Choose a title for this event." />);
    expect(screen.getByText('Choose a title for this event.')).toBeTruthy();
  });
});
