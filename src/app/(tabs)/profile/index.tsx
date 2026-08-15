import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { ADDONS } from '@/addons/registry';
import type { AddonId } from '@/addons/types';
import {
    appPrompt,
    AppText,
    Card,
    CollapsibleSection,
    DangerZone,
    DestructiveSection,
    Screen,
    SectionHeader,
    SegmentedControl,
    SettingsActionRow,
    SettingsGroup,
    SettingsRow,
    SettingsToggleRow,
} from '@/components/primitives';
import { THEME_PRESETS } from '@/design-system';
import { CloudAccountCard } from '@/features/account/cloud-account-card';
import { useCanUseDeveloperTools } from '@/features/account/dev-access';
import { ProfileAvatar } from '@/features/account/profile-avatar';
import { ProfileAvatarEditorSheet } from '@/features/account/profile-avatar-editor-sheet';
import { ProfileIdentityEditorSheet } from '@/features/account/profile-identity-editor-sheet';
import { getAppBuild, getAppVersion } from '@/features/account/release-notes';
import { resolveSelfDisplayName } from '@/features/account/self-display-name';
import { useAuthSession } from '@/features/auth/auth-provider';
import {
  ProfileLocationPreferences,
  type ProfileLocationReveal,
} from '@/features/account/profile-location-preferences';
import { useResponsive } from '@/hooks/use-responsive';
import { useAddons } from '@/store/addons';
import { useAgents } from '@/store/agents';
import { usePreferences, type ThemePreference } from '@/store/preferences';
import { useThemeOverrides } from '@/store/theme-overrides';
import { AgentTestId, AgentUiIds, useAgentUiTarget } from '@/utils/agent-ui';
import { confirmDestructiveAction } from '@/utils/confirm-destructive';
import { deferAfterPageLoad } from '@/utils/defer-after-page-load';
import { haptics } from '@/utils/haptics';
import { openHttpsUrl } from '@/utils/safe-url';

const REVEAL_EDGE_PAD = 24;

