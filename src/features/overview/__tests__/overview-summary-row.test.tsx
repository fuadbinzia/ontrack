import { cleanup, fireEvent, render, screen } from '@testing-library/react-native';

import { OverviewSummaryRow, type OverviewRow } from '../overview-summary-row';

const mockNavigate = jest.fn();
const mockStartTabOpen = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({ navigate: mockNavigate }),
}));

jest.mock('@/components/navigation/overview-return', () => ({
  peekCurrentTabName: () => 'overview',
  startTabOpen: (...args: unknown[]) => mockStartTabOpen(...args),
}));

jest.mock('@/components/navigation/bottom-nav-tab-meta', () => ({
  TAB_META: {
    '(today)': { icon: 'today' },
    travel: { icon: 'flight' },
  },
}));

jest.mock('@/components/primitives', () => {
  const React = jest.requireActual('react');
  const { Text, View } = jest.requireActual('react-native');

  return {
    AppText: ({ children }: { children?: React.ReactNode }) =>
      React.createElement(Text, null, children),
    GlassIconWell: ({ children }: { children?: React.ReactNode }) =>
      React.createElement(View, null, children),
    GlassPlate: ({ children }: { children?: React.ReactNode }) =>
      React.createElement(View, null, children),
    Symbol: () => React.createElement(View),
  };
});

jest.mock('@/hooks/use-responsive', () => ({
  useResponsive: () => ({
    layout: { minTapTarget: 44 },
    s: (value: number) => value,
    spacing: { xxs: 4, sm: 12, md: 16 },
  }),
}));

jest.mock('@/hooks/use-theme', () => ({
  useTheme: () => ({
    accentPrimary: '#123456',
    separator: '#abcdef',
    textTertiary: '#654321',
  }),
}));

jest.mock('@/utils/agent-ui', () => {
  return {
    AgentTestId: ({ children }: { children?: React.ReactNode }) => children,
    AgentUiIds: { overview: { row: (route: string) => route } },
  };
});

const baseRow: OverviewRow = {
  routeName: '(today)',
  label: 'Today',
  headline: 'Your day is clear',
  detail: 'Open the timeline.',
  href: '/',
};

describe('OverviewSummaryRow navigation', () => {
  afterEach(() => {
    cleanup();
    mockNavigate.mockReset();
    mockStartTabOpen.mockReset();
  });

  it('runs the row preparation before navigating', () => {
    const order: string[] = [];
    const beforeNavigate = jest.fn(() => order.push('prepare'));
    mockNavigate.mockImplementation(() => order.push('navigate'));
    render(<OverviewSummaryRow row={{ ...baseRow, beforeNavigate }} />);

    fireEvent.press(
      screen.getByLabelText('Today. Your day is clear. Open the timeline.'),
    );

    expect(beforeNavigate).toHaveBeenCalledTimes(1);
    expect(mockStartTabOpen).toHaveBeenCalledWith(
      expect.objectContaining({
        from: 'overview',
        to: '(today)',
        side: 'right',
      }),
    );
    expect(mockNavigate).toHaveBeenCalledWith('/');
    expect(order).toEqual(['prepare', 'navigate']);
  });

  it('still navigates when a section has no tab icon', () => {
    render(
      <OverviewSummaryRow
        row={{ ...baseRow, routeName: 'unknown-section' }}
      />,
    );

    fireEvent.press(
      screen.getByLabelText('Today. Your day is clear. Open the timeline.'),
    );

    expect(mockNavigate).toHaveBeenCalledWith('/');
  });

  it('navigates rows that do not need preparation', () => {
    const row = {
      ...baseRow,
      routeName: 'travel',
      label: 'Travel',
      href: '/(tabs)/travel' as const,
    };
    render(<OverviewSummaryRow row={row} />);

    fireEvent.press(
      screen.getByLabelText('Travel. Your day is clear. Open the timeline.'),
    );

    expect(mockStartTabOpen).toHaveBeenCalledWith(
      expect.objectContaining({
        from: 'overview',
        to: 'travel',
        side: 'right',
      }),
    );
    expect(mockNavigate).toHaveBeenCalledWith('/(tabs)/travel');
  });
});
