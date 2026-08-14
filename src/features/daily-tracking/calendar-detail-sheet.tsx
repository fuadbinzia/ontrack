import type { PropsWithChildren, ReactNode } from 'react';
import { useWindowDimensions } from 'react-native';

import { SheetScaffold } from '@/components/primitives';
import type { AppIconName } from '@/design-system';
import { AgentUiIds } from '@/utils/agent-ui';

type CalendarDetailSheetProps = PropsWithChildren<{
  kind: string;
  eyebrow?: string;
  title: string;
  subtitle?: string;
  subtitleIcon?: AppIconName;
  decoration?: ReactNode;
  onClose: () => void;
}>;

/** Consistent bottom-sheet presentation for every card opened from Today. */
export function CalendarDetailSheet({
  kind,
  eyebrow,
  title,
  subtitle,
  subtitleIcon,
  decoration,
  onClose,
  children,
}: CalendarDetailSheetProps) {
  const { height: windowHeight } = useWindowDimensions();

  return (
    <SheetScaffold
      visible
      host="route"
      eyebrow={eyebrow}
      title={title}
      subtitle={subtitle}
      subtitleIcon={subtitleIcon}
      decoration={decoration}
      onClose={onClose}
      closeAccessibilityLabel={`Dismiss ${kind} details`}
      closeTestID={AgentUiIds.today.detailClose(kind)}
      backdropTestID={AgentUiIds.today.detailBackdrop(kind)}
      maxHeight={Math.round(windowHeight * 0.9)}
      surface="glass">
      {children}
    </SheetScaffold>
  );
}
