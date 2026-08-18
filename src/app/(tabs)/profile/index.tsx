import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Linking, ScrollView, View } from 'react-native';

import {
    appPrompt,
    DangerZone,
    DestructiveSection,
    Screen,
    SegmentedControl,
    SettingsActionRow,
    SettingsGroup,
    SettingsToggleRow,
} from '@/components/primitives';
import { ONTRACK_SUPPORT_EMAIL } from '@/constants/legal';
import { THEME_PRESETS } from '@/design-system';
import { CloudAccountCard } from '@/features/account/cloud-account-card';
import { useCanUseDeveloperTools } from '@/features/account/dev-access';
import { ProfileAboutSection } from '@/features/account/profile-about-section';
import { ProfileAvatarEditorSheet } from '@/features/account/profile-avatar-editor-sheet';
import { ProfileBiometricUnlockRow } from '@/features/account/profile-biometric-unlock-row';
import { ProfileIdentityEditorSheet } from '@/features/account/profile-identity-editor-sheet';
import { ProfileIdentityHero } from '@/features/account/profile-identity-hero';
import {
    ProfileLocationPreferences,
    type ProfileLocationReveal,
} from '@/features/account/profile-location-preferences';
import { ProfileSection } from '@/features/account/profile-section';
import { getAppBuild, getAppVersion } from '@/features/account/release-notes';
import { resolveSelfDisplayName } from '@/features/account/self-display-name';
import { useAuthSession } from '@/features/auth/auth-provider';
import { useResponsive } from '@/hooks/use-responsive';
import { useAgents } from '@/store/agents';
import { usePreferences, type ThemePreference } from '@/store/preferences';
import { useThemeOverrides } from '@/store/theme-overrides';
import { AgentTestId, AgentUiIds } from '@/utils/agent-ui';
import { confirmDestructiveAction } from '@/utils/confirm-destructive';
import { deferAfterPageLoad } from '@/utils/defer-after-page-load';
import { haptics } from '@/utils/haptics';

const REVEAL_EDGE_PAD = 24;

