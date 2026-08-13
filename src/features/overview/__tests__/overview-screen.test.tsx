import { cleanup, render, screen } from "@testing-library/react-native";

import { useFinance } from "@/store/finance";

import { OverviewScreen } from "../overview-screen";

jest.mock("react-native-reanimated", () => {
  const { View } = jest.requireActual("react-native");
  const transition = {
    duration: () => transition,
    reduceMotion: () => transition,
  };
  return {
    __esModule: true,
    default: { View },
    Easing: { bezier: () => ({}) },
    FadeOutLeft: transition,
    LinearTransition: transition,
    ReduceMotion: { System: "system" },
  };
});

jest.mock("@/components/navigation/bottom-nav-tab-meta", () => {
  const routeNames = [
    "(today)",
    "calendar",
    "finance",
    "food",
    "games",
    "health",
    "insights",
    "plants",
    "profile",
    "social",
    "to-do",
    "travel",
    "vehicles",
    "vision-board",
    "workouts",
  ];
  return {
    isTrackerRouteEnabled: () => true,
    TAB_META: Object.fromEntries(
      routeNames.map((routeName) => [
        routeName,
        { icon: "home", href: `/${routeName}` },
      ]),
    ),
  };
});

jest.mock("@/components/primitives", () => {
  const React = jest.requireActual("react");
  const { Pressable, Text, View } = jest.requireActual("react-native");
  const Container = ({ children }: { children?: React.ReactNode }) =>
    React.createElement(View, null, children);
  return {
    AppText: ({ children }: { children?: React.ReactNode }) =>
      React.createElement(Text, null, children),
    GlassIconWell: Container,
    GlassPlate: Container,
    IconButton: ({
      accessibilityLabel,
      onPress,
    }: {
      accessibilityLabel: string;
      onPress: () => void;
    }) => React.createElement(Pressable, { accessibilityLabel, onPress }),
    Screen: Container,
    ScreenHeader: ({ title }: { title: string }) =>
      React.createElement(Text, null, title),
    Symbol: () => React.createElement(View),
  };
});

jest.mock("../overview-summary-row", () => {
  const React = jest.requireActual("react");
  const { Text } = jest.requireActual("react-native");
  return {
    OverviewSummaryRow: ({
      row,
    }: {
      row: { label: string; headline: string; detail: string };
    }) =>
      React.createElement(
        Text,
        null,
        `${row.label}|${row.headline}|${row.detail}`,
      ),
  };
});

jest.mock("@/hooks/use-responsive", () => ({
  useResponsive: () => ({
    s: (value: number) => value,
    spacing: { xxs: 4, xs: 8, sm: 12, md: 16, lg: 24 },
  }),
}));

jest.mock("@/hooks/use-theme", () => ({
  useTheme: () => ({ success: "#27d3a2" }),
}));

jest.mock("@/store/addons", () => ({
  useAddons: (
    selector: (state: { enabled: Record<string, boolean> }) => unknown,
  ) => selector({ enabled: {} }),
}));
jest.mock("@/store/food-meal-plan", () => ({
  useMealPlan: (selector: (state: { entries: never[] }) => unknown) =>
    selector({ entries: [] }),
}));
jest.mock("@/store/health", () => ({
  useHealth: (
    selector: (state: {
      dailySummaries: never[];
      moodEntries: never[];
    }) => unknown,
  ) => selector({ dailySummaries: [], moodEntries: [] }),
}));
jest.mock("@/store/overview-attention", () => ({
  useOverviewAttention: (
    selector: (state: {
      acknowledgedKeys: string[];
      acknowledge: jest.Mock;
    }) => unknown,
  ) => selector({ acknowledgedKeys: [], acknowledge: jest.fn() }),
}));
jest.mock("@/store/plants", () => ({
  usePlants: (selector: (state: { plants: never[] }) => unknown) =>
    selector({ plants: [] }),
}));
jest.mock("@/store/schedule", () => ({
  useSchedule: (
    selector: (state: { activities: never[]; categories: never[] }) => unknown,
  ) => selector({ activities: [], categories: [] }),
}));
jest.mock("@/store/todos", () => ({
  useTodos: (
    selector: (state: { lists: never[]; tasks: never[] }) => unknown,
  ) => selector({ lists: [], tasks: [] }),
}));
jest.mock("@/store/travel", () => ({
  useTravel: (selector: (state: { plans: never[] }) => unknown) =>
    selector({ plans: [] }),
}));
jest.mock("@/store/vehicles", () => ({
  useVehicles: (selector: (state: { vehicles: never[] }) => unknown) =>
    selector({ vehicles: [] }),
}));
jest.mock("@/store/vision-board", () => ({
  useVisionBoard: (
    selector: (state: { categories: never[]; items: never[] }) => unknown,
  ) => selector({ categories: [], items: [] }),
}));

jest.mock("@/utils/agent-ui", () => {
  const React = jest.requireActual("react");
  return {
    AgentTestId: ({ children }: { children?: React.ReactNode }) => children,
    AgentUiIds: {
      overview: {
        screen: "ontrack.overview.screen",
        hero: "ontrack.overview.hero",
        section: "ontrack.overview.section",
        acknowledge: (key: string) => `ontrack.overview.acknowledge.${key}`,
      },
    },
  };
});

jest.mock("@/utils/date", () => ({
  formatDateKeyMedium: (dateKey: string) => dateKey,
  formatMinutes: (minutes: number) => `${minutes}`,
  formatTripDateRangeLabel: (start: string, end: string) => `${start}-${end}`,
  nowMinutes: () => 600,
  todayKey: () => "2026-08-13",
}));

function bill(nextDue: string, active = true) {
  return {
    id: `bill-${nextDue}`,
    name: "Internet",
    amount: 80,
    currency: "USD",
    cadence: "monthly" as const,
    nextDue,
    categoryId: "home",
    entityId: "personal",
    kind: "bill" as const,
    active,
    createdAt: "2026-08-01T00:00:00.000Z",
    updatedAt: "2026-08-01T00:00:00.000Z",
  };
}

describe("OverviewScreen finance integration", () => {
  beforeEach(() => useFinance.getState().reset());
  afterEach(() => {
    cleanup();
    useFinance.getState().reset();
  });

  it("renders the empty Finance state from the Finance store", () => {
    render(<OverviewScreen />);

    expect(
      screen.getByText(
        "Finance|No upcoming bills|Accounts, savings, and spending are one tap away.",
      ),
    ).toBeTruthy();
  });

  it("surfaces a due bill in both the Finance row and attention summary", () => {
    useFinance.setState({ bills: [bill("2026-08-13")] });

    render(<OverviewScreen />);

    expect(
      screen.getByText(/Finance\|1 bill due now\|Internet · .*80.*2026-08-13/),
    ).toBeTruthy();
    expect(screen.getByText("1 thing need your attention")).toBeTruthy();
    expect(screen.getByText("• Internet · Bill due")).toBeTruthy();
  });

  it("shows a future active bill without adding overdue attention", () => {
    useFinance.setState({ bills: [bill("2026-08-20")] });

    render(<OverviewScreen />);

    expect(
      screen.getByText(
        /Finance\|1 bill coming up\|Internet · .*80.*2026-08-20/,
      ),
    ).toBeTruthy();
    expect(screen.getByText("Everything is moving smoothly")).toBeTruthy();
    expect(screen.queryByText("• Internet · Bill due")).toBeNull();
  });
});
