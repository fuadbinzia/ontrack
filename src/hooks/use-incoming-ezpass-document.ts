import * as Linking from 'expo-linking';
import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';

import { incomingEzPassDocumentDestination } from '@/features/finance/ezpass-document-open';
import { dismissEzPassNyAccount } from '@/features/finance/ezpass-official-site';
import TravelDocumentReader from '../../modules/travel-document-reader';

type DocumentRouter = {
  replace: (href: never) => void;
};

export function useIncomingEzPassDocument(enabled: boolean, router: DocumentRouter) {
  const lastOpened = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (!enabled || Platform.OS === 'web') return;
    const open = (uri: string | null) => {
      if (!uri || uri === lastOpened.current) return;
      const destination = incomingEzPassDocumentDestination(uri);
      if (!destination) return;
      lastOpened.current = uri;
      Linking.clearInitialURL();
      void dismissEzPassNyAccount().then(() => router.replace(destination as never));
    };
    // Expo keeps its own copy of the most recently opened URL. This covers a
    // warm document handoff where iOS activates the app before RN's URL event
    // listener has resumed.
    open(Linking.getLinkingURL());
    void Linking.getInitialURL().then(open).catch(() => undefined);
    const subscription = Linking.addEventListener('url', ({ url }) => open(url));
    const nativeSubscription = Platform.OS === 'ios' && TravelDocumentReader
      ? TravelDocumentReader.addListener('onDocumentOpened', ({ url }) => open(url))
      : undefined;
    if (Platform.OS === 'ios' && TravelDocumentReader?.takePendingDocumentUrlAsync) {
      void TravelDocumentReader.takePendingDocumentUrlAsync().then(open).catch(() => undefined);
    }
    return () => {
      subscription.remove();
      nativeSubscription?.remove();
    };
  }, [enabled, router]);
}
