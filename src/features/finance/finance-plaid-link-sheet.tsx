import { useCallback, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { WebView, type WebViewNavigation } from 'react-native-webview';

import { AppText, SheetScaffold } from '@/components/primitives';
import { useTheme } from '@/hooks/use-theme';
import { AgentUiIds } from '@/utils/agent-ui';

/**
 * Plaid Link via official WebView HTML endpoint.
 * Success/exit arrive as `plaidlink://…` navigation requests.
 */
export function FinancePlaidLinkSheet({
  visible,
  linkToken,
  onClose,
  onSuccess,
}: {
  visible: boolean;
  linkToken: string | undefined;
  onClose: () => void;
  onSuccess: (publicToken: string) => void;
}) {
  const theme = useTheme();
  const [loading, setLoading] = useState(true);

  const handleNav = useCallback(
    (nav: WebViewNavigation) => {
      const url = nav.url ?? '';
      if (!url.startsWith('plaidlink://')) return true;
      try {
        const parsed = new URL(url);
        const host = parsed.hostname || parsed.host;
        if (host === 'connected' || url.includes('connected')) {
          const publicToken =
            parsed.searchParams.get('public_token') ??
            parsed.searchParams.get('publicToken');
          if (publicToken) {
            onSuccess(publicToken);
            onClose();
          }
        } else {
          onClose();
        }
      } catch {
        onClose();
      }
      return false;
    },
    [onClose, onSuccess],
  );

  const uri = linkToken
    ? `https://cdn.plaid.com/link/v2/stable/link.html?isWebview=true&token=${encodeURIComponent(linkToken)}`
    : undefined;

  return (
    <SheetScaffold
      visible={visible && !!uri}
      onClose={onClose}
      title="Link Account"
      subtitle="Connect a bank or card with Plaid. Tokens stay on this device for sync."
      closeTestID={AgentUiIds.finance.accounts.linkBank}
      minHeight={520}
      lockHeight>
      {!uri ? (
        <AppText variant="caption" color="secondary">
          Missing link token.
        </AppText>
      ) : (
        <View style={styles.wrap}>
          {loading ? (
            <ActivityIndicator color={theme.accentPrimary} style={styles.spinner} />
          ) : null}
          <WebView
            source={{ uri }}
            onLoadEnd={() => setLoading(false)}
            onShouldStartLoadWithRequest={(request) => handleNav(request as WebViewNavigation)}
            onNavigationStateChange={handleNav}
            startInLoadingState
            style={styles.web}
            testID="ontrack.finance.accounts.plaidWeb"
          />
        </View>
      )}
    </SheetScaffold>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, minHeight: 440 },
  web: { flex: 1, backgroundColor: 'transparent' },
  spinner: { position: 'absolute', top: 24, alignSelf: 'center', zIndex: 2 },
});
