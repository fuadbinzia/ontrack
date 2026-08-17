import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PropsWithChildren,
} from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import Animated from 'react-native-reanimated';

import {
  listEntering,
  listExiting,
  listLayout,
  nextListEnterIds,
} from '@/design-system';

type PresenceProps = PropsWithChildren<{
  index?: number;
  /** Only true for items just added — page open / remount stays at rest. */
  enter?: boolean;
  style?: StyleProp<ViewStyle>;
}>;

/**
 * Layout reflow only after this view has painted once. LinearTransition on
 * first layout is the Instagram-vs-us glitch — items settle from 0.
 */
export function useSettledListLayout() {
  const [settled, setSettled] = useState(false);
  const frameRef = useRef<number | null>(null);
  useEffect(
    () => () => {
      if (frameRef.current != null) cancelAnimationFrame(frameRef.current);
    },
    [],
  );
  const onFirstLayout = useCallback(() => {
    if (frameRef.current != null) return;
    // Two frames: FlatList often corrects header/item Y on the pass after
    // the first onLayout. Enabling LinearTransition on that pass animates
    // existing rows from their previous place up to the top.
    frameRef.current = requestAnimationFrame(() => {
      frameRef.current = requestAnimationFrame(() => setSettled(true));
    });
  }, []);
  return {
    layout: settled ? listLayout() : undefined,
    onLayout: settled ? undefined : onFirstLayout,
  };
}

/** List/card mount: eased enter, exit, and neighbor reflow. */
export function Presence({
  index = 0,
  enter = false,
  style,
  children,
}: PresenceProps) {
  const { layout, onLayout } = useSettledListLayout();
  return (
    <Animated.View
      entering={enter ? listEntering(index) : undefined}
      exiting={listExiting()}
      layout={layout}
      onLayout={onLayout}
      style={style}
    >
      {children}
    </Animated.View>
  );
}

/** Enter ids that appeared after this list was first seen. */
export function useListEnterIds(
  listKey: string,
  ids: readonly string[],
): ReadonlySet<string> {
  const token = ids.join('\0');
  return useMemo(() => nextListEnterIds(listKey, ids), [listKey, token]);
}
