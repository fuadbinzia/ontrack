import { useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';

import {
    EmptyState,
    ErrorMessage,
    HeaderBackButton,
    Screen,
    ScreenHeader,
    SettingsActionRow,
    SettingsGroup,
} from '@/components/primitives';
import { ProfileSection } from '@/features/account/profile-section';
import { useAuthSession } from '@/features/auth/auth-provider';
import { useResponsive } from '@/hooks/use-responsive';
import {
    listBlockedUsers,
    unblockUser,
    type BlockedUser,
} from '@/services/moderation';
import { AgentTestId, AgentUiIds } from '@/utils/agent-ui';

export default function BlockedUsersScreen() {
  const { user, isGuest } = useAuthSession();
  const { spacing } = useResponsive();
  const [blocked, setBlocked] = useState<BlockedUser[]>([]);
  const [error, setError] = useState<string>();
  const [working, setWorking] = useState<string>();

  const load = useCallback(async () => {
    if (isGuest || !user) {
      setBlocked([]);
      return;
    }
    try {
      setError(undefined);
      setBlocked(await listBlockedUsers());
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : 'Blocked users could not be loaded.',
      );
    }
  }, [isGuest, user]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <Screen
      refresh={Boolean(user) && !isGuest}
      onRefresh={load}
      contentStyle={{ gap: spacing.xl }}>
      <ScreenHeader
        title="Blocked Users"
        leading={<HeaderBackButton />}
      />
      <AgentTestId
        testID={AgentUiIds.profile.blockedUsers}
        label="Blocked Users">
        {error ? <ErrorMessage message={error} /> : null}
        {isGuest || !user ? (
          <EmptyState
            icon="minus-circle"
            title="Sign In to Manage Blocks"
            message="Blocking is available on a signed-in account."
          />
        ) : blocked.length === 0 ? (
          <EmptyState
            icon="minus-circle"
            title="No Blocked Users"
            message="People you block from chat or friends appear here."
          />
        ) : (
          <ProfileSection
            testID={AgentUiIds.profile.section.privacyData}
            title="Hidden From You">
            <SettingsGroup>
              {blocked.map((person) => (
                <SettingsActionRow
                  key={person.userId}
                  label={person.displayName}
                  detail="Tap to unblock"
                  icon="minus-circle"
                  testID={AgentUiIds.profile.blockedUserUnblock(person.userId)}
                  onPress={() => {
                    if (working === person.userId) return;
                    setWorking(person.userId);
                    void unblockUser(person.userId)
                      .then(() => load())
                      .catch((reason: unknown) => {
                        setError(
                          reason instanceof Error
                            ? reason.message
                            : 'That person could not be unblocked.',
                        );
                      })
                      .finally(() => setWorking(undefined));
                  }}
                  accessibilityLabel={`Unblock ${person.displayName}`}
                />
              ))}
            </SettingsGroup>
          </ProfileSection>
        )}
        <View />
      </AgentTestId>
    </Screen>
  );
}
