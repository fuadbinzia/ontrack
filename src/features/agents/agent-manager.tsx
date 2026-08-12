import { StyleSheet, View } from 'react-native';

import { getAddon } from '@/addons/registry';
import { AGENTS, agentAvailability, getAgentCapability } from '@/agents/registry';
import type { AgentDefinition } from '@/agents/types';
import {
    AppText,
    Button,
    Card,
    EmptyState,
    GlassIconWell,
    HeaderBackButton,
    Screen,
    ScreenHeader,
    SectionHeader,
    SettingsToggleRow,
    Symbol,
} from '@/components/primitives';
import { spacing } from '@/design-system';
import { useTheme } from '@/hooks/use-theme';
import { useAddons } from '@/store/addons';
import { useAgents } from '@/store/agents';

export function AgentManager() {
  const installations = useAgents((state) => state.installations);
  const entitlements = useAgents((state) => state.entitlements);
  const enabledAddons = useAddons((state) => state.enabled);
  const installed = AGENTS.filter((definition) => installations[definition.id]);
  const available = AGENTS.filter((definition) => !installations[definition.id]);

  return (
    <Screen contentStyle={styles.screen}>
      <ScreenHeader
        eyebrow="Profile"
        title="Agents"
        subtitle="Agents are optional companions that connect to existing onTrack add-ons. You stay in control of every permission, and removing one also removes its conversations."
        leading={
          <HeaderBackButton
            compact
            accessibilityLabel="Back to profile"
            fallback="/(tabs)/profile"
          />
        }
      />

      {AGENTS.length === 0 ? (
        <EmptyState
          icon="agents"
          title="Ready for future agents"
          message="The shared catalog, permissions, providers, storage, and cross-device sync are in place. No agents have been added yet."
        />
      ) : (
        <>
          {installed.length > 0 ? <SectionHeader title="Installed" /> : null}
          {installed.map((definition) => (
            <AgentCard
              key={definition.id}
              definition={definition}
              availability={agentAvailability(definition, entitlements, enabledAddons)}
              installed
            />
          ))}
          {available.length > 0 ? <SectionHeader title="Available" /> : null}
          {available.map((definition) => (
            <AgentCard
              key={definition.id}
              definition={definition}
              availability={agentAvailability(definition, entitlements, enabledAddons)}
            />
          ))}
        </>
      )}
    </Screen>
  );
}

function AgentCard({
  definition,
  availability,
  installed = false,
}: {
  definition: AgentDefinition;
  availability: ReturnType<typeof agentAvailability>;
  installed?: boolean;
}) {
  const theme = useTheme();
  const installation = useAgents((state) => state.installations[definition.id]);
  const installAgent = useAgents((state) => state.installAgent);
  const removeAgent = useAgents((state) => state.removeAgent);
  const setAgentEnabled = useAgents((state) => state.setAgentEnabled);
  const setCapabilityGranted = useAgents((state) => state.setCapabilityGranted);
  const capabilities = [
    ...definition.requiredCapabilities,
    ...(definition.optionalCapabilities ?? []),
  ];
  const addonName = definition.requiredAddonId
    ? getAddon(definition.requiredAddonId).name
    : undefined;
  const availabilityMessage =
    availability.reason === 'not-entitled'
      ? 'Not included with this account.'
      : availability.reason === 'required-addon-disabled'
        ? `Turn on ${addonName} to use this agent.`
        : undefined;

  return (
    <Card variant="sunken" style={styles.card}>
      <View style={styles.cardHeader}>
        <GlassIconWell size={48} borderRadius={12}>
          <Symbol name={definition.icon} size="lg" color={theme.accentPrimary} />
        </GlassIconWell>
        <View style={styles.flex}>
          <AppText variant="subheading">{definition.name}</AppText>
          <AppText variant="caption" color="secondary">
            {definition.description}
          </AppText>
        </View>
      </View>
      {addonName ? (
        <AppText variant="caption" color="tertiary">
          Connects to {addonName}
        </AppText>
      ) : null}
      {availabilityMessage ? (
        <AppText variant="caption" color="danger">
          {availabilityMessage}
        </AppText>
      ) : null}

      {installed && installation ? (
        <>
          <SettingsToggleRow
            label="Agent Enabled"
            detail="Allow this agent to run when all required permissions are on."
            value={installation.enabled}
            disabled={!availability.available}
            onValueChange={(value) => setAgentEnabled(definition.id, value)}
          />
          {capabilities.length > 0 ? <SectionHeader title="Permissions" /> : null}
          {capabilities.map((capabilityId) => {
            const capability = getAgentCapability(capabilityId);
            if (!capability) return null;
            const required = definition.requiredCapabilities.includes(capabilityId);
            return (
              <SettingsToggleRow
                key={capabilityId}
                label={capability.name}
                detail={`${capability.description}${required ? ' Required.' : ' Optional.'}`}
                value={installation.grantedCapabilities.includes(capabilityId)}
                onValueChange={(value) =>
                  setCapabilityGranted(definition.id, capabilityId, value)
                }
              />
            );
          })}
          <Button
            variant="ghost"
            onPress={() => removeAgent(definition.id)}
            accessibilityLabel={`Remove ${definition.name}`}>
            Remove agent
          </Button>
        </>
      ) : (
        <Button
          disabled={!availability.available}
          onPress={() => installAgent(definition.id)}
          accessibilityLabel={`Add ${definition.name}`}>
          Add agent
        </Button>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  screen: { gap: spacing.sm },
  card: { gap: spacing.md },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  agentIcon: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 24,
  },
  flex: { flex: 1, gap: spacing.xxs },
});
