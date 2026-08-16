import { type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import {
  AppText,
  Button,
  Card,
  ErrorMessage,
  GlassIconWell,
  StatusBadge,
  Symbol,
} from '@/components/primitives';
import type { AppIconName } from '@/design-system';
import { useResponsive } from '@/hooks/use-responsive';
import { useTheme } from '@/hooks/use-theme';
import { AgentTestId, AgentUiIds } from '@/utils/agent-ui';

export function formatBackupTime(value?: string) {
  if (!value) return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return undefined;
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function BackupStatusNotice({ error, message }: { error?: string; message?: string }) {
  const { spacing } = useResponsive();
  if (!error && !message) return null;
  return (
    <AgentTestId testID={AgentUiIds.backup.status} label="Backup status">
      <Card airy style={{ gap: spacing.xs }}>
        {error ? <ErrorMessage message={error} variant="callout" /> : null}
        {message ? (
          <AppText variant="callout" color="secondary">
            {message}
          </AppText>
        ) : null}
      </Card>
    </AgentTestId>
  );
}

function BackupDestinationCard({
  icon,
  title,
  caption,
  badge,
  testID,
  children,
}: {
  icon: AppIconName;
  title: string;
  caption: string;
  badge?: ReactNode;
  testID: string;
  children: ReactNode;
}) {
  const theme = useTheme();
  const { spacing, s } = useResponsive();
  const well = Math.max(44, s(44));
  return (
    <AgentTestId testID={testID} label={title}>
      <Card style={{ gap: spacing.md }}>
        <View style={[styles.header, { gap: spacing.sm }]}>
          <GlassIconWell size={well} borderRadius={s(14)}>
            <Symbol name={icon} size={s(22)} color={theme.accentPrimary} />
          </GlassIconWell>
          <View style={styles.copy}>
            <View style={[styles.titleRow, { gap: spacing.sm }]}>
              <AppText variant="subheading" fit numberOfLines={1} style={styles.copy}>
                {title}
              </AppText>
              {badge}
            </View>
            <AppText variant="caption" color="secondary" numberOfLines={2}>
              {caption}
            </AppText>
          </View>
        </View>
        {children}
      </Card>
    </AgentTestId>
  );
}

export function BackupDeviceCard({
  disabled,
  downloading,
  onDownload,
  onRestoreFile,
}: {
  disabled: boolean;
  downloading: boolean;
  onDownload: () => void;
  onRestoreFile: () => void;
}) {
  return (
    <BackupDestinationCard
      icon="download"
      title="On This Device"
      caption="Save through the share sheet — Files, AirDrop, or a folder you choose. Photos, videos, and voice notes are included."
      testID={AgentUiIds.backup.sectionDevice}>
      <Button
        icon="download"
        testID={AgentUiIds.backup.download}
        disabled={disabled}
        onPress={onDownload}
        accessibilityLabel="Download Backup">
        {downloading ? 'Preparing Backup…' : 'Download Backup'}
      </Button>
      <Button
        variant="ghost"
        testID={AgentUiIds.backup.restoreFile}
        disabled={disabled}
        onPress={onRestoreFile}
        accessibilityLabel="Restore from File">
        Restore from File
      </Button>
    </BackupDestinationCard>
  );
}

export function BackupDriveCard({
  connected,
  email,
  lastBackupAt,
  isGuest,
  disabled,
  busy,
  onConnect,
  onSave,
  onRestoreDrive,
  onDisconnect,
}: {
  connected: boolean;
  email?: string;
  lastBackupAt?: string;
  isGuest: boolean;
  disabled: boolean;
  busy?: 'connect' | 'save' | 'restore' | 'disconnect';
  onConnect: () => void;
  onSave: () => void;
  onRestoreDrive: () => void;
  onDisconnect: () => void;
}) {
  const saved = formatBackupTime(lastBackupAt);
  const caption = connected
    ? (email ?? 'Google Drive is ready')
    : isGuest
      ? 'Sign in to save backups to Google Drive'
      : 'Connect one Google account';

  return (
    <BackupDestinationCard
      icon="upload"
      title="Google Drive"
      caption={caption}
      badge={
        <StatusBadge
          label={connected ? 'Connected' : 'Off'}
          tone={connected ? 'success' : 'neutral'}
          showDot
        />
      }
      testID={AgentUiIds.backup.sectionDrive}>
      {saved ? (
        <AppText variant="caption" color="tertiary">
          Last saved {saved}
        </AppText>
      ) : null}
      {connected ? (
        <Button
          icon="upload"
          testID={AgentUiIds.backup.saveDrive}
          disabled={disabled}
          onPress={onSave}
          accessibilityLabel="Save Backup to Google Drive">
          {busy === 'save' ? 'Saving to Drive…' : 'Save to Google Drive'}
        </Button>
      ) : (
        <Button
          testID={AgentUiIds.backup.connectDrive}
          disabled={disabled}
          loading={busy === 'connect'}
          onPress={onConnect}
          accessibilityLabel="Connect Google Drive">
          {busy === 'connect' ? 'Connecting…' : isGuest ? 'Sign In to Connect' : 'Connect Google Drive'}
        </Button>
      )}
      {connected ? (
        <Button
          variant="secondary"
          testID={AgentUiIds.backup.restoreDrive}
          disabled={disabled}
          onPress={onRestoreDrive}
          accessibilityLabel="Restore from Google Drive">
          {busy === 'restore' ? 'Loading Backups…' : 'Restore from Google Drive'}
        </Button>
      ) : null}
      {connected ? (
        <Button
          variant="ghost"
          testID={AgentUiIds.backup.disconnectDrive}
          disabled={disabled}
          onPress={onDisconnect}
          accessibilityLabel="Disconnect Google Drive">
          Disconnect Google Drive
        </Button>
      ) : null}
    </BackupDestinationCard>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center' },
  titleRow: { flexDirection: 'row', alignItems: 'center' },
  copy: { flex: 1, minWidth: 0 },
});
