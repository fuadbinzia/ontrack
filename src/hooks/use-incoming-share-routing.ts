import { getSharedPayloads, type SharePayload } from 'expo-sharing';
import { useEffect } from 'react';
import { Platform } from 'react-native';

import { isEzPassStatementPayload } from '@/features/finance/ezpass-shared-statement';

type IncomingShareRouter = {
  replace: (href: never) => void;
};

export function incomingShareDestination(payloads: SharePayload[]) {
  return payloads.length > 0 && payloads.every(isEzPassStatementPayload)
    ? {
        pathname: '/(tabs)/finance/ezpass-import',
        params: { source: 'share' },
      }
    : '/share-import';
}

export function useIncomingShareRouting(
  enabled: boolean,
  router: IncomingShareRouter,
) {
  useEffect(() => {
    if (!enabled || Platform.OS === 'web') return;
    try {
      const payloads = getSharedPayloads();
      if (payloads.length > 0) {
        router.replace(incomingShareDestination(payloads) as never);
      }
    } catch {
      // Older native builds do not include incoming sharing.
    }
  }, [enabled, router]);
}
