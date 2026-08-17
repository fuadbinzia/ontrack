import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';

import {
    appPrompt,
    HeaderBackButton,
    Screen,
    ScreenHeader,
    SettingsGroup,
    SettingsToggleRow,
} from '@/components/primitives';
import { restoreBackup } from '@/features/account/backup-actions';
import {
    BackupDeviceCard,
    BackupDriveCard,
    BackupStatusNotice,
    formatBackupTime,
} from '@/features/account/backup-screen-panels';
import { downloadBackup, pickBackupFile, writeBackupFile } from '@/features/account/backup-share';
import { useAuthSession } from '@/features/auth/auth-provider';
import { useResponsive } from '@/hooks/use-responsive';
import {
    connectGoogleDriveBackup,
    disconnectGoogleDriveBackup,
    getGoogleDriveBackupStatus,
    GoogleDriveBackupError,
    googleDriveBackupErrorMessage,
    googleDriveConnectErrorMessage,
    googleDriveUploadSession,
    isGoogleDriveAuthError,
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

export default function BackupScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ driveConnected?: string; driveError?: string }>();
  const { isGuest } = useAuthSession();
  const { spacing } = useResponsive();
  const [status, setStatus] = useState<GoogleDriveBackupStatus>({ connected: false });
  const [includeSensitiveLocal, setIncludeSensitiveLocal] = useState(false);
  const [busy, setBusy] = useState<'download' | 'connect' | 'save' | 'restore' | 'disconnect'>();
  const [message, setMessage] = useState<string>();
  const [error, setError] = useState<string>();

  const refreshStatus = useCallback(async () => {
    if (isGuest) return;
    try {
      setStatus(await getGoogleDriveBackupStatus());
    } catch (caught) {
      setError(googleDriveConnectErrorMessage(caught));
    }
  }, [isGuest]);

  useEffect(() => { void refreshStatus(); }, [refreshStatus]);
  useEffect(() => {
    if (typeof params.driveError === 'string') {
      setError(googleDriveConnectErrorMessage(new Error(params.driveError)));
    }
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
      if (caught instanceof GoogleDriveBackupError && caught.code === 'CANCELLED') return;
      const text = googleDriveConnectErrorMessage(caught);
      setError(text);
      appPrompt.alert('Google Drive', text);
    } finally {
      setBusy(undefined);
    }
  };

  const runDownload = async () => {
    setBusy('download');
    setMessage(undefined);
    setError(undefined);
    try {
      const { name } = await downloadBackup({ includeSensitiveLocal });
      setMessage(`Backup ready · ${name}`);
    } catch (caught) {
      setError(googleDriveBackupErrorMessage(caught, 'Backup could not be downloaded.'));
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
            setError(googleDriveBackupErrorMessage(caught, 'Backup could not be restored.'));
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
      setError(googleDriveBackupErrorMessage(caught, 'Backup file could not be read.'));
    }
  };

  const runSaveToDrive = async () => {
    setBusy('save');
    setMessage(undefined);
    setError(undefined);
    try {
      const session = await googleDriveUploadSession();
      let existing: GoogleDriveBackupFile[] = [];
      try {
        existing = await listGoogleDriveBackups(session.accessToken, session.folderId);
      } catch (caught) {
        if (isGoogleDriveAuthError(caught)) throw caught;
      }
      const previous = existing[0];
      if (!previous) {
        await saveBackupToDrive(session);
        return;
      }
      setBusy(undefined);
      appPrompt.alert(
        'Save to Google Drive?',
        `A backup is already in Drive (${previous.name}). Overwrite that copy, or keep it and save a new one?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Save as New',
            testID: AgentUiIds.backup.saveNew,
            onPress: () => { void saveBackupToDrive(session); },
          },
          {
            text: 'Overwrite Previous',
            testID: AgentUiIds.backup.saveOverwrite,
            onPress: () => { void saveBackupToDrive(session, previous.id); },
          },
        ],
      );
    } catch (caught) {
      setError(googleDriveBackupErrorMessage(caught, 'Backup could not be saved to Google Drive.'));
      setBusy(undefined);
    }
  };

  const saveBackupToDrive = async (
    session: Awaited<ReturnType<typeof googleDriveUploadSession>>,
    fileId?: string,
  ) => {
    setBusy('save');
    setMessage(undefined);
    setError(undefined);
    try {
      const { name, json } = await writeBackupFile(undefined, { includeSensitiveLocal });
      await uploadBackupToGoogleDrive({
        accessToken: session.accessToken,
        folderId: session.folderId,
        name,
        json,
        fileId,
      });
      const complete = await markGoogleDriveBackupComplete();
      setStatus((current) => ({ ...current, connected: true, lastBackupAt: complete.lastBackupAt }));
      setMessage(fileId ? `Replaced the previous Drive backup · ${name}` : `Saved to Google Drive · ${name}`);
    } catch (caught) {
      setError(googleDriveBackupErrorMessage(caught, 'Backup could not be saved to Google Drive.'));
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
      const files = await listGoogleDriveBackups(session.accessToken, session.folderId);
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
      setError(googleDriveBackupErrorMessage(caught, 'Google Drive backups could not be loaded.'));
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
            setError(googleDriveBackupErrorMessage(caught, 'Google Drive disconnect failed.'));
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
          subtitle="A private copy of this device — photos, videos, and your customizations. Health and Journal stay off unless you include them."
          leading={
            <HeaderBackButton
              compact
              accessibilityLabel="Back to profile"
              fallback="/(tabs)/profile"
            />
          }
        />
      </AgentTestId>

      <BackupStatusNotice error={error} message={message} />

      <SettingsGroup>
        <SettingsToggleRow
          label="Include Health & Journal"
          detail="The backup file is not encrypted. Leave this off unless you need those pages on another device."
          icon="shield"
          value={includeSensitiveLocal}
          onValueChange={setIncludeSensitiveLocal}
          testID={AgentUiIds.backup.includeSensitive}
        />
      </SettingsGroup>

      <BackupDeviceCard
        disabled={disabled}
        downloading={busy === 'download'}
        onDownload={() => void runDownload()}
        onRestoreFile={() => void runRestoreFile()}
      />

      <BackupDriveCard
        connected={status.connected}
        email={status.email}
        lastBackupAt={status.lastBackupAt}
        isGuest={isGuest}
        disabled={disabled}
        busy={busy === 'connect' || busy === 'save' || busy === 'restore' || busy === 'disconnect' ? busy : undefined}
        onConnect={() => void runConnect()}
        onSave={() => void runSaveToDrive()}
        onRestoreDrive={() => void runRestoreFromDrive()}
        onDisconnect={runDisconnect}
      />
    </Screen>
  );
}
