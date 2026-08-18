import { useNavigation } from 'expo-router';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import DraggableFlatList, {
  ScaleDecorator,
  type RenderItemParams,
} from 'react-native-draggable-flatlist';
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import {
  TAB_META,
  trackerCatalogLabel,
} from '@/components/navigation/bottom-nav-tab-meta';
import {
  clampPinnedCount,
  NAV_DOCK_EXTRA_COUNTS,
  NAV_PIN_LIMIT,
  navDockExtraCount,
  pinCountFromDockExtras,
  type NavDockExtraCount,
} from '@/components/navigation/tab-pins';
import {
  ActionChipRow,
  AppText,
  DragHandle,
  GlassIconWell,
  GlassPlate,
  Screen,
  ScreenHeader,
  Symbol,
} from '@/components/primitives';
import { radii, springs } from '@/design-system';
import {
  trackerRowDragPose,
  trackerRowEnterDelay,
  trackerRowMountPose,
} from '@/features/trackers/tracker-row-entrance';
import { useResponsive } from '@/hooks/use-responsive';
import { useTheme } from '@/hooks/use-theme';
import { TrackersManageSheet } from '@/features/trackers/trackers-manage-sheet';
import { moreListRoutes } from '@/features/trackers/tracker-presence';
import { useAddons } from '@/store/addons';
import { useTabPins } from '@/store/tab-pins';
import { AgentTestId, AgentUiIds } from '@/utils/agent-ui';
import { haptics } from '@/utils/haptics';

type TrackerRow = {
  id: string;
  label: string;
  section: 'inNav' | 'others';
};

/**
 * Imperative spring bounce — layout `entering` is unreliable here
 * (DraggableFlatList/ScaleDecorator). First paint is rest; bounce only
 * the first mount, never on tab land.
 */
function TrackerRowBounce({
  index,
  isActive,
  children,
}: {
  index: number;
  isActive: boolean;
  children: ReactNode;
}) {
  const reduceMotion = useReducedMotion();
  const mount = trackerRowMountPose(reduceMotion);
  const played = useRef(false);
  const scale = useSharedValue(mount.scale);
  const translateY = useSharedValue(mount.translateY);
  const opacity = useSharedValue(mount.opacity);

  useEffect(() => {
    if (played.current) return;
    played.current = true;
    if (reduceMotion) return;
    const delay = trackerRowEnterDelay(index);
    scale.value = withDelay(
      delay,
      withSpring(1, {
        damping: 9,
        stiffness: 280,
        mass: 0.7,
      }),
    );
    translateY.value = withDelay(
      delay,
      withSpring(0, {
        damping: springs.bouncy.damping,
        stiffness: springs.bouncy.stiffness,
        mass: springs.bouncy.mass,
      }),
    );
    opacity.value = withDelay(delay, withTiming(1, { duration: 140 }));
  }, [index, opacity, reduceMotion, scale, translateY]);

  useEffect(() => {
    if (!isActive) return;
    const rest = trackerRowDragPose();
    cancelAnimation(scale);
    cancelAnimation(translateY);
    cancelAnimation(opacity);
    scale.value = rest.scale;
    translateY.value = rest.translateY;
    opacity.value = rest.opacity;
  }, [isActive, opacity, scale, translateY]);

  const style = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }, { scale: scale.value }],
  }));

  return <Animated.View style={style}>{children}</Animated.View>;
}

