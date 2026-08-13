import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { AgentUiIds } from '@/utils/agent-ui/ids';
import { sendCrashReport } from '@/utils/crash-report';

import { RouteErrorBoundary } from '../route-error-boundary';

jest.mock('@/utils/crash-report', () => ({
  sendCrashReport: jest.fn(),
}));

const mockSendCrashReport = jest.mocked(sendCrashReport);

describe('RouteErrorBoundary crash report feedback', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('thanks the user only after the report is delivered', async () => {
    mockSendCrashReport.mockResolvedValue({ method: 'sent' });
    render(
      <RouteErrorBoundary error={new Error('Boom')} retry={jest.fn()} />,
    );

    fireEvent.press(screen.getByTestId(AgentUiIds.errorBoundary.sendReport));

    await waitFor(() => expect(screen.getByText('Report sent')).toBeTruthy());
    expect(
      screen.getByText(
        'Thank you. We received the report and will review the issue promptly.',
      ),
    ).toBeTruthy();
  });

  it('keeps retry available and avoids a false success message after failure', async () => {
    mockSendCrashReport.mockResolvedValue({
      method: 'unavailable',
      reason: 'We could not send the report. Check your connection and try again.',
    });
    render(
      <RouteErrorBoundary error={new Error('Boom')} retry={jest.fn()} />,
    );

    fireEvent.press(screen.getByTestId(AgentUiIds.errorBoundary.sendReport));

    await waitFor(() =>
      expect(screen.getByText(/We could not send the report/)).toBeTruthy(),
    );
    expect(screen.queryByText('Report sent')).toBeNull();
    fireEvent.press(screen.getByTestId(AgentUiIds.errorBoundary.sendReport));
    await waitFor(() => expect(mockSendCrashReport).toHaveBeenCalledTimes(2));
  });

  it('does not submit the same crash twice after successful delivery', async () => {
    mockSendCrashReport.mockResolvedValue({ method: 'sent' });
    render(
      <RouteErrorBoundary error={new Error('Boom')} retry={jest.fn()} />,
    );
    const button = screen.getByTestId(AgentUiIds.errorBoundary.sendReport);

    fireEvent.press(button);
    await waitFor(() => expect(screen.getByText('Report sent')).toBeTruthy());
    fireEvent.press(button);

    expect(mockSendCrashReport).toHaveBeenCalledTimes(1);
  });
});
