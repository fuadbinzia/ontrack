import { useCallback, useMemo } from 'react';
import { Dimensions, StyleSheet, Text } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';

import { Symbol } from '@/components/primitives';
import { formatCount } from '@/utils/grammar';

import { AgentUiIds } from './ids';
import { dismissAgentUiFab, toggleAgentUiOverlay } from './overlay';
import { useAgentUiTarget } from './use-agent-ui-target';

/** Match Travel Home add FAB — white circle, soft elevation, black mark. */
const BUTTON_SIZE = 48;
const EDGE_PAD = 10;
const INK = '#000000';
const SURFACE = '#FFFFFF';
const BORDER = 'rgba(0,0,0,0.08)';
const SHADOW = '0 8px 20px rgba(0,0,0,0.16)';

/** Session-persisted position so remounts / toggle state flips keep the FAB put. */
let savedLeft: number | null = null;
let savedTop: number | null = null;

function defaultPosition(): { left: number; top: number } {
  const { width, height } = Dimensions.get('window');
  // Bottom-right — keeps Travel Home’s header + clear; drag if needed.
  return {
    left: Math.max(EDGE_PAD, width - BUTTON_SIZE - EDGE_PAD - 16),
    top: Math.max(EDGE_PAD + 36, height - BUTTON_SIZE - EDGE_PAD - 96),
  };
}

function clampPosition(left: number, top: number): { left: number; top: number } {
  const { width, height } = Dimensions.get('window');
  const maxLeft = Math.max(EDGE_PAD, width - BUTTON_SIZE - EDGE_PAD);
  const maxTop = Math.max(EDGE_PAD, height - BUTTON_SIZE - EDGE_PAD - 24);
  return {
    left: Math.min(maxLeft, Math.max(EDGE_PAD, left)),
    top: Math.min(maxTop, Math.max(EDGE_PAD + 36, top)),
  };
}

type Props = {
  enabled: boolean;
  idCount: number;
};

/**
 * Compact draggable __DEV__ FAB — only mounted while overlay paint is on.
 * Tap turns overlay off; drag to move; long-press dismisses. Restore by turning
 * Overlay on in Diagnostics, agent-ui-overlay.sh, or a page long-press (Dev Mode).
 */
export function AgentUiOverlayToggle({ enabled, idCount }: Props) {
  const onToggle = useCallback(() => {
    toggleAgentUiOverlay();
  }, []);
  const onDismiss = useCallback(() => {
    dismissAgentUiFab();
  }, []);
  const target = useAgentUiTarget(AgentUiIds.agentUi.overlayToggle, {
    label: enabled
      ? `Hide agent UI overlay (${formatCount(idCount, 'target')})`
      : 'Show agent UI overlay',
    onPress: onToggle,
  });

  const start = useMemo(() => {
    if (savedLeft != null && savedTop != null) {
      return clampPosition(savedLeft, savedTop);
    }
    return defaultPosition();
  }, []);

  const left = useSharedValue(start.left);
  const top = useSharedValue(start.top);
  const dragOriginX = useSharedValue(start.left);
  const dragOriginY = useSharedValue(start.top);

  const persistPosition = useCallback((nextLeft: number, nextTop: number) => {
    const clamped = clampPosition(nextLeft, nextTop);
    savedLeft = clamped.left;
    savedTop = clamped.top;
    left.value = clamped.left;
    top.value = clamped.top;
  }, [left, top]);

  const pan = Gesture.Pan()
    .minDistance(6)
    .onStart(() => {
      dragOriginX.value = left.value;
      dragOriginY.value = top.value;
    })
    .onUpdate((event) => {
      left.value = dragOriginX.value + event.translationX;
      top.value = dragOriginY.value + event.translationY;
    })
    .onEnd(() => {
      runOnJS(persistPosition)(left.value, top.value);
    });

  const longPress = Gesture.LongPress()
    .minDuration(450)
    .onStart(() => {
      runOnJS(onDismiss)();
    });

  const tap = Gesture.Tap().onEnd(() => {
    runOnJS(onToggle)();
  });

  const gesture = Gesture.Exclusive(pan, longPress, tap);

  const animatedStyle = useAnimatedStyle(() => ({
    left: left.value,
    top: top.value,
  }));

  const countLabel = idCount > 99 ? '99+' : String(idCount);

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View
        ref={target.ref}
        collapsable={false}
        onLayout={target.onLayout}
        accessibilityRole="button"
        accessibilityLabel={
          enabled
            ? `Hide agent UI overlay (${formatCount(idCount, 'target')})`
            : 'Show agent UI overlay'
        }
        accessibilityHint="Drag to move. Long-press to hide. With Dev Mode on, long-press anywhere to show again."
        testID={target.testID}
        style={[styles.fab, enabled ? styles.fabOn : null, animatedStyle]}>
        {enabled ? (
          <Text style={styles.count} numberOfLines={1} allowFontScaling={false}>
            {countLabel}
          </Text>
        ) : (
          <Symbol name="gallery" size={22} color={INK} />
        )}
      </Animated.View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    zIndex: 1000,
    width: BUTTON_SIZE,
    height: BUTTON_SIZE,
    borderRadius: BUTTON_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: SURFACE,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: BORDER,
    boxShadow: SHADOW,
    shadowColor: '#000000',
    shadowOpacity: 0.16,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  fabOn: {
    borderColor: 'rgba(47,111,237,0.45)',
  },
  count: {
    color: INK,
    fontSize: 15,
    fontFamily: 'System',
    fontWeight: '600',
    includeFontPadding: false,
  },
});
