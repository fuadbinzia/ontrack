import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect } from 'react';
import { View } from 'react-native';

import { LoadingBlock } from '@/components/primitives';
import { isAgentUiEnabled } from '@/utils/agent-ui';

/**
 * Cold-start fallback for agent dump/tap/exists ops.
 * Prefer the root Linking listener (keeps the current screen mounted).
 * Host scripts open `ontrack:///agent/ui?op=dump|tap|exists&id=…`.
 */
export default function AgentUiRoute() {
  const router = useRouter();
  const params = useLocalSearchParams<{ op?: string; id?: string }>();

  useEffect(() => {
    if (!__DEV__) return;
    let active = true;
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { getLastAgentUiContentRoute } =
      require('@/utils/agent-ui/route') as typeof import('@/utils/agent-ui/route');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { handleAgentUiRequest } =
      require('@/utils/agent-ui/handle-agent-ui-url') as typeof import('@/utils/agent-ui/handle-agent-ui-url');
    const returnTo = getLastAgentUiContentRoute() ?? '/';
    // Linking listener usually handles this first; re-run is idempotent for dump/exists.
    void handleAgentUiRequest(params).finally(() => {
      if (!active) return;
      // A pressed control may navigate. Give that navigation a frame to become
      // the latest content route; otherwise restore the route that initiated the op.
      setTimeout(() => {
        if (!active) return;
        router.replace((getLastAgentUiContentRoute() ?? returnTo) as never);
      }, 100);
    });
    return () => {
      active = false;
    };
  }, [params, router]);

  if (!__DEV__ || !isAgentUiEnabled()) {
    return <Redirect href="/" />;
  }

  return (
    <View style={{ flex: 1, justifyContent: 'center' }}>
      <LoadingBlock />
    </View>
  );
}
