import { View } from 'react-native';

import {
  AppText,
  Button,
  GlassPlate,
  SectionHeader,
  StatusBadge,
} from '@/components/primitives';
import { useResponsive } from '@/hooks/use-responsive';
import type { EzPassSharedMember } from '@/services/finance/ezpass-collaboration';
import { AgentUiIds } from '@/utils/agent-ui';

export function FinanceEzPassMemberManagement({
  members,
  currentUserId,
  busyUserId,
  onChangeRole,
  onRemove,
}: {
  members: EzPassSharedMember[];
  currentUserId?: string;
  busyUserId?: string;
  onChangeRole: (member: EzPassSharedMember) => void;
  onRemove: (member: EzPassSharedMember) => void;
}) {
  const { spacing: gap } = useResponsive();
  const manageable = members.filter(
    (member) => member.role !== 'owner' && member.userId !== currentUserId,
  );

  return (
    <View testID={AgentUiIds.finance.ezpass.memberManagement} style={{ gap: gap.sm }}>
      <SectionHeader title="Shared Access" detail="Host Controls" flush />
      {manageable.length ? (
        manageable.map((member) => {
          const cohost = member.role === 'cohost';
          const busy = member.userId === busyUserId;
          return (
            <GlassPlate key={member.userId} airy style={{ padding: gap.md }}>
              <View style={{ gap: gap.sm }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: gap.sm }}>
                  <AppText variant="callout" fit style={{ flex: 1, minWidth: 0 }}>
                    {member.displayName}
                  </AppText>
                  <StatusBadge label={cohost ? 'Co-Host' : 'Member'} />
                </View>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: gap.sm }}>
                  <Button
                    size="sm"
                    variant="secondary"
                    loading={busy}
                    onPress={() => onChangeRole(member)}
                    testID={AgentUiIds.finance.ezpass.memberRole(member.userId)}
                  >
                    {cohost ? 'Make Member' : 'Make Co-Host'}
                  </Button>
                  <Button
                    size="sm"
                    variant="danger"
                    disabled={busy}
                    onPress={() => onRemove(member)}
                    testID={AgentUiIds.finance.ezpass.memberRemove(member.userId)}
                  >
                    Remove
                  </Button>
                </View>
              </View>
            </GlassPlate>
          );
        })
      ) : (
        <AppText variant="caption" color="secondary">
          Add a friend below, then choose whether they are a member or co-host.
        </AppText>
      )}
    </View>
  );
}
