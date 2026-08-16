import type { ComponentProps } from 'react';
import { useLayoutEffect, useSyncExternalStore } from 'react';
import { StyleSheet, View } from 'react-native';
import { Tabs } from 'expo-router';

import { BottomNavBar } from './bottom-nav-bar';
import { BOTTOM_NAV_Z_INDEX } from './bottom-nav-inset';

type BottomNavDockProps = Parameters<
  NonNullable<ComponentProps<typeof Tabs>['tabBar']>
>[0];

let dockProps: BottomNavDockProps | null = null;
const listeners = new Set<() => void>();

function subscribeBottomNavDock(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function peekBottomNavDock(): BottomNavDockProps | null {
  return dockProps;
}

export function publishBottomNavDock(next: BottomNavDockProps | null): void {
  if (dockProps === next) return;
  dockProps = next;
  for (const listener of listeners) listener();
}

export function resetBottomNavDockForTests(): void {
  dockProps = null;
  listeners.clear();
}

export { peekBottomNavDock, subscribeBottomNavDock };

/**
 * Navigator tabBar slot. Must render nothing inside BottomTabView —
 * ScreenContainer is a native sibling that paints over an in-tree dock
 * once tab scenes load (bar flashes, then stays gone).
 */
export function BottomNavBarBridge(props: BottomNavDockProps) {
  useLayoutEffect(() => {
    publishBottomNavDock(props);
    return () => {
      if (dockProps === props) publishBottomNavDock(null);
    };
  }, [props]);
  return null;
}

/** Sibling of `<Tabs>` — stacks above ScreenContainer, not inside it. */
export function BottomNavDockHost() {
  const props = useSyncExternalStore(
    subscribeBottomNavDock,
    peekBottomNavDock,
    peekBottomNavDock,
  );
  if (!props) return null;
  return (
    <View
      pointerEvents="box-none"
      collapsable={false}
      style={styles.host}
    >
      <BottomNavBar {...props} />
    </View>
  );
}

const styles = StyleSheet.create({
  host: {
    ...StyleSheet.absoluteFill,
    zIndex: BOTTOM_NAV_Z_INDEX,
    elevation: BOTTOM_NAV_Z_INDEX,
  },
});
