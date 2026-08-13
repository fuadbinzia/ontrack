import type { ErrorBoundaryProps } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { typeConfig } from '@/design-system/typography';
import { AgentUiIds } from '@/utils/agent-ui/ids';
import { useAgentUiTarget } from '@/utils/agent-ui/use-agent-ui-target';
import { sendCrashReport } from '@/utils/crash-report';

/**
 * Recoverable route shell so render/HMR failures never leave a blank white screen.
 * Intentionally avoids app primitives (Button/useTheme) so a broken module graph
 * cannot cascade into a second crash inside the boundary.
 */
export function RouteErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [sendHint, setSendHint] = useState<string | undefined>();

  const onSendCrashReport = useCallback(() => {
    if (sending || sent) return;
    setSending(true);
    setSendHint(undefined);
    void sendCrashReport({ error })
      .then((result) => {
        if (result.method === 'unavailable') {
          setSendHint(result.reason);
          return;
        }
        setSent(true);
        setSendHint(
          'Thank you. We received the report and will review the issue promptly.',
        );
      })
      .catch(() => {
        setSendHint(
          'We could not send the report. Check your connection and try again.',
        );
      })
      .finally(() => {
        setSending(false);
      });
  }, [error, sending, sent]);
  const onRetry = useCallback(() => void retry(), [retry]);
  const retryTarget = useAgentUiTarget(AgentUiIds.errorBoundary.retry, {
    label: 'Retry loading screen',
    onPress: onRetry,
  });
  const sendReportTarget = useAgentUiTarget(
    AgentUiIds.errorBoundary.sendReport,
    {
      label: sent ? 'Crash report sent' : 'Send crash report',
      onPress: onSendCrashReport,
    },
  );

  return (
    <View style={styles.root} testID={AgentUiIds.errorBoundary.root}>
      <Text style={styles.title}>Something went wrong</Text>
      <Text style={styles.message}>
        {error.message || 'The screen failed to load. Try again.'}
      </Text>
      <Pressable
        ref={retryTarget.ref}
        onLayout={retryTarget.onLayout}
        accessibilityRole="button"
        accessibilityLabel="Retry loading screen"
        testID={retryTarget.testID}
        onPress={onRetry}
        style={({ pressed }) => [styles.retry, pressed && styles.retryPressed]}>
        <Text style={styles.retryLabel}>Try again</Text>
      </Pressable>
      <Pressable
        ref={sendReportTarget.ref}
        onLayout={sendReportTarget.onLayout}
        accessibilityRole="button"
        accessibilityLabel={sent ? 'Crash report sent' : 'Send crash report'}
        testID={sendReportTarget.testID}
        disabled={sending || sent}
        onPress={onSendCrashReport}
        style={({ pressed }) => [
          styles.send,
          (pressed || sending || sent) && styles.sendPressed,
        ]}>
        <Text style={styles.sendLabel}>
          {sending ? 'Sending report…' : sent ? 'Report sent' : 'Send crash report'}
        </Text>
      </Pressable>
      {sendHint ? (
        <Text
          accessibilityLiveRegion="polite"
          testID={AgentUiIds.errorBoundary.reportStatus}
          style={styles.hint}>
          {sendHint}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    padding: 24,
    backgroundColor: '#F7F3EC',
  },
  title: {
    fontFamily: typeConfig.fontFamily,
    fontSize: 22,
    fontWeight: typeConfig.weight.regular,
    color: '#1B1815',
    textAlign: 'center',
  },
  message: {
    fontFamily: typeConfig.fontFamily,
    fontSize: 15,
    lineHeight: 21,
    fontWeight: typeConfig.weight.regular,
    color: '#6B645C',
    textAlign: 'center',
  },
  retry: {
    marginTop: 8,
    minHeight: 44,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 999,
    backgroundColor: '#1B1815',
    alignItems: 'center',
    justifyContent: 'center',
  },
  retryPressed: {
    opacity: 0.75,
  },
  retryLabel: {
    fontFamily: typeConfig.fontFamily,
    fontSize: 15,
    fontWeight: typeConfig.weight.regular,
    color: '#F7F3EC',
  },
  send: {
    minHeight: 44,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#1B1815',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendPressed: {
    opacity: 0.75,
  },
  sendLabel: {
    fontFamily: typeConfig.fontFamily,
    fontSize: 15,
    fontWeight: typeConfig.weight.regular,
    color: '#1B1815',
  },
  hint: {
    fontFamily: typeConfig.fontFamily,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: typeConfig.weight.regular,
    color: '#6B645C',
    textAlign: 'center',
    marginTop: 4,
  },
});
