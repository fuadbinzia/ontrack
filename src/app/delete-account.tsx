import { Stack } from 'expo-router';

import { ONTRACK_SUPPORT_EMAIL } from '@/constants/legal';
import { LegalDocumentScreen } from '@/features/account/legal-document-screen';

export default function DeleteAccountScreen() {
  return (
    <>
      <Stack.Screen options={{ title: 'Delete Account' }} />
      <LegalDocumentScreen
        title="Delete Your onTrack Account"
        updated="August 17, 2026"
        intro="You can delete your onTrack account from inside the app. This page exists so store reviewers and account holders can find that path without installing a new binary."
        sections={[
          {
            title: 'In the App',
            paragraphs: [
              'Open Profile, then Account. Choose Delete Account and confirm. onTrack signs you out and asks the server to remove your auth user, synced rows, and owned storage objects.',
              'Guest data lives only on that device. Clearing app storage or using Reset Data on Profile removes the local guest copy.',
            ],
          },
          {
            title: 'If You Cannot Open the App',
            paragraphs: [
              `Email ${ONTRACK_SUPPORT_EMAIL} from the address on the account and ask us to delete it. We will verify the request before removing cloud account data.`,
              'Deletion does not automatically erase copies you saved to Google Drive, files you exported, or content another person already received through a shared trip, list, or chat.',
            ],
          },
        ]}
      />
    </>
  );
}
