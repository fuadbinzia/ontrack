import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
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

import { TAB_META } from '@/components/navigation/bottom-nav-tab-meta';
import {
  NAV_PIN_LIMIT,
  NAV_PIN_MIN,
  splitTrackerOrder,
} from '@/components/navigation/tab-pins';
import {
  AppText,
  DragHandle,
  GlassIconWell,
  GlassPlate,
  Screen,
  ScreenHeader,
  Symbol,
} from '@/components/primitives';
import { radii, springs } from '@/design-system';
import { useResponsive } from '@/hooks/use-responsive';
import { useTheme } from '@/hooks/use-theme';
import { useAddons } from '@/store/addons';
import { useTabPins } from '@/store/tab-pins';
import { AgentTestId, AgentUiIds } from '@/utils/agent-ui';
import { haptics } from '@/utils/haptics';

/** Cap stagger so long catalogs still settle quickly. */
const ROW_ENTER_STAGGER_MS = 48;
const ROW_ENTER_STAGGER_MAX = 10;

type TrackerRow = {
  id: string;
  label: string;
  section: 'inNav' | 'others';
};

function isEnabled(
  routeName: string,
  enabledAddons: Record<string, boolean>,
): boolean {
  if (routeName === 'workouts') return !!enabledAddons.fitness;
  if (routeName === 'plants') return !!enabledAddons.plants;
  if (routeName === 'travel') return !!enabledAddons.travel;
  if (routeName === 'vision-board') return !!enabledAddons['vision-board'];
  if (routeName === 'games') return !!enabledAddons.games;
  if (routeName === 'vehicles') return !!enabledAddons.vehicles;
  if (routeName === 'food') return !!enabledAddons.food;
  if (routeName === 'health') {
    return process.env.EXPO_OS === 'ios' && !!enabledAddons.health;
  }
  return routeName in TAB_META && routeName !== 'trackers';
}

/**
 * Imperative spring bounce — layout `entering` is unreliable here (tab stays
 * mounted + DraggableFlatList/ScaleDecorator). Replay whenever `entranceKey` bumps.
 */
function TrackerRowBounce({
  index,
  entranceKey,
  isActive,
  children,
}: {
  index: number;
  entranceKey: number;
  isActive: boolean;
  children: ReactNode;
}) {
  const reduceMotion = useReducedMotion();
  const scale = useSharedValue(1);
  const translateY = useSharedValue(0);
  const opacity = useSharedValue(1);

  useEffect(() => {
    if (isActive) {
      cancelAnimation(scale);
      cancelAnimation(translateY);
      cancelAnimation(opacity);
      scale.value = 1;
      translateY.value = 0;
      opacity.value = 1;
      return;
    }
    if (entranceKey < 1) return;

    const delay = Math.min(index, ROW_ENTER_STAGGER_MAX) * ROW_ENTER_STAGGER_MS;
    if (reduceMotion) {
      scale.value = 1;
      translateY.value = 0;
      opacity.value = 1;
      return;
    }

    cancelAnimation(scale);
    cancelAnimation(translateY);
    cancelAnimation(opacity);
    scale.value = 0.82;
    translateY.value = 20;
    opacity.value = 0;
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
  }, [entranceKey, index, isActive, opacity, reduceMotion, scale, translateY]);

  const style = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }, { scale: scale.value }],
  }));

  return <Animated.View style={style}>{children}</Animated.View>;
}

export function TrackersScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { spacing, s, layout } = useResponsive();
  const enabledAddons = useAddons((store) => store.enabled);
  const trackerOrder = useTabPins((store) => store.trackerOrder);
  const pinnedCount = useTabPins((store) => store.pinnedCount);
  const setInNavOrder = useTabPins((store) => store.setInNavOrder);
  const addToNav = useTabPins((store) => store.addToNav);
  const [entranceKey, setEntranceKey] = useState(0);

  // Replay bounce every time Sections becomes focused (tab stays mounted).
  useFocusEffect(
    useCallback(() => {
      setEntranceKey((key) => key + 1);
    }, []),
  );

  const enabledNames = useMemo(() => {
    const names = new Set<string>();
    for (const name of Object.keys(TAB_META)) {
      if (!isEnabled(name, enabledAddons)) continue;
      names.add(name);
    }
    return names;
  }, [enabledAddons]);

  const { inNav, others } = useMemo(
    () => splitTrackerOrder(trackerOrder, enabledNames, pinnedCount),
    [enabledNames, pinnedCount, trackerOrder],
  );

  const listData = useMemo<TrackerRow[]>(() => {
    const rows: TrackerRow[] = [];
    for (const id of inNav) {
      const meta = TAB_META[id];
      if (!meta) continue;
      rows.push({
        id,
        label: id === 'vision-board' ? 'Vision Board' : meta.label,
        section: 'inNav',
      });
    }
    for (const id of others) {
      const meta = TAB_META[id];
      if (!meta) continue;
      rows.push({
        id,
        label: id === 'vision-board' ? 'Vision Board' : meta.label,
        section: 'others',
      });
    }
    return rows;
  }, [inNav, others]);

  const openTracker = (routeName: string) => {
    const meta = TAB_META[routeName];
    if (!meta) return;
    router.navigate(meta.href);
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
    const canAdd = item.section === 'others' && inNavCount < NAV_PIN_LIMIT;

    return (
      <ScaleDecorator activeScale={1.02}>
        <View
          style={{
            marginBottom: spacing.xs,
            marginTop:
              index === inNavCount && others.length > 0 ? spacing.md : 0,
          }}>
          {index === 0 ? (
            <AppText
              variant="overline"
              color="accent"
              style={{ marginBottom: spacing.xs, marginLeft: spacing.xxs }}>
              In nav · {inNavCount}/{NAV_PIN_LIMIT}
            </AppText>
          ) : null}
          {index === inNavCount && others.length > 0 ? (
            <AppText
              variant="overline"
              color="secondary"
              style={{ marginBottom: spacing.xs, marginLeft: spacing.xxs }}>
              More
            </AppText>
          ) : null}
          <TrackerRowBounce
            index={index}
            entranceKey={entranceKey}
            isActive={isActive}>
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
                onPress={() => openTracker(item.id)}
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
                    addToNav(item.id);
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
            keyExtractor={(item) => item.id}
            ListHeaderComponent={
              <View style={{ marginBottom: spacing.md }}>
                <ScreenHeader
                  title="Sections"
                  subtitle="Top items stay in the tab bar. Drag to reorder — More always stays last."
                />
              </View>
            }
            onDragBegin={() => haptics.heavy()}
            onDragEnd={({ data }) => {
              haptics.select();
              const pins = Math.min(
                Math.max(NAV_PIN_MIN, inNav.length),
                NAV_PIN_LIMIT,
                data.length,
              );
              setInNavOrder(
                data.slice(0, pins).map((row) => row.id),
                data.slice(pins).map((row) => row.id),
              );
            }}
            renderItem={renderItem}
          />
        </View>
      </AgentTestId>
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
