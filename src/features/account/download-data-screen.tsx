import { useState } from 'react';

import {
    AppText,
    Button,
    Card,
    ErrorMessage,
    HeaderBackButton,
    Screen,
    ScreenHeader,
} from '@/components/primitives';
import { shareDataExport } from '@/features/account/data-export';
import { useResponsive } from '@/hooks/use-responsive';
import { AgentTestId, AgentUiIds } from '@/utils/agent-ui';

export default function DownloadDataScreen() {
  const { spacing } = useResponsive();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [savedName, setSavedName] = useState<string>();

  return (
    <Screen refresh={false} contentStyle={{ gap: spacing.xl }}>
      <ScreenHeader title="Download My Data" leading={<HeaderBackButton />} />
      <AgentTestId testID={AgentUiIds.profile.downloadData} label="Download My Data">
        <Card style={{ gap: spacing.md }}>
          <AppText variant="heading">A Readable Copy</AppText>
          <AppText variant="body" color="secondary">
            Export a structured JSON file of the data on this device, grouped by
            area. Health and Journal are included because they live only on this
            phone.
          </AppText>
          <AppText variant="body" color="secondary">
            The file is not encrypted and does not embed photos, voice notes, or
            statement PDFs. Use Profile → Backup if you need those attachments.
            Save the export somewhere only you can open, then delete the copy
            when you no longer need it.
          </AppText>
          {error ? <ErrorMessage message={error} /> : null}
          {savedName ? (
            <AppText variant="caption" color="secondary">
              Shared {savedName}
            </AppText>
          ) : null}
          <Button
            icon="download"
            loading={busy}
            testID={AgentUiIds.profile.downloadDataShare}
            accessibilityLabel="Share Data Export"
            onPress={() => {
              setBusy(true);
              setError(undefined);
              void shareDataExport()
                .then(({ name }) => setSavedName(name))
                .catch((reason: unknown) => {
                  setError(
                    reason instanceof Error
                      ? reason.message
                      : 'The export could not be shared.',
                  );
                })
                .finally(() => setBusy(false));
            }}>
            Share Data Export
          </Button>
        </Card>
      </AgentTestId>
    </Screen>
  );
}
