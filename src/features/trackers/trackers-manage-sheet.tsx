import type { AddonId } from '@/addons/types';
import { TAB_META } from '@/components/navigation/bottom-nav-tab-meta';
import {
  SettingsGroup,
  SettingsToggleRow,
  SheetScaffold,
} from '@/components/primitives';
import { addonsByDisplayName } from '@/features/trackers/tracker-presence';
import { useAddons } from '@/store/addons';
import { AgentUiIds } from '@/utils/agent-ui';

export function TrackersManageSheet({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const enabledAddons = useAddons((state) => state.enabled);
  const setAddonEnabled = useAddons((state) => state.setEnabled);

  return (
    <SheetScaffold
      visible={visible}
      title="Manage Sections"
      onClose={onClose}
      closeTestID={AgentUiIds.trackers.manageClose}
      backdropTestID={AgentUiIds.trackers.manageSheet}
    >
      <SettingsGroup>
        {addonsByDisplayName().map((addon) => {
          const icon = addon.tabRoute
            ? TAB_META[addon.tabRoute]?.icon
            : undefined;
          return (
            <SettingsToggleRow
              key={addon.id}
              label={addon.name}
              icon={icon}
              value={enabledAddons[addon.id]}
              onValueChange={(value) =>
                setAddonEnabled(addon.id as AddonId, value)
              }
              testID={AgentUiIds.trackers.addon(addon.id)}
            />
          );
        })}
      </SettingsGroup>
    </SheetScaffold>
  );
}
