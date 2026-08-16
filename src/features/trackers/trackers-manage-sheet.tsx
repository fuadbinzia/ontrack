import { ScrollView } from 'react-native';

import { ADDONS } from '@/addons/registry';
import type { AddonId } from '@/addons/types';
import {
  SettingsGroup,
  SettingsToggleRow,
  SheetScaffold,
} from '@/components/primitives';
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
      subtitle="Turn modules on without losing their data."
      onClose={onClose}
      closeTestID={AgentUiIds.trackers.manageClose}
      backdropTestID={AgentUiIds.trackers.manageSheet}
    >
      <ScrollView>
        <SettingsGroup>
          {ADDONS.map((addon) => (
            <SettingsToggleRow
              key={addon.id}
              label={addon.name}
              detail={addon.description}
              detailNumberOfLines={1}
              value={enabledAddons[addon.id]}
              onValueChange={(value) =>
                setAddonEnabled(addon.id as AddonId, value)
              }
              testID={AgentUiIds.trackers.addon(addon.id)}
            />
          ))}
        </SettingsGroup>
      </ScrollView>
    </SheetScaffold>
  );
}