const THEME_OPTIONS: { value: ThemePreference; label: string }[] = [
  { value: 'system', label: 'System' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
];

function ThemePreferenceRow({
  value,
  onChange,
  grouped: _grouped,
}: {
  value: ThemePreference;
  onChange: (value: ThemePreference) => void;
  grouped?: boolean;
}) {
  const { spacing } = useResponsive();
  return (
    <View style={{ padding: spacing.sm }}>
      <SegmentedControl
        value={value}
        options={THEME_OPTIONS.map((option) => ({
          ...option,
          testID: AgentUiIds.profile.theme(option.value),
        }))}
        onChange={onChange}
      />
    </View>
  );
}

/** You first, then grouped settings — nothing hidden behind a chevron. */
export default function ProfileSettingsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    focus?: ProfileLocationReveal | string;
    reveal?: ProfileLocationReveal | string;
  }>();
  const revealParam =
    typeof params.reveal === 'string'
      ? params.reveal
      : typeof params.focus === 'string'
        ? params.focus
        : undefined;
  const { spacing: rs } = useResponsive();
  const { user, isGuest, deleteAccount, resetAccountData } = useAuthSession();
  const scrollRef = useRef<ScrollView>(null);
  const [locationSectionY, setLocationSectionY] = useState<number>();

  // Today weather deep-link: wait for the direct ScrollView child to lay out,
  // then land on the location inputs without opening the keyboard.
  useEffect(() => {
    if (revealParam !== 'homeLocation' && revealParam !== 'currentLocation') {
      return;
    }
    if (locationSectionY === undefined) return;
    return deferAfterPageLoad(() => {
      scrollRef.current?.scrollTo({
        y: Math.max(0, locationSectionY - REVEAL_EDGE_PAD),
        animated: true,
      });
      router.setParams({ focus: undefined, reveal: undefined } as never);
    });
  }, [locationSectionY, revealParam, router]);

  /** Profile → Developer: only when `account_flags.developer_tools` is granted server-side. */
  const showDeveloperSection = useCanUseDeveloperTools();
  const showDeleteAccount = !isGuest && Boolean(user);
  const name = usePreferences((state) => state.name);
  const goal = usePreferences((state) => state.goal);
  const themePreference = usePreferences((state) => state.themePreference);
  const themePresetId = useThemeOverrides((state) => state.presetId);
  const hapticsEnabled = usePreferences((state) => state.hapticsEnabled);
  const usageAnalyticsEnabled = usePreferences((state) => state.usageAnalyticsEnabled);
  const showHolidays = usePreferences((state) => state.showHolidays);
  const setThemePreference = usePreferences((state) => state.setThemePreference);
  const setHapticsEnabled = usePreferences((state) => state.setHapticsEnabled);
  const setUsageAnalyticsEnabled = usePreferences((state) => state.setUsageAnalyticsEnabled);
  const setShowHolidays = usePreferences((state) => state.setShowHolidays);
  const installedAgentCount = useAgents((state) => Object.keys(state.installations).length);
  const [avatarOpen, setAvatarOpen] = useState(false);
  const [identityOpen, setIdentityOpen] = useState(false);

  const displayName = resolveSelfDisplayName({ preferencesName: name, user });
  const blurb = goal.trim() || 'Live intentionally';
  const appVersion = getAppVersion();
  const appBuild = getAppBuild();
  const versionDetail =
    !appVersion || appVersion === '—'
      ? '—'
      : appBuild
        ? `${appVersion} (${appBuild})`
        : appVersion;
  const openAvatar = () => {
    haptics.tap();
    setAvatarOpen(true);
  };
  const openIdentity = () => {
    haptics.tap();
    setIdentityOpen(true);
  };

  const handleReset = () => {
    confirmDestructiveAction({
      title: 'Reset All Data?',
      message:
        'This permanently clears all onTrack data and app-owned files. If you are signed in, synced cloud data is deleted too. Your account stays active. This cannot be undone.',
      actionLabel: 'Reset',
      onConfirm: () => {
        void (async () => {
          const result = await resetAccountData();
          if (result.status === 'failed') {
            appPrompt.alert(
              'Couldn’t Reset Data',
              result.message ?? 'We couldn’t clear everything just now. Your data is still here.',
            );
          }
        })();
      },
    });
  };

  const handleDeleteAccount = () => {
    confirmDestructiveAction({
      title: 'Delete Account?',
      message:
        'This permanently deletes your onTrack account, synced cloud data, and app-owned cloud photos. Shared trips or lists you host become unavailable to others. This cannot be undone.',
      actionLabel: 'Delete Account',
      onConfirm: () => {
        void (async () => {
          try {
            const result = await deleteAccount();
            if (result.status === 'failed') {
              appPrompt.alert(
                'Couldn’t Delete Account',
                result.message ?? 'We couldn’t finish that just now. Your account is still here.',
              );
            }
          } catch (deleteError) {
            appPrompt.alert(
              'Couldn’t Delete Account',
              deleteError instanceof Error
                ? deleteError.message
                : 'We couldn’t finish that just now. Your account is still here.',
            );
          }
        })();
      },
    });
  };

  return (
    <Screen
      scrollRef={scrollRef}
      contentStyle={{ gap: rs.lg }}>
      <ProfileIdentityHero
        displayName={displayName}
        blurb={blurb}
        onOpenAvatar={openAvatar}
        onOpenIdentity={openIdentity}
      />

      <ProfileSection testID={AgentUiIds.profile.section.account} title="Account">
        <CloudAccountCard />
        <ProfileBiometricUnlockRow />
        <AgentTestId testID={AgentUiIds.profile.section.accountSyncing} label="Connections">
          <SettingsGroup>
            <SettingsActionRow
              label="Calendar Sync"
              detail={isGuest ? 'Sign in to connect Google Calendar' : 'Google Calendar direction and connection'}
              icon="calendar"
              testID={AgentUiIds.profile.calendarSync}
              onPress={() => router.push('/(tabs)/profile/calendar-sync' as never)}
              accessibilityLabel="Manage Google Calendar sync"
            />
            <SettingsActionRow
              label="Backup"
              detail="Download a copy or save it to Google Drive"
              icon="download"
              testID={AgentUiIds.profile.backup}
              onPress={() => router.push('/(tabs)/profile/backup' as never)}
              accessibilityLabel="Backup your onTrack data"
            />
          </SettingsGroup>
        </AgentTestId>
      </ProfileSection>

      <ProfileSection testID={AgentUiIds.profile.section.appearance} title="Appearance">
        <SettingsGroup>
          <ThemePreferenceRow value={themePreference} onChange={setThemePreference} />
          <SettingsActionRow
            label="Customize App Theme"
            detail={
              themePresetId === 'custom'
                ? 'Custom colors active'
                : `${THEME_PRESETS.find((preset) => preset.id === themePresetId)?.name ?? 'Classic'} preset · backgrounds, buttons, containers, and text`
            }
            icon="smart"
            testID={AgentUiIds.profile.appearance.open}
            onPress={() => router.push('/(tabs)/profile/appearance' as never)}
            accessibilityLabel="Customize App Theme"
          />
        </SettingsGroup>
      </ProfileSection>

      <View onLayout={(event) => setLocationSectionY(event.nativeEvent.layout.y)}>
        <ProfileSection testID={AgentUiIds.profile.section.preferences} title="Preferences">
          <ProfileLocationPreferences />
          <SettingsGroup>
            <SettingsToggleRow
              label="Usage Analytics"
              detail="Off unless you turn it on. Measures time on screens to improve the product. Never includes Health notes."
              icon="insights"
              value={usageAnalyticsEnabled}
              onValueChange={setUsageAnalyticsEnabled}
              testID={AgentUiIds.profile.usageAnalytics}
            />
            <SettingsToggleRow
              label="Haptic Feedback"
              detail="Subtle taps on key actions"
              icon="settings"
              value={hapticsEnabled}
              onValueChange={setHapticsEnabled}
            />
            <SettingsToggleRow
              label="Holidays"
              detail="Show public holidays on Calendar and Today"
              icon="calendar"
              value={showHolidays}
              onValueChange={setShowHolidays}
              testID={AgentUiIds.profile.showHolidays}
            />
          </SettingsGroup>
        </ProfileSection>
      </View>

      <ProfileSection testID={AgentUiIds.profile.section.features} title="Agents">
        <SettingsGroup>
          <SettingsActionRow
            label="Manage Agents"
            detail={
              installedAgentCount > 0
                ? `${installedAgentCount} installed`
                : 'Permissions and access'
            }
            icon="agents"
            testID={AgentUiIds.profile.agents}
            onPress={() => router.push('/(tabs)/profile/agents' as never)}
            accessibilityLabel="Manage Agents"
          />
        </SettingsGroup>
      </ProfileSection>

      {showDeveloperSection ? (
        <ProfileSection testID={AgentUiIds.profile.section.developer} title="Developer">
          <SettingsGroup>
            <SettingsActionRow
              label="Developer Tools"
              detail="Insights, seeds, overlay, sync, storage"
              icon="smart"
              testID={AgentUiIds.profile.developer}
              onPress={() => router.push('/(tabs)/profile/developer' as never)}
              accessibilityLabel="Open developer tools"
            />
          </SettingsGroup>
        </ProfileSection>
      ) : null}

      <ProfileSection
        testID={AgentUiIds.profile.section.privacyData}
        title="Privacy & Data">
        <SettingsGroup>
          <SettingsActionRow
            label="Download My Data"
            detail="Export a copy of your onTrack data"
            icon="download"
            testID={AgentUiIds.profile.downloadData}
            onPress={() => router.push('/(tabs)/profile/download-data' as never)}
            accessibilityLabel="Download My Data"
          />
          <SettingsActionRow
            label="Blocked Users"
            detail="People whose messages you hid"
            icon="minus-circle"
            testID={AgentUiIds.profile.blockedUsers}
            onPress={() => router.push('/(tabs)/profile/blocked' as never)}
            accessibilityLabel="Blocked Users"
          />
          <SettingsActionRow
            label="Contact Support"
            detail={ONTRACK_SUPPORT_EMAIL}
            icon="note"
            testID={AgentUiIds.profile.support}
            onPress={() => {
              void Linking.openURL(`mailto:${ONTRACK_SUPPORT_EMAIL}`);
            }}
            accessibilityLabel="Contact Support"
          />
        </SettingsGroup>
      </ProfileSection>

      <ProfileAboutSection
        versionDetail={versionDetail}
        onOpenPrivacy={() => router.push('/privacy' as never)}
        onOpenTerms={() => router.push('/terms' as never)}
      />

      <DangerZone testID={AgentUiIds.profile.section.dangerZone}>
        <DestructiveSection
          flush
          icon={null}
          label="Reset All Data"
          description="Permanently clears all local and synced app data while keeping your account."
          onPress={handleReset}
          testID={AgentUiIds.profile.resetData}
          accessibilityLabel="Reset All Data"
        />
        {showDeleteAccount ? (
          <DestructiveSection
            flush
            icon={null}
            label="Delete Account"
            description="Permanently deletes your cloud account and synced data. This cannot be undone."
            onPress={handleDeleteAccount}
            testID={AgentUiIds.profile.deleteAccount}
            accessibilityLabel="Delete Account"
          />
        ) : null}
      </DangerZone>

      <ProfileAvatarEditorSheet visible={avatarOpen} onClose={() => setAvatarOpen(false)} />
      <ProfileIdentityEditorSheet
        visible={identityOpen}
        onClose={() => setIdentityOpen(false)}
      />
    </Screen>
  );
}
