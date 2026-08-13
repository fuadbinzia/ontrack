import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
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
  SegmentedControl,
  SectionHeader,
  StatusBadge,
} from '@/components/primitives';
import { useAuthSession } from '@/features/auth/auth-provider';
import { CalendarSyncReview } from '@/features/calendar/calendar-sync-review';
import { useResponsive } from '@/hooks/use-responsive';
import {
  connectGoogleCalendar,
  disconnectGoogleCalendar,
  getGoogleCalendarBackgroundSyncState,
  getGoogleCalendarStatus,
  GoogleCalendarError,
  googleCalendarReviewErrorMessage,
  previewGoogleCalendarSync,
  setGoogleCalendarDirection,
  startGoogleCalendarBackgroundSync,
  subscribeToGoogleCalendarBackgroundSync,
} from '@/services/calendar/google-client';
import type { GoogleCalendarStatus, GoogleCalendarSyncDirection } from '@/services/calendar/google-types';
import { AgentTestId, AgentUiIds } from '@/utils/agent-ui';
import { confirmDestructiveAction } from '@/utils/confirm-destructive';

export default function CalendarSyncScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ calendarConnected?: string; calendarError?: string }>();
  const { isGuest } = useAuthSession();
  const { spacing } = useResponsive();
  const [status, setStatus] = useState<GoogleCalendarStatus>({ connected: false, direction: 'two_way' });
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [changingDirection, setChangingDirection] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [message, setMessage] = useState<string>();
  const [error, setError] = useState<string>();
  const [needsReconnect, setNeedsReconnect] = useState(false);
  const backgroundSync = useSyncExternalStore(
    subscribeToGoogleCalendarBackgroundSync,
    getGoogleCalendarBackgroundSyncState,
    getGoogleCalendarBackgroundSyncState,
  );

  const refreshStatus = useCallback(async () => {
    if (isGuest) return;
    try { setStatus(await getGoogleCalendarStatus()); }
    catch (caught) { setError(caught instanceof Error ? caught.message : 'Calendar status could not be loaded.'); }
  }, [isGuest]);

  useEffect(() => { void refreshStatus(); }, [refreshStatus]);
  useEffect(() => {
    if (typeof params.calendarError === 'string') setError(params.calendarError);
    if (params.calendarConnected === '1') {
      setMessage('Google Calendar connected. Tap Sync Now when you are ready.');
      void refreshStatus();
    }
  }, [params.calendarConnected, params.calendarError, refreshStatus]);

  const runConnect = async () => {
    if (isGuest) { router.push('/account?returnTo=/(tabs)/profile/calendar-sync' as never); return; }
    setConnecting(true); setMessage(undefined); setError(undefined); setNeedsReconnect(false);
    try {
      await connectGoogleCalendar();
      await refreshStatus();
      setMessage('Google Calendar connected. Tap Sync Now when you are ready.');
    }
    catch (caught) { setError(caught instanceof Error ? caught.message : 'Google Calendar could not connect.'); }
    finally { setConnecting(false); }
  };

  function runSync() {
    setMessage(undefined); setError(undefined); setNeedsReconnect(false);
    return (async () => {
      try {
        const result = await startGoogleCalendarBackgroundSync({ notifyWhenComplete: true });
        setStatus((current) => ({ ...current, connected: true, lastSyncedAt: result.lastSyncedAt }));
      } catch (caught) {
        setNeedsReconnect(caught instanceof GoogleCalendarError && caught.code === 'RECONNECT_REQUIRED');
      }
    })();
  }

  const reviewSync = async () => {
    setPreviewing(true); setMessage(undefined); setError(undefined); setNeedsReconnect(false);
    try {
      const preview = await previewGoogleCalendarSync();
      if (!preview.changes.length) {
        appPrompt.alert('Everything is up to date', 'No changes need to be synced.');
        return;
      }
      appPrompt.alert(
        'Review Sync Changes',
        undefined,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Sync Changes',
            style: 'primary',
            testID: AgentUiIds.calendarSync.confirmSync,
            onPress: () => void runSync(),
          },
        ],
        {
          content: <CalendarSyncReview preview={preview} />,
          scrollableMessage: true,
        },
      );
    } catch (caught) {
      setError(googleCalendarReviewErrorMessage(caught));
      setNeedsReconnect(caught instanceof GoogleCalendarError && caught.code === 'RECONNECT_REQUIRED');
    } finally {
      setPreviewing(false);
    }
  };

  const syncProgress = backgroundSync.progress?.phase === 'pull'
    ? 'Reading Google events…'
    : backgroundSync.progress?.changedEvents
      ? `Applying changes · ${backgroundSync.progress.changedEvents}`
      : 'Applying changes…';
  const primaryControlsDisabled = connecting || disconnecting || changingDirection || previewing || backgroundSync.running;
  const disconnectControlsDisabled = connecting || disconnecting || changingDirection || previewing;

  const changeDirection = async (direction: GoogleCalendarSyncDirection) => {
    if (direction === status.direction) return;
    setChangingDirection(true); setMessage(undefined); setError(undefined);
    try {
      await setGoogleCalendarDirection(direction);
      setStatus((current) => ({ ...current, direction, lastSyncedAt: undefined }));
      setMessage('Sync direction saved. Tap Sync Now to apply pending changes.');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Calendar sync direction could not be changed.');
    } finally {
      setChangingDirection(false);
    }
  };

  const disconnect = (removeData: boolean) => {
    const action = async () => {
      setDisconnecting(true); setMessage(undefined); setError(undefined);
      try {
        if (backgroundSync.running) await startGoogleCalendarBackgroundSync();
        await disconnectGoogleCalendar({ removeImported: removeData, removeExported: removeData });
        setStatus({ connected: false, direction: 'two_way' });
        setMessage(removeData ? 'Disconnected and removed synced copies.' : 'Disconnected. Existing events were kept.');
      } catch (caught) { setError(caught instanceof Error ? caught.message : 'Calendar disconnect failed.'); }
      finally { setDisconnecting(false); }
    };
    if (!removeData) {
      appPrompt.alert('Disconnect Google Calendar?', 'Two-way updates will stop. Existing events stay in both calendars.', [
        { text: 'Disconnect', style: 'destructive', onPress: () => void action() },
      ]);
      return;
    }
    confirmDestructiveAction({
      title: 'Remove synced copies?',
      message: 'Are you sure? Google events imported into onTrack will be removed here, and onTrack events exported to Google will be removed there. Original events stay in their original calendar. Any active sync will finish first.',
      actionLabel: 'Yes, Disconnect & Remove',
      confirmTestID: AgentUiIds.calendarSync.confirmDisconnectRemove,
      onConfirm: () => void action(),
    });
  };

  return (
    <Screen refresh={false} contentStyle={{ gap: spacing.lg }}>
      <AgentTestId testID={AgentUiIds.calendarSync.screen} label="Google Calendar sync" style={{ gap: spacing.md }}>
        <ScreenHeader
          eyebrow="Profile"
          title="Google Calendar"
          subtitle="Choose whether events flow both ways, only to Google, or only from Google. Event titles, notes, dates, times, updates, and deletions are included."
          leading={
            <HeaderBackButton
              compact
              accessibilityLabel="Back to profile"
              fallback="/(tabs)/profile"
            />
          }
        />
      </AgentTestId>

      <SectionHeader title="Connection" />
      <Card style={{ gap: spacing.md }}>
        <View style={styles.row}>
          <View style={styles.copy}>
            <AppText variant="subheading" fit>{status.connected ? 'Connected' : 'Not connected'}</AppText>
            <AppText variant="caption" color="secondary" numberOfLines={2}>{status.email ?? (isGuest ? 'An onTrack account is required' : 'Connect one Google account')}</AppText>
          </View>
          <StatusBadge
            label={status.connected
              ? status.direction === 'two_way' ? 'Two-Way' : status.direction === 'to_google' ? 'To Google' : 'From Google'
              : 'Off'}
            tone={status.connected ? 'success' : 'neutral'}
          />
        </View>
        {status.connected ? (
          <SegmentedControl<GoogleCalendarSyncDirection>
            label="Sync direction"
            value={status.direction}
            options={[
              { value: 'two_way', label: 'Two-Way', disabled: primaryControlsDisabled, testID: AgentUiIds.calendarSync.direction('twoWay') },
              { value: 'to_google', label: 'To Google', disabled: primaryControlsDisabled, testID: AgentUiIds.calendarSync.direction('toGoogle') },
              { value: 'from_google', label: 'From Google', disabled: primaryControlsDisabled, testID: AgentUiIds.calendarSync.direction('fromGoogle') },
            ]}
            onChange={(direction) => void changeDirection(direction)}
          />
        ) : null}
        {status.connected ? (
          <AppText variant="caption" color="secondary">
            {status.direction === 'two_way'
              ? 'Changes made in either calendar sync to the other.'
              : status.direction === 'to_google'
                ? 'onTrack changes go to Google. Google-only changes are not imported.'
                : 'Google additions and updates come into onTrack. Nothing is removed or exported.'}
          </AppText>
        ) : null}
        {status.lastSyncedAt ? <AppText variant="caption" color="tertiary">Last synced {new Date(status.lastSyncedAt).toLocaleString()}</AppText> : null}
        {status.connected && needsReconnect ? (
          <Button testID={AgentUiIds.calendarSync.reconnect} disabled={primaryControlsDisabled} onPress={() => void runConnect()} accessibilityLabel="Reconnect Google Calendar">{connecting ? 'Reconnecting…' : 'Reconnect Google Calendar'}</Button>
        ) : status.connected ? (
          <Button testID={AgentUiIds.calendarSync.sync} disabled={primaryControlsDisabled} onPress={() => void reviewSync()} accessibilityLabel="Review Google Calendar sync changes">{backgroundSync.running ? syncProgress : previewing ? 'Reviewing Changes…' : 'Sync Now'}</Button>
        ) : (
          <Button testID={AgentUiIds.calendarSync.connect} disabled={primaryControlsDisabled} onPress={() => void runConnect()} accessibilityLabel="Connect Google Calendar">{connecting ? 'Connecting…' : isGuest ? 'Sign In to Connect' : 'Connect Google Calendar'}</Button>
        )}
        {backgroundSync.running ? <AppText variant="caption" color="secondary">You can leave this page. Sync will continue, and onTrack will alert you when it finishes.</AppText> : null}
        {error ? <ErrorMessage message={error} variant="caption" /> : null}
        {message ? <AppText variant="caption" color="secondary">{message}</AppText> : null}
      </Card>

      {status.connected ? (
        <>
          <SectionHeader title="Disconnect" />
          <Card style={{ gap: spacing.md }}>
            <AppText color="secondary">Choose whether synced copies remain after calendar updates stop.</AppText>
            <Button variant="secondary" testID={AgentUiIds.calendarSync.disconnectKeep} disabled={disconnectControlsDisabled} onPress={() => disconnect(false)} accessibilityLabel="Disconnect and keep all events">Disconnect & Keep Events</Button>
            <Button variant="danger" testID={AgentUiIds.calendarSync.disconnectRemove} disabled={disconnectControlsDisabled} onPress={() => disconnect(true)} accessibilityLabel="Disconnect and remove imported and exported copies">{disconnecting ? 'Disconnecting…' : 'Disconnect & Remove Synced Copies'}</Button>
          </Card>
        </>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({ row: { flexDirection: 'row', alignItems: 'center' }, copy: { flex: 1, minWidth: 0 } });
