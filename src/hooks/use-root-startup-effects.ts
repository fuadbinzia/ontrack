import * as Linking from 'expo-linking';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { Platform } from 'react-native';

import { removeRuntimeActivity, setRuntimeActivity } from '@/features/performance/runtime-activity';
import { useVoiceListsSync } from '@/features/todos/use-voice-lists-sync';
import { useEventFollowSync } from '@/hooks/use-event-follow-sync';
import { useIncomingShareRouting } from '@/hooks/use-incoming-share-routing';
import { useIncomingEzPassDocument } from '@/hooks/use-incoming-ezpass-document';
import { getNotificationsModule } from '@/services/notifications/runtime';
import { configurePlantNotifications } from '@/services/plants/notifications';
import { reconcilePlantSchedules } from '@/services/plants/schedule';
import { useTravel } from '@/store/travel';
import {
  handleAgentUiUrl,
  isAgentUiEnabled,
  isAgentUiUrl,
} from '@/utils/agent-ui';
import { deferUntilIdle } from '@/utils/defer-until-idle';

type RootRouter = {
  push: (href: never) => void;
  replace: (href: never) => void;
};

type UseRootStartupEffectsInput = {
  hydrated: boolean;
  appAccess: boolean;
  hasOnboarded: boolean;
  appIsActive: boolean;
  phase: string;
  router: RootRouter;
};

export function useRootStartupEffects({
  hydrated,
  appAccess,
  hasOnboarded,
  appIsActive,
  phase,
  router,
}: UseRootStartupEffectsInput) {
  useVoiceListsSync(hydrated && appAccess);
  useEventFollowSync(hydrated && appAccess && hasOnboarded);

  useIncomingShareRouting(
    hydrated && appAccess && hasOnboarded && appIsActive,
    router,
  );
  useIncomingEzPassDocument(
    hydrated && appAccess && hasOnboarded && appIsActive,
    router,
  );

  useEffect(() => {
    if (!hydrated || !appAccess) return;
    let active = true;
    let subscription: { remove: () => void } | undefined;
    const redirect = (
      response: import('expo-notifications').NotificationResponse | null,
    ) => {
      const url = response?.notification.request.content.data?.url;
      if (typeof url === 'string' && url.startsWith('/plants/')) {
        router.push(url as never);
        return;
      }
      // Prefer tripId (capability tokens are no longer sent in push payloads).
      const tripId = response?.notification.request.content.data?.tripId;
      const legacyChatCode = response?.notification.request.content.data?.chatCode;
      if (url === '/travel-chat') {
        const plan = useTravel.getState().plans.find((item) =>
          (typeof tripId === 'string' && item.id === tripId) ||
          (typeof legacyChatCode === 'string' &&
            (item.chatAccessCode === legacyChatCode ||
              item.participants.some((person) => person.inviteCode === legacyChatCode))),
        );
        if (plan) router.push(`/travel/${plan.id}/chat` as never);
      }
    };
    const cancelIdle = deferUntilIdle(() => {
      if (!active) return;
      setRuntimeActivity(
        { id: 'system.notifications', label: 'Notifications', category: 'system' },
        { status: 'running', detail: 'Plant schedules and response listener' },
      );
      void configurePlantNotifications().catch(() => undefined).then(reconcilePlantSchedules);
      if (Platform.OS === 'web') return;
      void getNotificationsModule().then((notifications) => {
        if (!notifications || !active) return;
        void notifications.getLastNotificationResponseAsync().then(redirect);
        subscription = notifications.addNotificationResponseReceivedListener(redirect);
      });
    });
    return () => {
      active = false;
      cancelIdle();
      subscription?.remove();
      removeRuntimeActivity('system.notifications');
    };
  }, [appAccess, hydrated, router]);

  useEffect(() => {
    if (!hydrated || phase === 'loading') return;
    void SplashScreen.hideAsync().catch(() => undefined);
  }, [hydrated, phase]);

  useEffect(() => {
    if (!isAgentUiEnabled()) return;
    const run = (url: string | null) => {
      if (!url || !isAgentUiUrl(url)) return;
      void handleAgentUiUrl(url);
    };
    void Linking.getInitialURL().then(run);
    const sub = Linking.addEventListener('url', ({ url }) => run(url));
    return () => sub.remove();
  }, []);
}
