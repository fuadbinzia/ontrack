import { scrollAgentUiTargetIntoView } from '../scroll-into-view';
import {
  getAgentUiTarget,
  registerAgentUiTarget,
  resetAgentUiRegistry,
} from '../registry';
import {
  registerAgentUiScrollContainer,
  resetAgentUiScrollContainer,
} from '../scroll-container';

jest.mock('expo-file-system', () => ({
  Paths: { document: 'file:///documents' },
  File: jest.fn().mockImplementation(() => ({
    exists: false,
    create: jest.fn(),
    write: jest.fn(),
  })),
}));

describe('scrollAgentUiTargetIntoView', () => {
  beforeEach(() => {
    resetAgentUiRegistry();
    resetAgentUiScrollContainer();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('returns quickly when a hung measureInWindow would otherwise block', async () => {
    const scrollTo = jest.fn();
    registerAgentUiScrollContainer({
      scrollView: { scrollTo } as never,
      getOffsetY: () => 0,
      measureInWindow: (cb) => cb(0, 100, 400, 600),
    });

    // Target is below the padded viewport → needs a scroll.
    registerAgentUiTarget('ontrack.travel.timelineItem.demo.pickup', {
      label: 'Pick Up Car',
      frame: { x: 60, y: 900, width: 300, height: 22 },
      node: {
        measureInWindow: (cb: (x: number, y: number, w: number, h: number) => void) => {
          cb(60, 900, 300, 22);
        },
      } as never,
      press: jest.fn(),
    });

    // A second registered node that never calls back — previously Promise.all
    // on full registry refresh hung the scroll op until the host timed out.
    registerAgentUiTarget('ontrack.stuck.measure', {
      label: 'Stuck',
      frame: { x: 0, y: 0, width: 10, height: 10 },
      node: {
        measureInWindow: () => {
          /* never invokes callback */
        },
      } as never,
    });

    const promise = scrollAgentUiTargetIntoView(
      'ontrack.travel.timelineItem.demo.pickup',
    );
    await jest.runAllTimersAsync();
    await expect(promise).resolves.toBe(true);
    expect(scrollTo).toHaveBeenCalled();
    expect(getAgentUiTarget('ontrack.travel.timelineItem.demo.pickup')?.frame).toEqual({
      x: 60,
      y: 900,
      width: 300,
      height: 22,
    });
  });

  it('returns false when measureInWindow never resolves for the target', async () => {
    registerAgentUiScrollContainer({
      scrollView: { scrollTo: jest.fn() } as never,
      getOffsetY: () => 0,
      measureInWindow: (cb) => cb(0, 100, 400, 600),
    });
    registerAgentUiTarget('ontrack.hung.target', {
      node: {
        measureInWindow: () => {
          /* never invokes callback */
        },
      } as never,
    });

    const promise = scrollAgentUiTargetIntoView('ontrack.hung.target');
    await jest.runAllTimersAsync();
    await expect(promise).resolves.toBe(false);
  });

  it('scrolls farther when the tab dock covers the bottom of the viewport', async () => {
    const scrollTo = jest.fn();
    registerAgentUiScrollContainer({
      scrollView: { scrollTo } as never,
      getOffsetY: () => 0,
      // Full-screen viewport (absolute dock overlays the bottom).
      measureInWindow: (cb) => cb(0, 0, 384, 832),
    });
    registerAgentUiTarget('ontrack.tabs.dock', {
      frame: { x: 0, y: 750, width: 384, height: 82 },
      node: {
        measureInWindow: (cb: (x: number, y: number, w: number, h: number) => void) => {
          cb(0, 750, 384, 82);
        },
      } as never,
    });
    // Target sits in the dock frost zone — must clear dock.y - EDGE_PAD.
    registerAgentUiTarget('ontrack.profile.section.features', {
      frame: { x: 20, y: 764, width: 344, height: 44 },
      node: {
        measureInWindow: (cb: (x: number, y: number, w: number, h: number) => void) => {
          cb(20, 764, 344, 44);
        },
      } as never,
    });

    const promise = scrollAgentUiTargetIntoView('ontrack.profile.section.features');
    await jest.runAllTimersAsync();
    await expect(promise).resolves.toBe(true);
    expect(scrollTo).toHaveBeenCalledWith({ y: expect.any(Number), animated: false });
    const y = scrollTo.mock.calls[0][0].y as number;
    // Without dock awareness: 764+44 - (832-24) = 0. With dock: clear above 750-24.
    expect(y).toBeGreaterThan(50);
  });
});
