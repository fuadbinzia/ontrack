import {
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react-native";

import { useFinance } from "@/store/finance";

import { OverviewScreen } from "../overview-screen";

let mockPlants: {
  id: string;
  nickname: string;
  nextWateringAt: string;
}[] = [];
let mockTodayKey = "2026-08-13";
const mockSetSelectedDate = jest.fn();
const mockOpenHttpsUrl = jest.fn();
let mockActivities: Record<string, unknown>[] = [];
let mockCategories: Record<string, unknown>[] = [];
let mockEventDetails: Record<string, unknown>[] = [];
let mockEventFollows: Record<string, unknown>[] = [];

function resetOverviewTestState() {
  mockPlants = [];
  mockTodayKey = "2026-08-13";
  mockActivities = [];
  mockCategories = [];
  mockEventDetails = [];
  mockEventFollows = [];
  mockSetSelectedDate.mockClear();
  mockOpenHttpsUrl.mockClear();
  useFinance.getState().reset();
}

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

jest.mock("expo-image", () => {
  const React = jest.requireActual("react");
  const { View } = jest.requireActual("react-native");
  return {
    Image: ({ accessibilityLabel }: { accessibilityLabel?: string }) =>
      React.createElement(View, { accessibilityLabel }),
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
    Button: ({
      accessibilityLabel,
      children,
      onPress,
    }: {
      accessibilityLabel: string;
      children?: React.ReactNode;
      onPress: () => void;
    }) =>
      React.createElement(Pressable, { accessibilityLabel, onPress }, children),
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
  const { Pressable, Text } = jest.requireActual("react-native");
  return {
    OverviewSummaryRow: ({
      row,
    }: {
      row: {
        label: string;
        headline: string;
        detail: string;
        beforeNavigate?: () => void;
      };
    }) =>
      React.createElement(
        Pressable,
        {
          accessibilityLabel: `Open ${row.label}`,
          onPress: row.beforeNavigate,
        },
        React.createElement(
          Text,
          null,
          `${row.label}|${row.headline}|${row.detail}`,
        ),
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
  useTheme: () => ({ success: "#27d3a2", accentPrimary: "#3978e6" }),
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
  usePlants: (
    selector: (state: { plants: typeof mockPlants }) => unknown,
  ) => selector({ plants: mockPlants }),
}));
jest.mock("@/store/schedule", () => ({
  useSchedule: (
    selector: (state: {
      activities: Record<string, unknown>[];
      categories: Record<string, unknown>[];
      eventDetails: Record<string, unknown>[];
      eventFollows: Record<string, unknown>[];
    }) => unknown,
  ) => selector({
    activities: mockActivities,
    categories: mockCategories,
    eventDetails: mockEventDetails,
    eventFollows: mockEventFollows,
  }),
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
jest.mock("@/store/ui", () => ({
  useUI: (selector: (state: { setSelectedDate: jest.Mock }) => unknown) =>
    selector({ setSelectedDate: mockSetSelectedDate }),
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
  return {
    AgentTestId: ({ children }: { children?: React.ReactNode }) => children,
    AgentUiIds: {
      overview: {
        screen: "ontrack.overview.screen",
        hero: "ontrack.overview.hero",
        eventUpdates: "ontrack.overview.eventUpdates",
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
  todayKey: () => mockTodayKey,
}));

jest.mock("@/utils/safe-url", () => ({
  openHttpsUrl: (url: string) => mockOpenHttpsUrl(url),
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
  beforeEach(resetOverviewTestState);
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
    expect(screen.getByText("1 thing needs your attention")).toBeTruthy();
    expect(screen.getByText("Internet · Bill due")).toBeTruthy();
  });

  it("uses plural noun and verb forms when multiple items need attention", () => {
    useFinance.setState({
      bills: [bill("2026-08-12"), { ...bill("2026-08-13"), id: "bill-two" }],
    });

    render(<OverviewScreen />);

    expect(screen.getByText("2 things need your attention")).toBeTruthy();
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

describe("OverviewScreen Today navigation", () => {
  beforeEach(resetOverviewTestState);

  afterEach(cleanup);

  it("resets the timeline to the current date when Today is opened", () => {
    render(<OverviewScreen />);

    fireEvent.press(screen.getByLabelText("Open Today"));

    expect(mockSetSelectedDate).toHaveBeenCalledWith("2026-08-13");
  });

  it("uses the current date at tap time instead of a date captured during render", () => {
    render(<OverviewScreen />);
    mockTodayKey = "2026-08-14";

    fireEvent.press(screen.getByLabelText("Open Today"));

    expect(mockSetSelectedDate).toHaveBeenCalledWith("2026-08-14");
  });

  it("does not change the timeline date when another Overview row is opened", () => {
    render(<OverviewScreen />);

    fireEvent.press(screen.getByLabelText("Open Travel"));

    expect(mockSetSelectedDate).not.toHaveBeenCalled();
  });
});

describe("OverviewScreen calendar excitement", () => {
  beforeEach(resetOverviewTestState);
  afterEach(cleanup);

  it("highlights a fun calendar event and opens its YouTube updates search", () => {
    mockActivities = [
      {
        id: "ufc-330",
        date: "2026-08-13",
        title: "UFC 330: Rivera vs. Lee",
        categoryId: "personal",
        startMinutes: 1260,
        durationMinutes: 180,
        status: "upcoming",
        createdAt: "2026-08-01T00:00:00.000Z",
        updatedAt: "2026-08-01T00:00:00.000Z",
      },
    ];

    render(<OverviewScreen />);

    expect(screen.getByText("Fight Night Is Here")).toBeTruthy();
    expect(screen.getByLabelText("UFC logo")).toBeTruthy();
    fireEvent.press(
      screen.getByLabelText(
        "Watch updates for UFC 330: Rivera vs. Lee on YouTube",
      ),
    );
    expect(mockOpenHttpsUrl).toHaveBeenCalledWith(
      "https://www.youtube.com/results?search_query=UFC%20330%3A%20Rivera%20vs.%20Lee%20latest%20news%20preview%20updates",
    );
  });

  it("keeps the generic pulse mark when a celebration has no logo", () => {
    mockActivities = [
      {
        id: "birthday",
        date: "2026-08-13",
        title: "Birthday Party",
        categoryId: "personal",
        startMinutes: 1080,
        durationMinutes: 180,
        status: "upcoming",
        createdAt: "2026-08-01T00:00:00.000Z",
        updatedAt: "2026-08-01T00:00:00.000Z",
      },
    ];

    render(<OverviewScreen />);

    expect(screen.getByText("A Good Day Is Here")).toBeTruthy();
    expect(screen.queryByLabelText("UFC logo")).toBeNull();
  });
});

describe("OverviewScreen plant grammar", () => {
  beforeEach(resetOverviewTestState);

  afterEach(cleanup);

  it("uses singular noun and verb forms for one plant needing care", () => {
    mockPlants = [
      {
        id: "plant-one",
        nickname: "Fern",
        nextWateringAt: "2026-08-13T08:00:00.000Z",
      },
    ];

    render(<OverviewScreen />);

    expect(
      screen.getByText(
        "Plants|1 plant needs care|1 plant in your collection.",
      ),
    ).toBeTruthy();
  });

  it("uses plural noun and verb forms for multiple plants needing care", () => {
    mockPlants = [
      {
        id: "plant-one",
        nickname: "Fern",
        nextWateringAt: "2026-08-13T08:00:00.000Z",
      },
      {
        id: "plant-two",
        nickname: "Palm",
        nextWateringAt: "2026-08-12T08:00:00.000Z",
      },
    ];

    render(<OverviewScreen />);

    expect(
      screen.getByText(
        "Plants|2 plants need care|2 plants in your collection.",
      ),
    ).toBeTruthy();
  });
});
