import type { PropsWithChildren, ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';

import { GlassPrimaryAction, SheetScaffold } from '@/components/primitives';
import type { AppIconName } from '@/design-system';
import { AgentUiIds } from '@/utils/agent-ui';

export type FoodSheetProps = PropsWithChildren<{
  visible: boolean;
  /**
   * Sheet key for agent-ui land flows — stamps
   * `ontrack.food.sheet.<name>.close` / `.done` automatically.
   */
  name: string;
  eyebrow?: string;
  title: string;
  subtitle?: string;
  subtitleIcon?: AppIconName;
  onClose: () => void;
  closeAccessibilityLabel?: string;
  /** Standard in-scroll footer CTA (stamped `.done`) — rendered when set. */
  doneLabel?: string;
  doneIcon?: AppIconName;
  onDone?: () => void;
  doneDisabled?: boolean;
  /**
   * Custom footer (wins over `doneLabel`/`onDone`). Stamp your primary
   * control with `AgentUiIds.food.sheet.done(name)` yourself.
   */
  footer?: ReactNode;
  contentContainerStyle?: StyleProp<ViewStyle>;
  maxHeight?: number;
  minHeight?: number;
  lockHeight?: boolean;
  scrollKey?: string | number;
  scrollEnabled?: boolean;
}>;

/**
 * Every Food sheet uses this thin glass preset over `SheetScaffold` —
 * swipe grabber, scrollable body + in-scroll CTA. Zero per-screen
 * sheet geometry (see `.cursor/skills/food/SKILL.md`).
 */
export function FoodSheet({
  visible,
  name,
  eyebrow,
  title,
  subtitle,
  subtitleIcon,
  onClose,
  closeAccessibilityLabel = 'Close',
  doneLabel,
  doneIcon,
  onDone,
  doneDisabled = false,
  footer,
  contentContainerStyle,
  maxHeight,
  minHeight,
  lockHeight,
  scrollKey,
  scrollEnabled,
  children,
}: FoodSheetProps) {
  const resolvedFooter =
    footer ??
    (doneLabel && onDone ? (
      <GlassPrimaryAction
        label={doneLabel}
        icon={doneIcon}
        onPress={onDone}
        disabled={doneDisabled}
        testID={AgentUiIds.food.sheet.done(name)}
      />
    ) : undefined);

  return (
    <SheetScaffold
      visible={visible}
      surface="glass"
      eyebrow={eyebrow}
      title={title}
      subtitle={subtitle}
      subtitleIcon={subtitleIcon}
      onClose={onClose}
      closeAccessibilityLabel={closeAccessibilityLabel}
      closeTestID={AgentUiIds.food.sheet.close(name)}
      contentContainerStyle={contentContainerStyle}
      footer={resolvedFooter}
      maxHeight={maxHeight}
      minHeight={minHeight}
      lockHeight={lockHeight}
      scrollKey={scrollKey}
      scrollEnabled={scrollEnabled}>
      {children}
    </SheetScaffold>
  );
}
