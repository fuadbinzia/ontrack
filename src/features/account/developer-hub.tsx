import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import { View } from 'react-native';

import {
  ActionChipRow,
  AppText,
  Button,
  Card,
  CollapsibleSection,
  FormSection,
  HeaderBackButton,
  Input,
  MetaList,
  PanelTitle,
  Screen,
  ScreenHeader,
  SettingsActionRow,
  SettingsGroup,
  SettingsToggleRow,
} from '@/components/primitives';
import { useAuthSession } from '@/features/auth/auth-provider';
import { useResponsive } from '@/hooks/use-responsive';
import { useRouteIsActive } from '@/hooks/use-app-activity';
import { useCloudSyncStatus } from '@/services/cloud/sync';
import { apiRequest } from '@/services/http/api-client';
import { resolveExpoApiUrl } from '@/services/http/api-url';
import { useDevMode } from '@/store/dev-mode';
import { AgentUiIds, getAgentUiRoute } from '@/utils/agent-ui';
import {
  AGENT_UI_FIXTURE_NAMES,
  seedAgentUiFixture,
  type AgentUiFixtureName,
} from '@/utils/agent-ui/fixtures';
import {
  isAgentUiOverlayEnabled,
  setAgentUiOverlayEnabled,
  subscribeAgentUiOverlay,
} from '@/utils/agent-ui/overlay';
import {
  agentUiNavigate,
  resolveAgentUiDestination,
} from '@/utils/agent-ui/route';
import { deferUntilIdle } from '@/utils/defer-until-idle';

import { setDevModeEnabled } from './dev-mode-controller';
import { DeveloperInsightsPanel } from './developer-insights-panel';
import { DeveloperReleaseNotesPanel } from './developer-release-notes-panel';
import {
  formatBytes,
  listLocalStorageSizes,
  type StorageSizeRow,
} from './developer-storage';

/**
 * Loaded automatically when Dev Mode turns on, so the tabs a sandbox is most
 * often opened for are populated without hunting for a chip. Everything here is
 * purged again on exit.
 */
const DEV_MODE_AUTO_SEEDS: readonly AgentUiFixtureName[] = [
  'travel-home',
  'food-demo',
];

function useOverlayEnabled() {
  return useSyncExternalStore(
    subscribeAgentUiOverlay,
    isAgentUiOverlayEnabled,
    () => false,
  );
}

