import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react-native";

import type { TravelPlan } from "../types";
import { TravelPlanTripTools } from "../travel-plan-trip-tools";

const mockAlert = jest.fn();
const mockGetStraiAwayStatus = jest.fn();
const mockPushStraiAwayStays = jest.fn();
const mockRouterPush = jest.fn();
const mockRecordPlanInteraction = jest.fn();
let mockAuthUser: { email?: string } | null;
let mockGuestName: string;

jest.mock("expo-router", () => ({
  useRouter: () => ({
    navigate: jest.fn(),
    push: mockRouterPush,
  }),
}));

jest.mock("@/components/primitives", () => ({
  appPrompt: {
    alert: (...args: unknown[]) => mockAlert(...args),
    dismiss: jest.fn(),
  },
}));

jest.mock("@/features/auth/auth-provider", () => ({
  useAuthSession: () => ({ user: mockAuthUser }),
}));

jest.mock("@/features/travel/travel-trip-action-grid", () => {
  const React = jest.requireActual("react");
  const { Pressable, Text } = jest.requireActual("react-native");
  return {
    TravelTripActionGrid: ({
      onOpenStraiAway,
    }: {
      onOpenStraiAway: () => void;
    }) =>
      React.createElement(
        Pressable,
        { onPress: onOpenStraiAway, testID: "travel-action-straiaway" },
        React.createElement(Text, null, "StraiAway"),
      ),
  };
});

jest.mock("@/features/travel/expenses/travel-expenses-sheet", () => ({
  TravelExpensesSheet: () => null,
}));
jest.mock("@/features/travel/travel-calendar-updated-modal", () => ({
  TravelCalendarUpdatedModal: () => null,
}));
jest.mock("@/features/travel/travel-currency-sheet", () => ({
  TravelCurrencySheet: () => null,
}));
jest.mock("@/features/travel/travel-friends-sheet", () => ({
  TravelFriendsSheet: () => null,
}));
jest.mock("@/features/travel/translator/travel-translator-sheet", () => ({
  TravelTranslatorSheet: () => null,
}));
jest.mock("@/features/travel/weather/travel-weather-sheet", () => ({
  TravelWeatherSheet: () => null,
}));

jest.mock("@/hooks/use-responsive", () => ({
  useResponsive: () => ({ spacing: { md: 16 } }),
}));

jest.mock("@/services/partner/straiaway", () => ({
  getStraiAwayStatus: (...args: unknown[]) => mockGetStraiAwayStatus(...args),
  openStraiAwayStay: jest.fn(),
  pullStraiAwayStays: jest.fn(),
  pushStraiAwayStays: (...args: unknown[]) => mockPushStraiAwayStays(...args),
}));

jest.mock("@/store/preferences", () => ({
  usePreferences: (
    selector: (state: { name: string; dateDisplayFormat: string }) => unknown,
  ) => selector({ name: mockGuestName, dateDisplayFormat: "MM/DD/YYYY" }),
}));

jest.mock("@/store/schedule", () => ({
  useSchedule: (
    selector: (state: {
      activities: never[];
      replaceTravelActivities: jest.Mock;
    }) => unknown,
  ) => selector({ activities: [], replaceTravelActivities: jest.fn(() => []) }),
}));

jest.mock("@/store/todos", () => {
  const useTodos = (selector: (state: { createList: jest.Mock }) => unknown) =>
    selector({ createList: jest.fn() });
  useTodos.getState = () => ({ lists: [] });
  return { useTodos };
});

jest.mock("@/store/travel", () => ({
  useTravel: (
    selector: (state: {
      savePlan: jest.Mock;
      recordPlanInteraction: jest.Mock;
    }) => unknown,
  ) =>
    selector({
      savePlan: jest.fn(),
      recordPlanInteraction: mockRecordPlanInteraction,
    }),
}));

jest.mock("@/store/ui", () => ({
  useUI: (selector: (state: { setSelectedDate: jest.Mock }) => unknown) =>
    selector({ setSelectedDate: jest.fn() }),
}));

