import { Tabs } from 'expo-router';
import type { ComponentProps } from 'react';
import { useLayoutEffect, useSyncExternalStore } from 'react';
import { StyleSheet, View } from 'react-native';

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

/** Mutate the snapshot only. Never call this from render if listeners must fire. */
export function writeBottomNavDockSnapshot(
  next: BottomNavDockProps | null,
): boolean {
  if (dockProps === next) return false;
  dockProps = next;
  return true;
}

export function notifyBottomNavDockListeners(): void {
  for (const listener of listeners) listener();
}

export function publishBottomNavDock(next: BottomNavDockProps | null): void {
  if (!writeBottomNavDockSnapshot(next)) return;
  notifyBottomNavDockListeners();
}

export function resetBottomNavDockForTests(): void {
  dockProps = null;
  listeners.clear();
}

export { peekBottomNavDock, subscribeBottomNavDock };

/**
 * In-tree tabBar unmount. ScreenContainer tears that slot down after scenes
 * paint — clearing the sibling store here hides the dock for the rest of
 * the session, so keep the last published props.
 */
export function onBottomNavBarBridgeUnmount(
  _published: BottomNavDockProps,
): void {}

/**
 * Writes the snapshot during render (so a later sibling Host getSnapshot
 * sees props in the same commit) but notifies after layout. Notifying
 * during render updates BottomNavDockHost mid-commit (React setState-in-render).
 */
export function BottomNavBarBridge(props: BottomNavDockProps) {
  const snapshotChanged = writeBottomNavDockSnapshot(props);
  useLayoutEffect(() => {
    if (snapshotChanged) notifyBottomNavDockListeners();
  }, [props, snapshotChanged]);
  return null;
}

/**
 * BottomTabView calls `tabBar(props)` as a render function, not as a
 * component. Passing `BottomNavBarBridge` directly therefore runs its hooks
 * outside a component (invalid hook call). Keep this wrapper module-scoped
 * so Tabs still gets a stable `tabBar` reference.
 */
export function renderBottomNavBar(props: BottomNavDockProps) {
  return <BottomNavBarBridge {...props} />;
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