export function TrackersScreen() {
  const theme = useTheme();
  const navigation = useNavigation();
  const { spacing, s, layout } = useResponsive();
  const enabledAddons = useAddons((store) => store.enabled);
  const trackerOrder = useTabPins((store) => store.trackerOrder);
  const pinnedCount = useTabPins((store) => store.pinnedCount);
  const setInNavOrder = useTabPins((store) => store.setInNavOrder);
  const setTrackerOrder = useTabPins((store) => store.setTrackerOrder);
  const promoteInMore = useTabPins((store) => store.promoteInMore);
  const [manageOpen, setManageOpen] = useState(false);

  const { inNav, others: visibleOthers } = useMemo(
    () => moreListRoutes(trackerOrder, enabledAddons, pinnedCount),
    [enabledAddons, pinnedCount, trackerOrder],
  );

  const listData = useMemo<TrackerRow[]>(() => {
    const rows: TrackerRow[] = [];
    for (const id of inNav) {
      const meta = TAB_META[id];
      if (!meta) continue;
      rows.push({
        id,
        label: trackerCatalogLabel(id),
        section: 'inNav',
      });
    }
    for (const id of visibleOthers) {
      const meta = TAB_META[id];
      if (!meta) continue;
      rows.push({
        id,
        label: trackerCatalogLabel(id),
        section: 'others',
      });
    }
    return rows;
  }, [inNav, visibleOthers]);

  const catalogSize = inNav.length + visibleOthers.length;
  const dockExtras = navDockExtraCount(
    clampPinnedCount(pinnedCount, catalogSize),
  );
  const canUseFiveIcons = catalogSize >= NAV_PIN_LIMIT;

  const setDockExtras = (extras: NavDockExtraCount) => {
    if (extras === 5 && !canUseFiveIcons) return;
    setTrackerOrder(trackerOrder, pinCountFromDockExtras(extras));
  };

  const openTracker = (routeName: string, section: TrackerRow['section']) => {
    const meta = TAB_META[routeName];
    if (!meta) return;
    if (section === 'others') {
      promoteInMore(routeName);
    }
    // This screen is a direct child of Tabs, so switch through that navigator.
    // URL navigation can focus the destination while leaving this translucent
    // catalog scene attached above it.
    navigation.navigate(routeName as never);
  };

  const renderItem = ({
    item,
    drag,
    getIndex,
    isActive,
  }: RenderItemParams<TrackerRow>) => {
    const index = getIndex() ?? 0;
    const meta = TAB_META[item.id];
    if (!meta) return null;
    const inNavCount = inNav.length;
    const catalogSize = inNavCount + visibleOthers.length;
    const canAdd =
      item.section === 'others' &&
      inNavCount < NAV_PIN_LIMIT &&
      catalogSize >= NAV_PIN_LIMIT;

    return (
      <ScaleDecorator activeScale={1.02}>
        <View
          style={{
            marginBottom: spacing.xs,
            marginTop:
              index === inNavCount && visibleOthers.length > 0 ? spacing.md : 0,
          }}>
          {index === 0 ? (
            <AppText
              variant="overline"
              color="accent"
              style={{ marginBottom: spacing.xs, marginLeft: spacing.xxs }}>
              In nav · {inNavCount}/{NAV_PIN_LIMIT}
            </AppText>
          ) : null}
          {index === inNavCount && visibleOthers.length > 0 ? (
            <AppText
              variant="overline"
              color="secondary"
              style={{ marginBottom: spacing.xs, marginLeft: spacing.xxs }}>
              More
            </AppText>
          ) : null}
          <TrackerRowBounce index={index} isActive={isActive}>
            <GlassPlate
              style={[
                styles.row,
                {
                  minHeight: layout.minTapTarget,
                  paddingHorizontal: spacing.sm,
                  paddingVertical: spacing.xs,
                  gap: spacing.sm,
                  borderRadius: radii.lg,
                  opacity: isActive ? 0.92 : 1,
                },
              ]}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Open ${item.label}`}
                testID={AgentUiIds.trackers.row(item.id)}
                onPress={() => openTracker(item.id, item.section)}
                style={styles.rowMain}>
                <GlassIconWell size={s(36)} borderRadius={radii.md}>
                  <Symbol
                    name={meta.icon}
                    size={s(18)}
                    color={theme.textPrimary}
                  />
                </GlassIconWell>
                <AppText
                  variant="callout"
                  fit
                  style={styles.rowLabel}
                  numberOfLines={1}>
                  {item.label}
                </AppText>
              </Pressable>
              {canAdd ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Add ${item.label} to nav`}
                  testID={AgentUiIds.trackers.add(item.id)}
                  hitSlop={8}
                  onPress={() => {
                    haptics.select();
                    const remaining = visibleOthers.filter((id) => id !== item.id);
                    const nextInNav = [...inNav, item.id, ...remaining].slice(
                      0,
                      NAV_PIN_LIMIT,
                    );
                    const pinned = new Set(nextInNav);
                    setInNavOrder(
                      nextInNav,
                      remaining.filter((id) => !pinned.has(id)),
                    );
                  }}
                  style={styles.sideAction}>
                  <AppText variant="caption" color="accent" fit>
                    Add
                  </AppText>
                </Pressable>
              ) : null}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Drag to reorder ${item.label}`}
                testID={AgentUiIds.trackers.drag(item.id)}
                delayLongPress={160}
                onLongPress={() => {
                  haptics.heavy();
                  drag();
                }}
                hitSlop={8}
                style={styles.sideAction}>
                <DragHandle size={s(20)} color={theme.textSecondary} />
              </Pressable>
            </GlassPlate>
          </TrackerRowBounce>
        </View>
      </ScaleDecorator>
    );
  };

  return (
    <Screen scroll={false} bottomInset contentStyle={styles.screenContent}>
      <AgentTestId
        testID={AgentUiIds.trackers.screen}
        label="Sections"
        style={styles.fill}>
        <View style={styles.content}>
          <DraggableFlatList
            activationDistance={10}
            containerStyle={styles.list}
            contentContainerStyle={{
              paddingBottom: spacing.xl,
            }}
            data={listData}
            showsHorizontalScrollIndicator={false}
            showsVerticalScrollIndicator={false}
            keyExtractor={(item) => item.id}
            ListHeaderComponent={
              <View style={{ marginBottom: spacing.md }}>
                <ScreenHeader
                  title="Sections"
                  subtitle="Top items stay in the navigation bar. Drag to reorder."
                  titleTrailing={
                    <AgentTestId
                      testID={AgentUiIds.trackers.manage}
                      label="Manage Sections"
                      onPress={() => setManageOpen(true)}
                    >
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel="Manage Sections"
                        onPress={() => setManageOpen(true)}
                        hitSlop={8}
                        style={styles.sideAction}
                      >
                        <AppText variant="callout" color="accent" fit>
                          Manage
                        </AppText>
                      </Pressable>
                    </AgentTestId>
                  }
                />
                <View style={{ marginTop: spacing.md }}>
                  <AgentTestId
                    testID={AgentUiIds.trackers.pinCountSection}
                    label="Dock Icons">
                    <AppText
                      variant="overline"
                      color="secondary"
                      style={{
                        marginBottom: spacing.xs,
                        marginLeft: spacing.xxs,
                      }}>
                      Dock Icons
                    </AppText>
                    <ActionChipRow
                      items={NAV_DOCK_EXTRA_COUNTS.filter(
                        (extras) => extras === 3 || canUseFiveIcons,
                      ).map((extras) => ({
                        id: String(extras),
                        label: `${extras} Icons`,
                        selected: dockExtras === extras,
                        testID: AgentUiIds.trackers.pinCount(extras),
                        onPress: () => setDockExtras(extras),
                      }))}
                    />
                  </AgentTestId>
                </View>
              </View>
            }
            onDragBegin={() => haptics.heavy()}
            onDragEnd={({ data }) => {
              haptics.select();
              const pins = clampPinnedCount(inNav.length, data.length);
              setInNavOrder(
                data.slice(0, pins).map((row) => row.id),
                data.slice(pins).map((row) => row.id),
              );
            }}
            renderItem={renderItem}
          />
        </View>
      </AgentTestId>
      <TrackersManageSheet
        visible={manageOpen}
        onClose={() => setManageOpen(false)}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  screenContent: { flex: 1 },
  fill: { flex: 1 },
  content: { flex: 1, minWidth: 0 },
  list: { flex: 1 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    overflow: 'hidden',
  },
  rowMain: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  rowLabel: {
    flex: 1,
    minWidth: 0,
  },
  sideAction: {
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
