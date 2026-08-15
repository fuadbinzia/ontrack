import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';

import { AppText, Button, ErrorMessage, Input, SheetScaffold } from '@/components/primitives';
import { useResponsive } from '@/hooks/use-responsive';
import { importRewardCardLink } from '@/services/finance';
import { AgentTestId, AgentUiIds } from '@/utils/agent-ui';

import type { FinanceRewardProfileDraft } from './rewards-types';

export function FinanceRewardLinkSheet({
  visible,
  onClose,
  onDraft,
}: {
  visible: boolean;
  onClose: () => void;
  onDraft: (draft: FinanceRewardProfileDraft) => void;
}) {
  const { spacing } = useResponsive();
  const controller = useRef<AbortController | null>(null);
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();

  useEffect(() => {
    if (visible) {
      setUrl('');
      setError(undefined);
    }
    return () => controller.current?.abort();
  }, [visible]);

  const analyze = async () => {
    if (!url.trim()) {
      setError('Paste a complete public HTTPS card link.');
      return;
    }
    controller.current?.abort();
    controller.current = new AbortController();
    setLoading(true);
    setError(undefined);
    try {
      const draft = await importRewardCardLink(url.trim(), controller.current.signal);
      onDraft(draft);
    } catch (analysisError) {
      if (controller.current.signal.aborted) return;
      setError(analysisError instanceof Error ? analysisError.message : 'The link could not be analyzed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SheetScaffold
      visible={visible}
      eyebrow="Public Card Page"
      title="Create From Link"
      subtitle="We’ll extract an editable draft—not silently save card terms."
      onClose={onClose}
      closeTestID={AgentUiIds.finance.rewards.linkClose}
      backdropTestID={AgentUiIds.finance.rewards.linkBackdrop}
      fitContent
      footer={(
        <Button
          icon="smart"
          disabled={loading}
          onPress={() => void analyze()}
          testID={AgentUiIds.finance.rewards.linkAnalyze}>
          {loading ? 'Analyzing…' : 'Analyze Card'}
        </Button>
      )}>
      <AgentTestId testID={AgentUiIds.finance.rewards.linkSheet} label="Card Link Import">
        <View style={{ gap: spacing.md }}>
          <Input
            stackedLabel="Credit Card Link"
            icon="link"
            placeholder="https://issuer.com/card"
            value={url}
            onChangeText={setUrl}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            testID={AgentUiIds.finance.rewards.linkUrl}
          />
          <AppText variant="caption" color="secondary">
            Public page text may be sent to the configured AI provider. Private links, PDFs,
            credentials, and local-network addresses are blocked.
          </AppText>
              {error ? <ErrorMessage message={error} variant="caption" /> : null}
        </View>
      </AgentTestId>
    </SheetScaffold>
  );
}