export function DeveloperHub() {
  const router = useRouter();
  const routeIsActive = useRouteIsActive();
  const { spacing } = useResponsive();
  const overlayOn = useOverlayEnabled();
  const sync = useCloudSyncStatus();
  const devModeEnabled = useDevMode((state) => state.enabled);
  const staySignedIn = useDevMode((state) => state.staySignedIn);
  const setStaySignedIn = useDevMode((state) => state.setStaySignedIn);
  const { lockSession } = useAuthSession();
  const [routeAlias, setRouteAlias] = useState('travel');
  const [seedMessage, setSeedMessage] = useState<string | undefined>();
  const [storageRows, setStorageRows] = useState<StorageSizeRow[]>([]);
  const [rateLimitMessage, setRateLimitMessage] = useState<
    string | undefined
  >();
  const [currentRoute, setCurrentRoute] = useState(getAgentUiRoute() ?? '—');

  const refreshRoute = useCallback(() => {
    setCurrentRoute(getAgentUiRoute() ?? '—');
  }, []);

  const refreshStorage = useCallback(() => {
    void listLocalStorageSizes().then(setStorageRows);
  }, []);

  useEffect(() => {
    if (!routeIsActive) return;
    refreshStorage();
    refreshRoute();
    const timer = setInterval(refreshRoute, 2000);
    return () => clearInterval(timer);
  }, [refreshRoute, refreshStorage, routeIsActive]);

  const runSeed = (name: AgentUiFixtureName) => {
    if (!devModeEnabled) {
      setSeedMessage('Turn on Dev Mode before seeding demos.');
      return;
    }
    const result = seedAgentUiFixture(name);
    if (!result) {
      setSeedMessage(`Could not seed ${name}`);
      return;
    }
    setSeedMessage(`Seeded ${result.fixture}`);
    if (name === 'travel-demo') agentUiNavigate('/travel/trip-agent-ui-demo');
    else if (name === 'travel-home') agentUiNavigate('/travel');
    else if (name === 'checklist-demo') agentUiNavigate('/to-do');
    else if (name === 'grocery-demo') agentUiNavigate('/to-do');
    else if (name === 'health-demo') agentUiNavigate('/health');
    else if (name === 'vehicle-demo') agentUiNavigate('/vehicles');
    else if (name === 'plants-demo') agentUiNavigate('/plants');
    else if (name === 'activity-demo') agentUiNavigate('/');
    else if (name === 'food-demo') agentUiNavigate('/food');
    else if (name === 'workouts-demo') agentUiNavigate('/workouts');
    else if (name === 'vision-board-demo') agentUiNavigate('/vision-board');
  };

  const toggleDevMode = async (enabled: boolean) => {
    // Sandbox flip is sync now — await still keeps ordering for exit restore.
    await setDevModeEnabled(enabled);
    if (!enabled) {
      setSeedMessage(undefined);
      return;
    }
    // Yield so the Switch + Demo seeds chrome paint before fixture work.
    deferUntilIdle(() => {
      if (!useDevMode.getState().enabled) return;
      const seeded = DEV_MODE_AUTO_SEEDS.filter((name) =>
        seedAgentUiFixture(name),
      );
      if (seeded.length === 0) {
        setSeedMessage('Dev Mode on — tap a Demo seed below to load fixtures.');
        return;
      }
      // Stay on Developer Tools so Demo seeds appear under the toggle.
      setSeedMessage(
        `Seeded ${seeded.join(' + ')} — open Travel or Food to browse.`,
      );
    });
  };

  const resetRateLimits = async () => {
    setRateLimitMessage(undefined);
    try {
      const url = resolveExpoApiUrl('/api/usage/reset', {
        configuredBaseUrl: process.env.EXPO_PUBLIC_API_BASE_URL,
        createNotConfiguredError: () =>
          new Error('API host is not configured.'),
      });
      await apiRequest<{ ok: boolean; subject: string }, Error>({
        url,
        method: 'POST',
        body: {},
        offlineMessage: 'Connect to reset rate limits.',
        unavailableMessage: 'Rate-limit reset failed.',
        createError: (message) => new Error(message),
      });
      setRateLimitMessage('Cleared this subject’s app rate-limit buckets.');
    } catch (reason) {
      setRateLimitMessage(
        reason instanceof Error ? reason.message : 'Reset failed.',
      );
    }
  };

  const hostUri = Constants.expoConfig?.hostUri ?? '—';
  const apiBase =
    process.env.EXPO_PUBLIC_API_BASE_URL?.trim() || '(Metro host)';
  const appEnv = process.env.EXPO_PUBLIC_APP_ENV?.trim() || 'development';

  return (
    <Screen contentStyle={{ gap: spacing.md }}>
      <ScreenHeader
        eyebrow={devModeEnabled ? 'Dev Mode sandbox' : 'Development only'}
        title="Developer Tools"
        subtitle="Diagnostics, demo seeds, agent-ui, and product insights"
        leading={
          <HeaderBackButton
            compact
            accessibilityLabel="Back to profile"
            fallback="/(tabs)/profile"
            testID={AgentUiIds.developer.back}
          />
        }
      />

      <View style={{ gap: spacing.lg }}>
        <DeveloperReleaseNotesPanel />

        <CollapsibleSection
          title="Navigate"
          description="Dev Mode sandbox, demo seeds, and design screens"
          testID={AgentUiIds.developer.section.navigate}
        >
          <SettingsGroup>
            <SettingsToggleRow
              label="Dev Mode"
              detail={
                devModeEnabled
                  ? 'On: live data is snapshotted and cloud sync is paused. Travel and Food demos load automatically; other Demo seeds below stay local too. Everything seeded here is removed when you turn this off (real trips you create or edit are kept).'
                  : 'Off by default (also clears on app restart). Turn on to sandbox your account — loads travel and food demos and shows Demo seeds. Agents also use this while seeding, then turn it off again.'
              }
              detailNumberOfLines={5}
              value={devModeEnabled}
              onValueChange={(next) => {
                void toggleDevMode(next);
              }}
              testID={AgentUiIds.developer.devMode}
            />
            <SettingsToggleRow
              label="Stay signed in"
              detail="Off: closing the app fully means signing in again on next launch (guests re-enter from Welcome). Turn on to keep this device signed in while testing. Simulators and emulators never ask."
              detailNumberOfLines={4}
              value={staySignedIn}
              onValueChange={setStaySignedIn}
              testID={AgentUiIds.developer.staySignedIn}
            />
            <SettingsActionRow
              label="Lock session now"
              detail="Show the sign-in gate without signing out — the same screen a relaunch gives you."
              testID={AgentUiIds.developer.lockSession}
              onPress={lockSession}
            />
          </SettingsGroup>
          {devModeEnabled ? (
            <Card
              airy
              style={{ gap: spacing.sm }}
              testID={AgentUiIds.developer.seeds}
            >
              <PanelTitle>Demo seeds</PanelTitle>
              <AppText variant="caption" color="secondary">
                Loads stable fixtures (same as agent-ui-seed). Restored when you
                leave Dev Mode.
              </AppText>
              <ActionChipRow
                items={AGENT_UI_FIXTURE_NAMES.map((name) => ({
                  id: name,
                  label: name,
                  testID: AgentUiIds.developer.seed(name),
                  onPress: () => runSeed(name),
                }))}
              />
              {seedMessage ? (
                <AppText variant="caption" color="accent" fit>
                  {seedMessage}
                </AppText>
              ) : null}
            </Card>
          ) : null}
          <SettingsGroup>
            <SettingsActionRow
              label="Design System"
              detail="Components, accents, icons"
              testID={AgentUiIds.developer.designSystem}
              onPress={() =>
                router.push('/(tabs)/profile/design-system' as never)
              }
            />
            <SettingsActionRow
              label="Integrations"
              detail="Third-party health and quotas"
              testID={AgentUiIds.developer.apiUsage}
              onPress={() =>
                router.push('/(tabs)/profile/integrations' as never)
              }
            />
            <SettingsActionRow
              label="Performance Monitor"
              detail="Live CPU, memory, battery, runtime work, and 30-day trends"
              testID={AgentUiIds.developer.performance}
              onPress={() =>
                router.push('/(tabs)/profile/performance' as never)
              }
            />
          </SettingsGroup>
        </CollapsibleSection>

        <DeveloperInsightsPanel />

        <CollapsibleSection
          title="Runtime"
          description="Environment, Metro host, API base, and current route"
          testID={AgentUiIds.developer.section.runtime}
        >
          <Card
            airy
            style={{ gap: spacing.sm }}
            testID={AgentUiIds.developer.env}
          >
            <PanelTitle>Environment</PanelTitle>
            <MetaList
              items={[
                { label: 'App env', value: appEnv },
                { label: 'Metro', value: hostUri },
                { label: 'API base', value: apiBase },
                { label: 'Route', value: currentRoute },
                {
                  label: 'Supabase',
                  value: process.env.EXPO_PUBLIC_SUPABASE_URL?.trim()
                    ? 'Configured'
                    : 'Missing',
                },
              ]}
            />
          </Card>
        </CollapsibleSection>

        <CollapsibleSection
          title="Diagnostics"
          description="Agent overlay, cloud sync status, and local storage"
          testID={AgentUiIds.developer.section.diagnostics}
        >
          <SettingsGroup>
            <SettingsToggleRow
              label="Overlay"
              detail="Paint testID frames for screenshot triage. The floating button appears only while this is on — drag to move, tap to turn off, long-press to hide. With Dev Mode on, long-press anywhere to turn overlay back on."
              detailNumberOfLines={4}
              value={overlayOn}
              onValueChange={setAgentUiOverlayEnabled}
              testID={AgentUiIds.developer.overlay}
            />
          </SettingsGroup>
          <Card
            airy
            style={{ gap: spacing.sm }}
            testID={AgentUiIds.developer.sync}
          >
            <PanelTitle>Cloud sync</PanelTitle>
            <MetaList
              items={[
                {
                  label: 'State',
                  value: sync.email
                    ? `${sync.state} · ${sync.email}`
                    : sync.state,
                },
                {
                  label: 'Last synced',
                  value: sync.lastSyncedAt
                    ? new Date(sync.lastSyncedAt).toLocaleString()
                    : '—',
                },
                ...(sync.message
                  ? [{ label: 'Message', value: sync.message }]
                  : []),
              ]}
            />
          </Card>
          <Card
            airy
            style={{ gap: spacing.sm }}
            testID={AgentUiIds.developer.storage}
          >
            <PanelTitle>Local storage</PanelTitle>
            {storageRows.length === 0 ? (
              <AppText variant="caption" color="secondary">
                No persisted keys yet.
              </AppText>
            ) : (
              <MetaList
                items={storageRows.map((row) => ({
                  label: row.label,
                  value: formatBytes(row.bytes),
                }))}
              />
            )}
            <Button
              size="sm"
              variant="ghost"
              testID={AgentUiIds.developer.storageRefresh}
              accessibilityLabel="Refresh storage sizes"
              onPress={refreshStorage}
            >
              Refresh sizes
            </Button>
          </Card>
        </CollapsibleSection>

        <CollapsibleSection
          title="Tools"
          description="Open routes by alias and reset API rate limits"
          testID={AgentUiIds.developer.section.tools}
        >
          <Card airy style={{ gap: spacing.sm }}>
            <FormSection
              title="Open route"
              description="Alias or path from agent-routes."
            >
              <Input
                label="Alias or path"
                value={routeAlias}
                onChangeText={setRouteAlias}
                testID={AgentUiIds.developer.routeInput}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <Button
                testID={AgentUiIds.developer.routeGo}
                accessibilityLabel="Open route alias"
                onPress={() => {
                  const href = resolveAgentUiDestination(routeAlias.trim());
                  if (href) agentUiNavigate(href);
                }}
              >
                Go
              </Button>
            </FormSection>
          </Card>

          <Card airy style={{ gap: spacing.sm }}>
            <PanelTitle>API rate limits</PanelTitle>
            <Button
              variant="secondary"
              testID={AgentUiIds.developer.rateLimitReset}
              accessibilityLabel="Reset app rate limits"
              onPress={() => void resetRateLimits()}
            >
              Reset app rate-limit buckets
            </Button>
            {rateLimitMessage ? (
              <AppText variant="caption" color="secondary">
                {rateLimitMessage}
              </AppText>
            ) : null}
          </Card>
        </CollapsibleSection>
      </View>
    </Screen>
  );
}
