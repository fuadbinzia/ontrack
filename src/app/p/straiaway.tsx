import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect } from 'react';
import { Linking, View } from 'react-native';

import { AppText, Button, Screen, ScreenHeader } from '@/components/primitives';
import { useResponsive } from '@/hooks/use-responsive';
import { AgentTestId, AgentUiIds } from '@/utils/agent-ui';

const INSTALLED = 'ontrack://partner/straiaway';
const APP_STORE = 'https://apps.apple.com/app/id6789723522';

/** Universal-link / web landing for StraiAway partner connect. */
export default function StraiawayPartnerLanding() {
  const router = useRouter();
  const { spacing } = useResponsive();
  const params = useLocalSearchParams<{ code?: string; connected?: string; error?: string }>();
  const query = [
    typeof params.code === 'string' ? `code=${encodeURIComponent(params.code)}` : '',
    typeof params.connected === 'string' ? `connected=${encodeURIComponent(params.connected)}` : '',
    typeof params.error === 'string' ? `error=${encodeURIComponent(params.error)}` : '',
  ]
    .filter(Boolean)
    .join('&');
  const installedUrl = `${INSTALLED}${query ? `?${query}` : ''}`;

  useEffect(() => {
    if (params.connected === '1' || params.code) {
      router.replace(`/(tabs)/profile/straiaway${query ? `?${query}` : ''}` as never);
    }
  }, [params.code, params.connected, query, router]);

  return (
    <Screen contentStyle={{ gap: spacing.lg }}>
      <AgentTestId testID={AgentUiIds.straiaway.landing} label="StraiAway partner landing">
        <ScreenHeader
          eyebrow="onTrack"
          title="Open StraiAway Connect"
          subtitle="Finish linking in the onTrack app. If it is not installed yet, get it from the App Store and return to this page."
        />
      </AgentTestId>
      <View style={{ gap: spacing.sm }}>
        <Button
          testID={AgentUiIds.straiaway.openOntrack}
          icon="open-external"
          onPress={() => void Linking.openURL(installedUrl)}
          accessibilityLabel="Open in onTrack">
          Open in onTrack
        </Button>
        <Button
          variant="secondary"
          icon="download"
          onPress={() => void Linking.openURL(APP_STORE)}
          accessibilityLabel="Download onTrack">
          Download from the App Store
        </Button>
        <AppText variant="caption" color="secondary" align="center">
          New here? Install onTrack, return to this link, then tap Open in onTrack.
        </AppText>
      </View>
    </Screen>
  );
}
