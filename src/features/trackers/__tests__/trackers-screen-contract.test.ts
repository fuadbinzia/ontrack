import fs from 'fs';
import path from 'path';

const ROOT = path.resolve(__dirname, '../../../..');

function read(rel: string): string {
  return fs.readFileSync(path.join(ROOT, rel), 'utf8');
}

describe('trackers screen contract', () => {
  it('keeps Sections chrome on glass with agent-ui stamps', () => {
    const screen = read('src/features/trackers/trackers-screen.tsx');
    const route = read('src/app/(tabs)/trackers.tsx');
    expect(route).toContain('TrackersScreen');
    expect(screen).toContain('GlassPlate');
    expect(screen).toContain('GlassIconWell');
    expect(screen).toContain('AgentUiIds');
    expect(screen).not.toContain('surface="solid"');
    expect(screen).not.toContain('backgroundElevated');
    expect(screen).toContain('moreListRoutes');
    expect(screen).toContain('NAV_PIN_LIMIT');
    expect(screen).not.toContain('useVisibleMoreRoutes');
    expect(screen).not.toContain('use-tracker-presence');
    expect(screen).toContain('TrackersManageSheet');
    expect(screen).toContain('AgentUiIds.trackers.manage');
    expect(screen).toContain('scroll={false}');
    expect(screen).toContain('showsVerticalScrollIndicator={false}');
    expect(screen).toContain('showsHorizontalScrollIndicator={false}');
  });

  it('hides the Sections drag-list scroll indicator', () => {
    const screen = read('src/features/trackers/trackers-screen.tsx');
    const listStart = screen.indexOf('<DraggableFlatList');
    const listEnd = screen.indexOf('/>', listStart);
    const list = screen.slice(listStart, listEnd);

    expect(listStart).toBeGreaterThan(-1);
    expect(list).toContain('showsVerticalScrollIndicator={false}');
    expect(list).toContain('showsHorizontalScrollIndicator={false}');
    expect(list).not.toContain('showsVerticalScrollIndicator={true}');
  });

  it('does not render an Open label between Manage Sections add-on rows', () => {
    const sheet = read('src/features/trackers/trackers-manage-sheet.tsx');
    const ids = read('src/utils/agent-ui/ids-shell.ts');

    expect(sheet).not.toMatch(/>\s*Open\s*</);
    expect(sheet).not.toContain('openAddon');
    expect(sheet).not.toContain('router.navigate');
    expect(sheet).not.toContain('subtitle');
    expect(sheet).not.toContain('Turn modules on without losing their data');
    expect(ids).not.toContain('openAddon');
  });

  it('keeps Manage Sections as icon-and-toggle rows without truncated blurbs', () => {
    const sheet = read('src/features/trackers/trackers-manage-sheet.tsx');

    expect(sheet).toContain('SettingsGroup');
    expect(sheet).toContain('icon={icon}');
    expect(sheet).toContain('TAB_META');
    expect(sheet).not.toContain('addon.description');
    expect(sheet).not.toContain('detail=');
    expect(sheet).not.toContain('detailNumberOfLines');
    expect(sheet).not.toContain('ScrollView');
    expect(sheet).toContain('addonsByDisplayName');
  });

  it('dismisses Sections through the parent tab navigator', () => {
    const screen = read('src/features/trackers/trackers-screen.tsx');
    const layout = read('src/app/(tabs)/_layout.tsx');

    expect(screen).toContain('useNavigation');
    expect(screen).toContain('navigation.navigate(routeName as never)');
    expect(screen).not.toContain('if (!isFocused) return null');
    expect(screen).not.toContain('useIsFocused');
    expect(screen).not.toContain('router.navigate(meta.href)');
    expect(layout).toContain('freezeOnBlur: route.name !== MORE_TAB_ROUTE');
  });

  it('does not flash the settled list then replay the entrance bounce', () => {
    const screen = read('src/features/trackers/trackers-screen.tsx');

    expect(screen).toContain('trackerRowMountPose');
    expect(screen).toContain('useSharedValue(mount.scale)');
    expect(screen).toContain('played.current');
    expect(screen).toContain('trackerRowDragPose');
    expect(screen).not.toContain('setEntranceKey');
    expect(screen).not.toContain('useFocusEffect');
    expect(screen).not.toContain('entranceKey');
  });
});
