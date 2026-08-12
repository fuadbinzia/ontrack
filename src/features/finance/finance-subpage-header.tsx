import type { ReactNode } from 'react';

import { HeaderBackButton, ScreenHeader } from '@/components/primitives';
import { AgentUiIds } from '@/utils/agent-ui';

/** Shared Finance nested-screen chrome: eyebrow back → Finance hub. */
export function FinanceSubpageHeader({
  title,
  subtitle,
  trailing,
}: {
  title: string;
  subtitle?: string;
  trailing?: ReactNode;
}) {
  return (
    <ScreenHeader
      eyebrow="Finance"
      title={title}
      subtitle={subtitle}
      trailing={trailing}
      leading={
        <HeaderBackButton
          compact
          accessibilityLabel="Back to Finance"
          fallback="/(tabs)/finance"
          testID={AgentUiIds.finance.back}
        />
      }
    />
  );
}
