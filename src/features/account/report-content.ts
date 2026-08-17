import { appPrompt } from '@/components/primitives';
import {
    REPORT_REASONS,
    reportContent,
    type ReportContentKind,
} from '@/services/moderation';

/** Shared report chooser — action sheet, then the server RPC. */
export function promptReportContent(input: {
  kind: ReportContentKind;
  targetUserId?: string | null;
  contentId?: string | null;
  onReported?: () => void;
}): void {
  appPrompt.actionSheet(
    {
      title: 'Report',
      message:
        'Choose a reason. We review reports and may hide or remove the content.',
      options: [...REPORT_REASONS.map((reason) => reason.label), 'Cancel'],
      cancelButtonIndex: REPORT_REASONS.length,
    },
    (index) => {
      const reason = REPORT_REASONS[index];
      if (!reason) return;
      void reportContent({
        kind: input.kind,
        reason: reason.key,
        targetUserId: input.targetUserId,
        contentId: input.contentId,
      })
        .then(() => {
          input.onReported?.();
          appPrompt.alert(
            'Report Sent',
            'Thanks. We will review this and may hide it from your view in the meantime.',
          );
        })
        .catch((error: unknown) => {
          appPrompt.alert(
            'Report Could Not Be Sent',
            error instanceof Error
              ? error.message
              : 'Try again in a moment.',
          );
        });
    },
  );
}
