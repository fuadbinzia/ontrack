import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import {
  appPrompt,
  AppText,
  Button,
  Card,
  ErrorMessage,
  HeaderBackButton,
  Screen,
  ScreenHeader,
  SectionHeader,
  StatusBadge,
} from '@/components/primitives';
import { restoreBackup } from '@/features/account/backup-actions';
import { downloadBackup, pickBackupFile, writeBackupFile } from '@/features/account/backup-share';
import { useAuthSession } from '@/features/auth/auth-provider';
import { useResponsive } from '@/hooks/use-responsive';
import {
  connectGoogleDriveBackup,
  disconnectGoogleDriveBackup,
  getGoogleDriveBackupStatus,
  googleDriveUploadSession,
  markGoogleDriveBackupComplete,
  type GoogleDriveBackupFile,
  type GoogleDriveBackupStatus,
} from '@/services/backup/google-drive-client';
import {
  downloadGoogleDriveBackup,
  listGoogleDriveBackups,
  uploadBackupToGoogleDrive,
} from '@/services/backup/google-drive-upload';
import { AgentTestId, AgentUiIds } from '@/utils/agent-ui';
import { confirmDestructiveAction } from '@/utils/confirm-destructive';

function formatBackupTime(value?: string) {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date.toLocaleString();
}

