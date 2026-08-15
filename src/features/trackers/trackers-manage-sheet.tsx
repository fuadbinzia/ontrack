import { useRouter } from 'expo-router';
import { Pressable, ScrollView, View } from 'react-native';

import { ADDONS } from '@/addons/registry';
import type { AddonId } from '@/addons/types';
import {
  AppText,
  SettingsGroup,
  SettingsToggleRow,
  SheetScaffold,
} from '@/components/primitives';
import { TAB_META } from '@/components/navigation/bottom-nav-tab-meta';
import { useResponsive } from '@/hooks/use-responsive';
import { useAddons } from '@/store/addons';
import { AgentTestId, AgentUiIds } from '@/utils/agent-ui';

export function TrackersManageSheet({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const { layout } = useResponsive();
  const enabledAddons = useAddons((state) => state.enabled);
  const setAddonEnabled = useAddons((state) => state.setEnabled);

  return (
    <SheetScaffold
      visible={visible}
      title="Manage Sections"
      subtitle="Turn modules on without losing their data."
      onClose={onClose}
      closeTestID={AgentUiIds.trackers.manageClose}
      backdropTestID={AgentUiIds.trackers.manageSheet}
    >
      <ScrollView>
        <SettingsGroup>
          {ADDONS.map((addon) => {
            const routeName = addon.tabRoute;
            const href = routeName ? TAB_META[routeName]?.href : undefined;
            const isOn = enabledAddons[addon.id];
            return (
              <View key={addon.id}>
                <SettingsToggleRow
                  label={addon.name}
                  detail={addon.description}
                  detailNumberOfLines={1}
                  value={isOn}
                  onValueChange={(value) =>
                    setAddonEnabled(addon.id as AddonId, value)
                  }
                  testID={AgentUiIds.trackers.addon(addon.id)}
                />
                {isOn && href ? (
                  <AgentTestId
                    testID={AgentUiIds.trackers.openAddon(addon.id)}
                    label={`Open ${addon.name}`}
                    onPress={() => {
                      onClose();
                      router.navigate(href);
                    }}
                  >
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Open ${addon.name}`}
                      onPress={() => {
                        onClose();
                        router.navigate(href);
                      }}
                      style={{
                        minHeight: layout.minTapTarget,
                        justifyContent: 'center',
                        paddingHorizontal: 4,
                      }}
                    >
                      <AppText variant="callout" color="accent" fit>
                        Open
                      </AppText>
                    </Pressable>
                  </AgentTestId>
                ) : null}
              </View>
            );
          })}
        </SettingsGroup>
      </ScrollView>
    </SheetScaffold>
  );
}