jest.mock("@/utils/agent-ui", () => {
  const React = jest.requireActual("react");
  return {
    AgentTestId: ({ children }: { children?: React.ReactNode }) => children,
    AgentUiIds: {
      travel: {
        planDetail: {
          toolsSection: 'ontrack.travel.planDetail.section.tools',
        },
        tripTools: {
          section: (tripId: string) =>
            `ontrack.travel.tripTools.section.${tripId}`,
        },
      },
    },
  };
});

jest.mock("@/utils/defer-after-page-transition", () => ({
  deferAfterPageTransition: (callback: () => void) => callback(),
}));

const plan: TravelPlan = {
  id: "plan-1",
  title: "Brooklyn weekend",
  destination: "Brooklyn",
  startDate: "2026-09-12",
  endDate: "2026-09-14",
  itinerary: [
    {
      id: "stay-1",
      kind: "stay",
      title: "North Harbor Loft",
      date: "2026-09-12",
      startMinutes: 16 * 60,
      durationMinutes: 12 * 60,
      stay: { checkoutDate: "2026-09-14" },
    },
  ],
  participants: [],
  baseCurrency: "USD",
  expenses: [],
  createdAt: "2026-08-01T00:00:00.000Z",
  updatedAt: "2026-08-01T00:00:00.000Z",
};

async function openSendStaysPrompt() {
  fireEvent.press(screen.getByTestId("travel-action-straiaway"));
  await waitFor(() =>
    expect(mockAlert).toHaveBeenCalledWith(
      "StraiAway",
      expect.any(String),
      expect.any(Array),
    ),
  );
  const promptCall = mockAlert.mock.calls.find((call) =>
    Array.isArray(call[2]),
  );
  const sendAction = promptCall?.[2].find(
    (action: { text: string }) => action.text === "Send stays",
  );
  expect(sendAction).toBeDefined();
  act(() => sendAction.onPress());
}

describe("TravelPlanTripTools auth integration", () => {
  beforeEach(() => {
    mockAlert.mockReset();
    mockGetStraiAwayStatus.mockReset().mockResolvedValue({ connected: true });
    mockPushStraiAwayStays.mockReset().mockResolvedValue({ pushed: 1 });
    mockRouterPush.mockReset();
    mockRecordPlanInteraction.mockReset();
    mockAuthUser = { email: "traveler@example.com" };
    mockGuestName = "";
  });

  it("uses the authenticated email when sending stays without a preferred name", async () => {
    render(<TravelPlanTripTools plan={plan} onAddTransport={jest.fn()} />);

    await openSendStaysPrompt();

    await waitFor(() =>
      expect(mockPushStraiAwayStays).toHaveBeenCalledWith([
        expect.objectContaining({ guestDisplayName: "traveler@example.com" }),
      ]),
    );
  });

  it("prefers the local profile name over the authenticated email", async () => {
    mockGuestName = "Alex Rivera";
    render(<TravelPlanTripTools plan={plan} onAddTransport={jest.fn()} />);

    await openSendStaysPrompt();

    await waitFor(() =>
      expect(mockPushStraiAwayStays).toHaveBeenCalledWith([
        expect.objectContaining({ guestDisplayName: "Alex Rivera" }),
      ]),
    );
  });

  it("routes disconnected accounts to StraiAway setup without sending data", async () => {
    mockGetStraiAwayStatus.mockResolvedValue({ connected: false });
    render(<TravelPlanTripTools plan={plan} onAddTransport={jest.fn()} />);

    fireEvent.press(screen.getByTestId("travel-action-straiaway"));

    await waitFor(() => {
      expect(mockRouterPush).toHaveBeenCalledWith("/(tabs)/profile/straiaway");
    });
    expect(mockAlert).not.toHaveBeenCalled();
    expect(mockPushStraiAwayStays).not.toHaveBeenCalled();
  });
});
