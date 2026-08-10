import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import DraggableFlatList, {
    ScaleDecorator,
    type RenderItemParams,
} from 'react-native-draggable-flatlist';

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
import { radii } from '@/design-system';
import { useResponsive } from '@/hooks/use-responsive';
import { useTheme } from '@/hooks/use-theme';
import { useAddons } from '@/store/addons';
import { useTabPins } from '@/store/tab-pins';
import { AgentTestId, AgentUiIds } from '@/utils/agent-ui';
import { haptics } from '@/utils/haptics';

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

export function TrackersScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { spacing, s, layout } = useResponsive();
  const enabledAddons = useAddons((store) => store.enabled);
  const trackerOrder = useTabPins((store) => store.trackerOrder);
  const pinnedCount = useTabPins((store) => store.pinnedCount);
  const setInNavOrder = useTabPins((store) => store.setInNavOrder);
  const addToNav = useTabPins((store) => store.addToNav);

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
        </View>
      </ScaleDecorator>
    );
  };

  return (
    <Screen scroll={false} bottomInset contentStyle={styles.screenContent}>
      <AgentTestId
        testID={AgentUiIds.trackers.screen}
        label="Trackers"
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
              <View style={{ marginBottom: spacing.sm }}>
                <ScreenHeader
                  title="Trackers"
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
