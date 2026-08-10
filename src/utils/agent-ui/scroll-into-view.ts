import type { View } from 'react-native';

import {
  getAgentUiTargetNode,
  isAgentUiEnabled,
  registerAgentUiTarget,
  remeasureAllAgentUiFrames,
} from './registry';
import { getAgentUiScrollContainer } from './scroll-container';

const EDGE_PAD = 24;
const SETTLE_MS = 48;
/** Android can drop measureInWindow callbacks; never block the host op on them. */
const MEASURE_TIMEOUT_MS = 250;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function measureInWindow(
  view: Pick<View, 'measureInWindow'>,
  timeoutMs: number = MEASURE_TIMEOUT_MS,
): Promise<{ x: number; y: number; width: number; height: number } | null> {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (
      value: { x: number; y: number; width: number; height: number } | null,
    ) => {
      if (settled) return;
      settled = true;
      resolve(value);
    };
    const timer = setTimeout(() => finish(null), timeoutMs);
    try {
      view.measureInWindow((x, y, width, height) => {
        clearTimeout(timer);
        if (
          ![x, y, width, height].every(
            (n) => typeof n === 'number' && Number.isFinite(n),
          )
        ) {
          finish(null);
          return;
        }
        finish({ x, y, width, height });
      });
    } catch {
      clearTimeout(timer);
      finish(null);
    }
  });
}

/**
 * Scroll the active Screen ScrollView so `testID` is in view.
 * Purely in-app — never uses host mouse / Simulator window coordinates.
 *
 * Visible bottom respects the absolute tab dock when registered — otherwise
 * targets land under translucent glass (e.g. Profile "Features" frosting
 * through the Profile tab on Android).
 */
export async function scrollAgentUiTargetIntoView(testID: string): Promise<boolean> {
  if (!isAgentUiEnabled() || !testID) return false;

  const node = getAgentUiTargetNode(testID);
  const scroll = getAgentUiScrollContainer();
  if (!node || !scroll) return false;

  const target = await measureInWindow(node);
  const viewport = await measureInWindow({
    measureInWindow: (cb) => scroll.measureInWindow(cb),
  });
  if (!target || !viewport) return false;

  const dockNode = getAgentUiTargetNode('ontrack.tabs.dock');
  const dock = dockNode ? await measureInWindow(dockNode) : null;
  const viewportBottom = viewport.y + viewport.height;
  const clearBottom =
    dock && dock.height > 0 ? Math.min(viewportBottom, dock.y) : viewportBottom;

  const visibleTop = viewport.y + EDGE_PAD;
  const visibleBottom = clearBottom - EDGE_PAD;
  const targetTop = target.y;
  const targetBottom = target.y + target.height;

  let delta = 0;
  if (targetBottom > visibleBottom) {
    delta = targetBottom - visibleBottom;
  } else if (targetTop < visibleTop) {
    delta = targetTop - visibleTop;
  }

  if (Math.abs(delta) >= 1) {
    const nextY = Math.max(0, scroll.getOffsetY() + delta);
    scroll.scrollView.scrollTo({ y: nextY, animated: false });
    await sleep(SETTLE_MS);
  }

  // Remeasure only the target for an updated frame; full registry refresh is
  // fire-and-forget so a stuck Android measure callback cannot hang the op.
  const after = await measureInWindow(node);
  if (after) registerAgentUiTarget(testID, { frame: after });
  remeasureAllAgentUiFrames();
  return true;
}
