import { fireEvent, render, screen } from '@testing-library/react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import FriendInviteRoute from '@/app/f/[code]';
import { AgentUiIds } from '@/utils/agent-ui';

const METRICS = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 59, left: 0, right: 0, bottom: 34 },
};

const mockPush = jest.fn();
let mockIsGuest = false;
let mockUser: { id: string } | null = null;

jest.mock('expo-router', () => ({
  useFocusEffect: (effect: () => void | (() => void)) => effect(),
  useLocalSearchParams: () => ({ code: 'Friend-Code' }),
  useRouter: () => ({ push: mockPush, replace: jest.fn() }),
}));

jest.mock('@/features/auth/auth-provider', () => ({
  useAuthSession: () => ({ user: mockUser, isGuest: mockIsGuest }),
}));

jest.mock('@/services/friends', () => ({
  acceptFriendInviteLink: jest.fn(),
  resolveFriendInviteLink: jest.fn(),
}));

jest.mock('@/store/friends', () => ({
  useFriends: (selector: (state: { refresh: jest.Mock }) => unknown) =>
    selector({ refresh: jest.fn() }),
}));

function renderRoute() {
  return render(
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider initialMetrics={METRICS}>
        <FriendInviteRoute />
      </SafeAreaProvider>
    </GestureHandlerRootView>,
  );
}

describe('FriendInviteRoute sign-in navigation', () => {
  beforeEach(() => {
    mockPush.mockClear();
    mockIsGuest = false;
    mockUser = null;
  });

  it('opens the public sign-in route for a fully signed-out invite visitor', () => {
    renderRoute();

    expect(screen.getByText('onTrack')).toBeTruthy();
    expect(screen.getByText('A Friend')).toBeTruthy();
    expect(screen.getByText('Your Social Circle')).toBeTruthy();
    expect(
      screen.getByTestId(AgentUiIds.social.friendInvite.section.card),
    ).toBeTruthy();

    fireEvent.press(screen.getByTestId(AgentUiIds.social.friendInvite.signIn));

    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/welcome',
      params: { returnTo: '/f/friend-code' },
    });
  });

  it('opens account upgrade for a guest and preserves the invite route', () => {
    mockIsGuest = true;
    renderRoute();

    fireEvent.press(screen.getByTestId(AgentUiIds.social.friendInvite.signIn));

    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/account',
      params: { returnTo: '/f/friend-code' },
    });
  });
});