export default function BackupScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ driveConnected?: string; driveError?: string }>();
  const { isGuest } = useAuthSession();
  const { spacing } = useResponsive();
  const [status, setStatus] = useState<GoogleDriveBackupStatus>({ connected: false });
  const [statusLoaded, setStatusLoaded] = useState(false);
  const [busy, setBusy] = useState<'download' | 'connect' | 'save' | 'restore' | 'disconnect'>();
  const [message, setMessage] = useState<string>();
  const [error, setError] = useState<string>();

  const refreshStatus = useCallback(async () => {
    if (isGuest) {
      setStatusLoaded(true);
      return;
    }
    try {
      setStatus(await getGoogleDriveBackupStatus());
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Google Drive status could not be loaded.');
    } finally {
      setStatusLoaded(true);
    }
  }, [isGuest]);

  useEffect(() => { void refreshStatus(); }, [refreshStatus]);
  useEffect(() => {
    if (typeof params.driveError === 'string') setError(params.driveError);
    if (params.driveConnected === '1') {
      setMessage('Google Drive connected. Save a backup whenever you like.');
      void refreshStatus();
    }
  }, [params.driveConnected, params.driveError, refreshStatus]);

  const runConnect = async () => {
    if (isGuest) {
      router.push('/account?returnTo=/(tabs)/profile/backup' as never);
      return;
    }
    setBusy('connect');
    setMessage(undefined);
    setError(undefined);
    try {
      await connectGoogleDriveBackup();
      await refreshStatus();
      setMessage('Google Drive connected. Save a backup whenever you like.');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Google Drive could not connect.');
    } finally {
      setBusy(undefined);
    }
  };

  const runDownload = async () => {
    setBusy('download');
    setMessage(undefined);
    setError(undefined);
    try {
      const { name } = await downloadBackup();
      setMessage(`Backup ready · ${name}`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Backup could not be downloaded.');
    } finally {
      setBusy(undefined);
    }
  };

  const confirmRestore = (backupLabel: string, restore: () => Promise<void>) => {
    confirmDestructiveAction({
      title: 'Restore This Backup?',
      message: `This replaces the onTrack data on this device with ${backupLabel}. Your account stays signed in. This cannot be undone.`,
      actionLabel: 'Restore',
      confirmTestID: AgentUiIds.backup.confirmRestore,
      onConfirm: () => {
        void (async () => {
          setBusy('restore');
          setMessage(undefined);
          setError(undefined);
          try {
            await restore();
            setMessage('Backup restored on this device.');
          } catch (caught) {
            setError(caught instanceof Error ? caught.message : 'Backup could not be restored.');
          } finally {
            setBusy(undefined);
          }
        })();
      },
    });
  };

  const runRestoreFile = async () => {
    setError(undefined);
    setMessage(undefined);
    try {
      const backup = await pickBackupFile();
      if (!backup) return;
      confirmRestore(
        `the copy from ${formatBackupTime(backup.createdAt) ?? 'this file'}`,
        () => restoreBackup(backup, { pushCloud: !isGuest }),
      );
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Backup file could not be read.');
    }
  };

  const runSaveToDrive = async () => {
    setBusy('save');
    setMessage(undefined);
    setError(undefined);
    try {
      const session = await googleDriveUploadSession();
      const { name, json } = await writeBackupFile();
      await uploadBackupToGoogleDrive({
        accessToken: session.accessToken,
        folderId: session.folderId,
        name,
        json,
      });
      const complete = await markGoogleDriveBackupComplete();
      setStatus((current) => ({ ...current, connected: true, lastBackupAt: complete.lastBackupAt }));
      setMessage(`Saved to Google Drive · ${name}`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Backup could not be saved to Google Drive.');
    } finally {
      setBusy(undefined);
    }
  };

  const restoreDriveFile = (file: GoogleDriveBackupFile, accessToken: string) => {
    confirmRestore(
      file.name,
      async () => {
        const backup = await downloadGoogleDriveBackup(accessToken, file.id);
        await restoreBackup(backup, { pushCloud: !isGuest });
      },
    );
  };

  const runRestoreFromDrive = async () => {
    setBusy('restore');
    setMessage(undefined);
    setError(undefined);
    try {
      const session = await googleDriveUploadSession();
      const files = await listGoogleDriveBackups(session.accessToken);
      if (!files.length) {
        setMessage('No onTrack backups were found in Google Drive.');
        return;
      }
      appPrompt.alert(
        'Restore from Google Drive',
        'Choose a backup saved by onTrack. Restoring replaces the data on this device.',
        files.slice(0, 5).map((file) => ({
          text: file.name,
          onPress: () => restoreDriveFile(file, session.accessToken),
        })),
      );
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Google Drive backups could not be loaded.');
    } finally {
      setBusy(undefined);
    }
  };

  const runDisconnect = () => {
    confirmDestructiveAction({
      title: 'Disconnect Google Drive?',
      message: 'onTrack will stop saving backups to Drive. Files already in your onTrack Backups folder stay in Google Drive.',
      actionLabel: 'Disconnect',
      confirmTestID: AgentUiIds.backup.confirmDisconnect,
      onConfirm: () => {
        void (async () => {
          setBusy('disconnect');
          setMessage(undefined);
          setError(undefined);
          try {
            await disconnectGoogleDriveBackup();
            setStatus({ connected: false });
            setMessage('Google Drive disconnected. Existing backups were kept.');
          } catch (caught) {
            setError(caught instanceof Error ? caught.message : 'Google Drive disconnect failed.');
          } finally {
            setBusy(undefined);
          }
        })();
      },
    });
  };

  const disabled = Boolean(busy);

  return (
    <Screen refresh={false} contentStyle={{ gap: spacing.lg }}>
      <AgentTestId testID={AgentUiIds.backup.screen} label="Your backup" style={{ gap: spacing.md }}>
        <ScreenHeader
          eyebrow="Profile"
          title="Your Backup"
          subtitle="Keep a copy on this device or in your Google Drive. Journal, Health, and finance records are included. Photos and voice notes stay as links to files already on this phone."
          leading={
            <HeaderBackButton
              compact
              accessibilityLabel="Back to profile"
              fallback="/(tabs)/profile"
            />
          }
        />
      </AgentTestId>

      <SectionHeader title="Download" />
      <Card style={{ gap: spacing.md }}>
        <AppText color="secondary">
          Save a JSON file through the share sheet — Files, AirDrop, or another folder you choose.
        </AppText>
        <Button
          testID={AgentUiIds.backup.download}
          disabled={disabled}
          onPress={() => void runDownload()}
          accessibilityLabel="Download Backup">
          {busy === 'download' ? 'Preparing Backup…' : 'Download Backup'}
        </Button>
      </Card>

      <SectionHeader title="Google Drive" />
      <Card style={{ gap: spacing.md }}>
        <View style={styles.row}>
          <View style={styles.copy}>
            <AppText variant="subheading" fit>
              {status.connected ? 'Connected' : 'Not Connected'}
            </AppText>
            <AppText variant="caption" color="secondary" numberOfLines={2}>
              {status.email ?? (isGuest ? 'Sign in to save backups to Google Drive' : 'Connect one Google account')}
            </AppText>
          </View>
          <StatusBadge
            label={status.connected ? 'On' : 'Off'}
            tone={status.connected ? 'success' : 'neutral'}
          />
        </View>
        {status.lastBackupAt ? (
          <AppText variant="caption" color="tertiary">
            Last saved {formatBackupTime(status.lastBackupAt)}
          </AppText>
        ) : null}
        {status.connected ? (
          <Button
            testID={AgentUiIds.backup.saveDrive}
            disabled={disabled}
            onPress={() => void runSaveToDrive()}
            accessibilityLabel="Save Backup to Google Drive">
            {busy === 'save' ? 'Saving to Drive…' : 'Save to Google Drive'}
          </Button>
        ) : (
          <Button
            testID={AgentUiIds.backup.connectDrive}
            disabled={disabled || !statusLoaded}
            onPress={() => void runConnect()}
            accessibilityLabel="Connect Google Drive">
            {busy === 'connect' ? 'Connecting…' : isGuest ? 'Sign In to Connect' : 'Connect Google Drive'}
          </Button>
        )}
        {status.connected ? (
          <Button
            variant="secondary"
            testID={AgentUiIds.backup.disconnectDrive}
            disabled={disabled}
            onPress={runDisconnect}
            accessibilityLabel="Disconnect Google Drive">
            Disconnect Google Drive
          </Button>
        ) : null}
      </Card>

      <SectionHeader title="Restore" />
      <Card style={{ gap: spacing.md }}>
        <AppText color="secondary">
          Restoring replaces the data on this device with the copy you choose.
        </AppText>
        <Button
          variant="secondary"
          testID={AgentUiIds.backup.restoreFile}
          disabled={disabled}
          onPress={() => void runRestoreFile()}
          accessibilityLabel="Restore from File">
          Restore from File
        </Button>
        {status.connected ? (
          <Button
            variant="secondary"
            testID={AgentUiIds.backup.restoreDrive}
            disabled={disabled}
            onPress={() => void runRestoreFromDrive()}
            accessibilityLabel="Restore from Google Drive">
            {busy === 'restore' ? 'Loading Backups…' : 'Restore from Google Drive'}
          </Button>
        ) : null}
      </Card>

      {error ? <ErrorMessage message={error} variant="caption" /> : null}
      {message ? <AppText variant="caption" color="secondary">{message}</AppText> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  copy: { flex: 1, minWidth: 0 },
});
