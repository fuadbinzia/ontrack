/**
 * Regression: rotating portrait ↔ landscape hard-swapped the globe for the
 * flat world map — a visual pop, and a GestureDetector (the globe's) mounting
 * or unmounting mid-rotation, the same RNGH v3 churn that froze country dives.
 * Both world variants stay mounted once created; rotation only crossfades
 * them. The hidden flat world defers off the screen-open critical path but
 * must appear instantly when a rotation demands it.
 */
import { act, render, screen } from '@testing-library/react-native';
import type { ComponentProps, ReactElement } from 'react';
import { Dimensions } from 'react-native';
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

/** Fires the deferAfterPageTransition timer that mounts the idle flat world. */
const settleIdleMounts = () => act(() => jest.advanceTimersByTime(300));

/** Emits a real Dimensions change so every useWindowDimensions consumer updates. */
const setWindow = (width: number, height: number) => {
  const metrics = { width, height, scale: 2, fontScale: 2 };
  act(() => {
    Dimensions.set({ window: metrics, screen: metrics });
  });
};

const rotateToLandscape = () => setWindow(1334, 750);
const rotateToPortrait = () => setWindow(750, 1334);

beforeEach(() => {
  jest.useFakeTimers();
});

afterEach(() => {
  rotateToPortrait();
  jest.useRealTimers();
});

describe('travel map orientation rotation', () => {
  it('opens with the globe only, then mounts the flat world off the critical path', () => {
    renderCanvas(baseProps);

    expect(screen.getByTestId(AgentUiIds.travel.map.globe)).toBeTruthy();
    // Deferred: the hidden flat world must not slow the map open.
    expect(screen.queryByTestId(AgentUiIds.travel.map.flatWorld)).toBeNull();
    // Globe detector + permanent country stage shell detector.
    expect(detectorCount()).toBe(2);

    settleIdleMounts();
    expect(screen.getByTestId(AgentUiIds.travel.map.flatWorld)).toBeTruthy();
    expect(detectorCount()).toBe(2);
  });

  it('mounts the flat world immediately when rotation beats the idle defer', () => {
    renderCanvas(baseProps);
    const detectorsAtRest = detectorCount();

    rotateToLandscape();
    expect(screen.getByTestId(AgentUiIds.travel.map.flatWorld)).toBeTruthy();
    expect(detectorCount()).toBe(detectorsAtRest);
  });

  it('rotates to landscape and back without detector churn or unmounts', () => {
    renderCanvas(baseProps);
    settleIdleMounts();
    const detectorsAtRest = detectorCount();

    rotateToLandscape();
    expect(screen.getByTestId(AgentUiIds.travel.map.flatWorld)).toBeTruthy();
    // The globe is held (fading, display-culled at rest) — never unmounted.
    expect(screen.getByTestId(AgentUiIds.travel.map.globe)).toBeTruthy();
    expect(detectorCount()).toBe(detectorsAtRest);

    settleAnimations();
    expect(detectorCount()).toBe(detectorsAtRest);

    rotateToPortrait();
    settleAnimations();
    expect(screen.getByTestId(AgentUiIds.travel.map.globe)).toBeTruthy();
    // Once created, the flat world stays mounted for the next rotation.
    expect(screen.getByTestId(AgentUiIds.travel.map.flatWorld)).toBeTruthy();
    expect(detectorCount()).toBe(detectorsAtRest);
  });

  it('keeps an open country stage stable across a rotation round trip', () => {
    renderCanvas({ ...baseProps, selectedCountryCode: 'FR' });
    settleAnimations();
    const detectorsInCountry = detectorCount();

    rotateToLandscape();
    expect(screen.getByTestId(AgentUiIds.travel.map.pinMapTarget)).toBeTruthy();
    expect(detectorCount()).toBe(detectorsInCountry);

    rotateToPortrait();
    settleAnimations();
    expect(screen.getByTestId(AgentUiIds.travel.map.pinMapTarget)).toBeTruthy();
    expect(detectorCount()).toBe(detectorsInCountry);
  });
});