const THEME_OPTIONS: { value: ThemePreference; label: string }[] = [
  { value: 'system', label: 'System' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
];

/** Primary carousel section for account and app preferences. */
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
  const { s, spacing: rs } = useResponsive();
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
  const aiEnabled = usePreferences((state) => state.aiEnabled);
  const hapticsEnabled = usePreferences((state) => state.hapticsEnabled);
  const usageAnalyticsEnabled = usePreferences((state) => state.usageAnalyticsEnabled);
  const setThemePreference = usePreferences((state) => state.setThemePreference);
  const setAiEnabled = usePreferences((state) => state.setAiEnabled);
  const setHapticsEnabled = usePreferences((state) => state.setHapticsEnabled);
  const setUsageAnalyticsEnabled = usePreferences((state) => state.setUsageAnalyticsEnabled);
  const enabledAddons = useAddons((state) => state.enabled);
  const setAddonEnabled = useAddons((state) => state.setEnabled);
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
  const avatarSize = Math.max(56, s(60));
  const openAvatar = () => {
    haptics.tap();
    setAvatarOpen(true);
  };
  const openIdentity = () => {
    haptics.tap();
    setIdentityOpen(true);
  };
  const avatarAgent = useAgentUiTarget(AgentUiIds.profile.avatar, {
    label: 'Customize profile icon',
    onPress: openAvatar,
  });
  const displayNameAgent = useAgentUiTarget(AgentUiIds.profile.displayName, {
    label: 'Edit name and blurb',
    onPress: openIdentity,
  });
  const blurbAgent = useAgentUiTarget(AgentUiIds.profile.blurb, {
    label: 'Edit name and blurb',
    onPress: openIdentity,
  });
  const openTmdb = () => {
    void openHttpsUrl('https://www.themoviedb.org');
  };
  const tmdbAgent = useAgentUiTarget(AgentUiIds.profile.tmdb, {
    label: 'Open The Movie Database',
    onPress: openTmdb,
  });

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
            appPrompt.alert('Reset failed', result.message ?? 'Data reset failed.');
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
              appPrompt.alert('Delete failed', result.message ?? 'Account deletion failed.');
            }
          } catch (deleteError) {
            appPrompt.alert(
              'Delete failed',
              deleteError instanceof Error ? deleteError.message : 'Account deletion failed.',
            );
          }
        })();
      },
    });
  };

  const addonList = ADDONS.filter(
    (addon) => addon.id !== 'health' || process.env.EXPO_OS === 'ios',
  );

  return (
    <Screen
      scrollRef={scrollRef}
      contentStyle={{ gap: rs.lg }}>
      <View style={[styles.hero, { gap: rs.sm }]}>
        <Pressable
          ref={avatarAgent.ref}
          accessibilityRole="button"
          accessibilityLabel="Customize profile icon"
          testID={avatarAgent.testID}
          onLayout={avatarAgent.onLayout}
          onPress={openAvatar}>
          <ProfileAvatar displayName={displayName} size={avatarSize} isSelf />
        </Pressable>
        <View style={[styles.heroCopy, { gap: rs.xxs, minWidth: 0, flexShrink: 1 }]}>
          <Pressable
            ref={displayNameAgent.ref}
            accessibilityRole="button"
            accessibilityLabel="Edit name and blurb"
            testID={displayNameAgent.testID}
            onLayout={displayNameAgent.onLayout}
            onPress={openIdentity}>
            <AppText variant="title" fit numberOfLines={1}>
              {displayName}
            </AppText>
          </Pressable>
          <Pressable
            ref={blurbAgent.ref}
            accessibilityRole="button"
            accessibilityLabel="Edit name and blurb"
            testID={blurbAgent.testID}
            onLayout={blurbAgent.onLayout}
            onPress={openIdentity}>
            <AppText variant="caption" color="secondary" numberOfLines={1} fit>
              {blurb}
            </AppText>
          </Pressable>
        </View>
      </View>

      <AgentTestId
        testID={AgentUiIds.profile.section.account}
        label="Account"
        style={{ gap: rs.sm }}>
        <SectionHeader title="Account" flush />
        <CloudAccountCard />
      </AgentTestId>

      <AgentTestId
        testID={AgentUiIds.profile.section.accountSyncing}
        label="Account Syncing"
        style={{ gap: rs.sm }}>
        <SectionHeader title="Account Syncing" flush />
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
            label="StraiAway"
            detail={isGuest ? 'Sign in to connect StraiAway' : 'Link accounts and send stays'}
            icon="lodging"
            testID={AgentUiIds.profile.straiaway}
            onPress={() => router.push('/(tabs)/profile/straiaway' as never)}
            accessibilityLabel="Manage StraiAway connection"
          />
        </SettingsGroup>
      </AgentTestId>

      <AgentTestId
        testID={AgentUiIds.profile.section.appearance}
        label="Appearance"
        style={{ gap: rs.sm }}>
        <SectionHeader title="Appearance" flush />
        <Card variant="elevated" padded={false} style={{ padding: rs.xs }}>
          <SegmentedControl
            value={themePreference}
            options={THEME_OPTIONS.map((option) => ({
              ...option,
              testID: AgentUiIds.profile.theme(option.value),
            }))}
            onChange={setThemePreference}
          />
        </Card>
        <SettingsGroup>
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
      </AgentTestId>

      {showDeveloperSection ? (
        <AgentTestId
          testID={AgentUiIds.profile.section.developer}
          label="Developer"
          style={{ gap: rs.sm }}>
          <SectionHeader title="Developer" flush />
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
        </AgentTestId>
      ) : null}

      <View
        onLayout={(event) => setLocationSectionY(event.nativeEvent.layout.y)}>
        <CollapsibleSection
          title="Preferences"
          defaultExpanded
          testID={AgentUiIds.profile.section.preferences}>
          <View style={{ gap: rs.md }}>
            <ProfileLocationPreferences />
            <SettingsGroup>
              <SettingsToggleRow
                label="AI Summaries"
                detail="Daily insights, meals, and plants"
                icon="smart"
                value={aiEnabled}
                onValueChange={setAiEnabled}
              />
              <SettingsToggleRow
                label="Usage Analytics"
                detail="Screen time to improve the product"
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
            </SettingsGroup>
          </View>
        </CollapsibleSection>
      </View>

      <CollapsibleSection
        title="Features"
        testID={AgentUiIds.profile.section.features}>
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
          <SettingsActionRow
            label="Nutrition"
            detail="Profiles, dependents & targets"
            icon="nutrition-profiles"
            testID={AgentUiIds.profile.nutrition}
            onPress={() => router.push('/(tabs)/profile/nutrition-profile' as never)}
            accessibilityLabel="Open nutrition profiles"
          />
        </SettingsGroup>
      </CollapsibleSection>

      <CollapsibleSection
        title="Add-ons"
        detail="Data kept when off"
        testID={AgentUiIds.profile.section.addons}>
        <SettingsGroup>
          {addonList.map((addon) => (
            <SettingsToggleRow
              key={addon.id}
              label={addon.name}
              detail={addon.description}
              detailNumberOfLines={1}
              value={enabledAddons[addon.id]}
              onValueChange={(value) => setAddonEnabled(addon.id as AddonId, value)}
              testID={AgentUiIds.profile.addon(addon.id)}
            />
          ))}
        </SettingsGroup>
      </CollapsibleSection>

      <AgentTestId
        testID={AgentUiIds.profile.section.legal}
        label="Legal"
        style={{ gap: rs.sm }}>
        <SectionHeader title="Legal" flush />
        <SettingsGroup>
          <SettingsActionRow
            label="Privacy Policy"
            detail="How onTrack handles your data"
            icon="shield"
            testID={AgentUiIds.profile.privacy}
            onPress={() => router.push('/privacy' as never)}
            accessibilityLabel="Privacy Policy"
          />
          <SettingsActionRow
            label="Terms of Use"
            detail="Rules for using onTrack"
            icon="note"
            testID={AgentUiIds.profile.terms}
            onPress={() => router.push('/terms' as never)}
            accessibilityLabel="Terms of Use"
          />
        </SettingsGroup>
      </AgentTestId>

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

      <AgentTestId
        testID={AgentUiIds.profile.section.disclaimers}
        label="Disclaimers"
        style={{ gap: rs.sm }}>
        <SectionHeader title="Disclaimers" flush />
        <SettingsGroup>
          <Pressable
            ref={tmdbAgent.ref}
            accessibilityRole="link"
            accessibilityLabel="Open The Movie Database"
            testID={tmdbAgent.testID}
            onLayout={tmdbAgent.onLayout}
            onPress={openTmdb}
            style={[
              styles.attribution,
              {
                gap: rs.sm,
                paddingHorizontal: rs.md,
                paddingVertical: rs.md,
                minHeight: Math.max(44, s(56)),
              },
            ]}>
            <Image
              source="https://www.themoviedb.org/assets/2/v4/logos/v2/blue_short-8e7b30f73a4020692ccca9c88bafe5dcb6f8a62a4c6bc55cd9ba82bb2cd95f6c.svg"
              style={{ width: s(72), height: s(28) }}
              contentFit="contain"
            />
            <AppText variant="caption" color="tertiary" numberOfLines={2} style={{ flexShrink: 1, minWidth: 0 }}>
              This product uses the TMDB API but is not endorsed or certified by TMDB.
            </AppText>
          </Pressable>
        </SettingsGroup>
      </AgentTestId>

      <AgentTestId
        testID={AgentUiIds.profile.section.appInformation}
        label="App Information"
        style={{ gap: rs.sm, paddingBottom: rs.xl }}>
        <SectionHeader title="App Information" flush />
        <SettingsGroup>
          <SettingsRow
            label="Version"
            detail={versionDetail}
            icon="settings"
            testID={AgentUiIds.profile.version}
            accessibilityLabel="App version"
          />
        </SettingsGroup>
      </AgentTestId>

      <ProfileAvatarEditorSheet visible={avatarOpen} onClose={() => setAvatarOpen(false)} />
      <ProfileIdentityEditorSheet
        visible={identityOpen}
        onClose={() => setIdentityOpen(false)}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  heroCopy: {
    flex: 1,
  },
  attribution: {
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
});
