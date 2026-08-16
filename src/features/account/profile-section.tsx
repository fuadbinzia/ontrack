import type { PropsWithChildren } from 'react';

import { SectionHeader } from '@/components/primitives';
import { useResponsive } from '@/hooks/use-responsive';
import { AgentTestId } from '@/utils/agent-ui';

/** Overline + content stack for a Profile settings group. */
export function ProfileSection({
  testID,
  title,
  detail,
  children,
}: PropsWithChildren<{
  testID: string;
  title: string;
  detail?: string;
}>) {
  const { spacing } = useResponsive();
  return (
    <AgentTestId testID={testID} label={title} style={{ gap: spacing.sm }}>
      <SectionHeader title={title} detail={detail} flush />
      {children}
    </AgentTestId>
  );
}
