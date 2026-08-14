import { useEffect, useSyncExternalStore } from 'react';
import { Dimensions, Platform, StyleSheet, Text, View } from 'react-native';
import { FullWindowOverlay } from 'react-native-screens';

import { AgentUiOverlayToggle } from './AgentUiOverlayToggle';
import { AgentUiIds } from './ids';
import {
  agentUiOverlayShortLabel,
  isAgentUiFabVisible,
  isAgentUiOverlayEnabled,
  isAgentUiOverlayPaintTarget,
  subscribeAgentUiOverlay,
} from './overlay';
import {
  getAgentUiFramesEpoch,
  isAgentUiEnabled,
  listAgentUiTargets,
  remeasureAllAgentUiFrames,
  subscribeAgentUiFrames,
} from './registry';
import { getAgentUiRoute } from './route';
import { useAgentUiTarget } from './use-agent-ui-target';

/**
 * __DEV__ visual overlay: framed testIDs + a draggable toggle FAB.
 * Uses FullWindowOverlay on iOS so native-stack screens do not cover it.
 * Frame boxes are pointerEvents=none; the FAB is tappable/draggable.
 *
 * Android: use a plain View (not GestureHandlerRootView) for the absolute
 * layer — a nested full-screen GH root with box-none still eats touches under
 * the New Architecture. Gestures use the app-root GestureHandlerRootView.
 */
export function AgentUiOverlay() {
  const enabled = useSyncExternalStore(
    subscribeAgentUiOverlay,
    isAgentUiOverlayEnabled,
    () => false,
  );
  const fabVisible = useSyncExternalStore(
    subscribeAgentUiOverlay,
    isAgentUiFabVisible,
    () => false,
  );
  const framesEpoch = useSyncExternalStore(
    subscribeAgentUiFrames,
    getAgentUiFramesEpoch,
    () => 0,
  );
  const root = useAgentUiTarget(AgentUiIds.agentUi.overlayRoot, {
    label: enabled ? 'Agent UI overlay on' : 'Agent UI overlay',
  });

  useEffect(() => {
    if (!enabled) return;
    // Remeasure (not just re-read) — scroll moves window frames without onLayout.
    remeasureAllAgentUiFrames();
    const id = setInterval(() => {
      remeasureAllAgentUiFrames();
    }, 250);
    return () => clearInterval(id);
  }, [enabled]);

  if (!isAgentUiEnabled()) return null;

  void framesEpoch;
  const route = getAgentUiRoute() ?? '(unknown route)';
  const elements = enabled
    ? listAgentUiTargets().filter((entry) => {
        if (
          entry.testID === AgentUiIds.agentUi.overlayRoot ||
          entry.testID === AgentUiIds.agentUi.overlayToggle
        ) {
          return false;
        }
        if (!entry.frame || entry.frame.width <= 0 || entry.frame.height <= 0) {
          return false;
        }
        if (!isAgentUiOverlayPaintTarget(entry.testID, route)) return false;
        const { width: winW, height: winH } = Dimensions.get('window');
        const bottom = entry.frame.y + entry.frame.height;
        const right = entry.frame.x + entry.frame.width;
        if (bottom < 8 || right < 8 || entry.frame.y > winH - 8 || entry.frame.x > winW - 8) {
          return false;
        }
        return true;
      })
    : [];

  const probe = (
    <View
      ref={root.ref}
      collapsable={false}
      onLayout={root.onLayout}
      style={styles.hiddenProbe}
      testID={root.testID}
    />
  );

  // FullWindowOverlay is a native surface above the entire app. Even with a
  // box-none child it can intercept iOS touches, so never mount the host while
  // overlay paint is disabled.
  if (!enabled) return probe;

  const layer = (
    <View style={styles.layer} pointerEvents="box-none" collapsable={false}>
      {fabVisible ? (
        <AgentUiOverlayToggle enabled={enabled} idCount={elements.length} />
      ) : null}
      {elements.map((entry) => {
            const frame = entry.frame!;
            return (
              <View
                key={entry.testID}
                pointerEvents="none"
                style={[
                  styles.box,
                  entry.tappable ? styles.boxTappable : styles.boxAnchor,
                  {
                    left: frame.x,
                    top: frame.y,
                    width: Math.max(frame.width, 1),
                    height: Math.max(frame.height, 1),
                  },
                ]}>
                <Text style={styles.boxLabel} numberOfLines={1}>
                  {agentUiOverlayShortLabel(entry.testID)}
                </Text>
              </View>
            );
          })}
    </View>
  );

  return (
    <>
      {probe}
      {Platform.OS === 'ios' ? (
        <FullWindowOverlay>{layer}</FullWindowOverlay>
      ) : (
        layer
      )}
    </>
  );
}

const styles = StyleSheet.create({
  layer: {
    ...StyleSheet.absoluteFill,
  },
  hiddenProbe: {
    position: 'absolute',
    width: 1,
    height: 1,
    opacity: 0,
  },
  box: {
    position: 'absolute',
    borderWidth: 1.5,
    borderRadius: 4,
    overflow: 'hidden',
  },
  boxTappable: {
    borderColor: 'rgba(56, 189, 248, 0.95)',
    backgroundColor: 'rgba(56, 189, 248, 0.18)',
  },
  boxAnchor: {
    borderColor: 'rgba(250, 204, 21, 0.95)',
    backgroundColor: 'rgba(250, 204, 21, 0.16)',
  },
  boxLabel: {
    alignSelf: 'flex-start',
    maxWidth: '100%',
    paddingHorizontal: 3,
    paddingVertical: 1,
    backgroundColor: 'rgba(10, 18, 32, 0.88)',
    color: '#F4F7FB',
    fontSize: 9,
    fontFamily: 'System',
  },
});
