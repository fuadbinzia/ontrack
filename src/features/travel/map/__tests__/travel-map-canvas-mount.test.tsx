/**
 * Regression: tapping into a country crashed/froze the app with an RNGH v3
 * native assert — "Cannot have more than one child view when native gesture
 * handlers are attached to the detector" — because the country stage's
 * GestureDetector mounted mid-crossfade and the world stage's detector
 * unmounted after the held exit. Stage shells must stay mounted; only inner
 * country content may swap.
 */
import { act, render, screen } from '@testing-library/react-native';
import type { ComponentProps, ReactElement } from 'react';
import {
    GestureDetector,
    GestureHandlerRootView,
} from 'react-native-gesture-handler';

import { AgentUiIds } from '@/utils/agent-ui';

import { TravelMapCanvas } from '../travel-map-canvas';

jest.mock('@/hooks/use-performance-tier', () => ({
  usePerformanceTier: () => ({ allowsLoopMotion: false }),
  useLiveFxReady: () => false,
}));

jest.mock('@/hooks/use-app-activity', () => ({
  useRouteIsActive: () => true,
  useAppIsActive: () => true,
}));

const wrapper = ({ children }: { children: ReactElement }) => (
  <GestureHandlerRootView>{children}</GestureHandlerRootView>
);

const renderCanvas = (props: ComponentProps<typeof TravelMapCanvas>) =>
  render(<TravelMapCanvas {...props} />, { wrapper });

const baseProps = {
  renderedVisits: [],
  onCountryPress: jest.fn(),
  onPlacePress: jest.fn(),
  onCoordinatePress: jest.fn(),
};

const detectorCount = () =>
  screen.UNSAFE_queryAllByType(GestureDetector).length;

const settleAnimations = () => {
  const reanimatedMock = jest.requireMock('react-native-reanimated') as {
    __flushAnimationCallbacks: () => void;
  };
  act(() => reanimatedMock.__flushAnimationCallbacks());
};

describe('travel map canvas country dive mount', () => {

  it('renders the world globe at rest with both stage shells mounted', () => {
    renderCanvas(baseProps);
    expect(screen.getByTestId(AgentUiIds.travel.map.globe)).toBeTruthy();
    // Globe detector + permanent country stage shell detector.
    expect(detectorCount()).toBe(2);
  });

  it('dives into a country without mounting or unmounting a gesture detector', () => {
    const view = renderCanvas(baseProps);
    const detectorsAtRest = detectorCount();

    view.rerender(<TravelMapCanvas {...baseProps} selectedCountryCode="FR" />);
    expect(screen.getByTestId(AgentUiIds.travel.map.pinMapTarget)).toBeTruthy();
    expect(detectorCount()).toBe(detectorsAtRest);

    // World layer is held (pointer-blind + display-culled), never unmounted.
    settleAnimations();
    expect(screen.getByTestId(AgentUiIds.travel.map.globe)).toBeTruthy();
    expect(detectorCount()).toBe(detectorsAtRest);
  });

  it('returns to the world stage keeping detector count constant', () => {
    const view = renderCanvas({ ...baseProps, selectedCountryCode: 'FR' });
    const detectorsInCountry = detectorCount();

    view.rerender(<TravelMapCanvas {...baseProps} />);
    expect(detectorCount()).toBe(detectorsInCountry);

    // Country content clears after the exit settles; the shell remains.
    settleAnimations();
    expect(screen.queryByTestId(AgentUiIds.travel.map.pinMapTarget)).toBeNull();
    expect(detectorCount()).toBe(detectorsInCountry);
    expect(screen.getByTestId(AgentUiIds.travel.map.globe)).toBeTruthy();
  });

  it('re-enters a second country after returning without detector churn', () => {
    const view = renderCanvas(baseProps);
    const detectorsAtRest = detectorCount();

    view.rerender(<TravelMapCanvas {...baseProps} selectedCountryCode="FR" />);
    settleAnimations();
    view.rerender(<TravelMapCanvas {...baseProps} />);
    settleAnimations();
    view.rerender(<TravelMapCanvas {...baseProps} selectedCountryCode="JP" />);
    settleAnimations();

    expect(screen.getByTestId(AgentUiIds.travel.map.pinMapTarget)).toBeTruthy();
    expect(detectorCount()).toBe(detectorsAtRest);
  });
});
