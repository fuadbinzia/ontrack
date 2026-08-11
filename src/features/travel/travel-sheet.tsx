import type { PropsWithChildren, ReactNode } from 'react';
import type { ModalProps, StyleProp, ViewStyle } from 'react-native';

import { ScreenHeader, SheetHeader, SheetScaffold } from '@/components/primitives';
import type { AppIconName } from '@/design-system';
import { useResponsive } from '@/hooks/use-responsive';

type TravelSheetHeaderProps = {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  subtitleIcon?: AppIconName;
  onClose: () => void;
  closeAccessibilityLabel: string;
  closeTestID?: string;
  paddingTop?: number;
  /**
   * `sheet` = swipe grabber (bottom sheets).
   * `page` = top-right X (full-screen chat / gates that reuse this header).
   */
  presentation?: 'sheet' | 'page';
  /** See `SheetHeader` — false when parent owns pan/tap dismiss. */
  grabberInteractive?: boolean;
};

/** Travel sheet/page header — sheets use SheetGrabber; pages keep the X. */
export function TravelSheetHeader({
  eyebrow,
  title,
  subtitle,
  subtitleIcon,
  onClose,
  closeAccessibilityLabel,
  closeTestID,
  paddingTop,
  presentation = 'sheet',
  grabberInteractive,
}: TravelSheetHeaderProps) {
  const { spacing } = useResponsive();
  if (presentation === 'page') {
    return (
      <ScreenHeader
        eyebrow={eyebrow}
        title={title}
        subtitle={subtitle}
        subtitleIcon={subtitleIcon}
        onClose={onClose}
        closeAccessibilityLabel={closeAccessibilityLabel}
        closeTestID={closeTestID}
        closeAppearance="glass"
        style={[
          { paddingTop: paddingTop ?? spacing.md, paddingBottom: spacing.xl },
        ]}
      />
    );
  }
  return (
    <SheetHeader
      eyebrow={eyebrow}
      title={title}
      subtitle={subtitle}
      subtitleIcon={subtitleIcon}
      onClose={onClose}
      closeAccessibilityLabel={closeAccessibilityLabel}
      closeTestID={closeTestID}
      grabberInteractive={grabberInteractive}
      style={paddingTop != null ? { paddingTop } : undefined}
    />
  );
}

type TravelSheetModalProps = PropsWithChildren<{
  visible: boolean;
  eyebrow?: string;
  title: string;
  subtitle?: string;
  subtitleIcon?: AppIconName;
  onClose: () => void;
  closeAccessibilityLabel: string;
  closeTestID?: string;
  contentContainerStyle?: StyleProp<ViewStyle>;
  footer?: ReactNode;
  maxHeight?: number;
  minHeight?: number;
  lockHeight?: boolean;
  scrollKey?: string | number;
  supportedOrientations?: ModalProps['supportedOrientations'];
}>;

/** Every Travel sheet inherits the app-wide grabber, body, and footer contract. */
export function TravelSheetModal({
  visible,
  eyebrow,
  title,
  subtitle,
  subtitleIcon,
  onClose,
  closeAccessibilityLabel,
  closeTestID,
  contentContainerStyle,
  footer,
  maxHeight,
  minHeight,
  lockHeight,
  scrollKey,
  supportedOrientations,
  children,
}: TravelSheetModalProps) {
  return (
    <SheetScaffold
      visible={visible}
      eyebrow={eyebrow}
      title={title}
      subtitle={subtitle}
      subtitleIcon={subtitleIcon}
      onClose={onClose}
      closeAccessibilityLabel={closeAccessibilityLabel}
      closeTestID={closeTestID}
      contentContainerStyle={contentContainerStyle}
      footer={footer}
      maxHeight={maxHeight}
      minHeight={minHeight}
      lockHeight={lockHeight}
      scrollKey={scrollKey}
      supportedOrientations={supportedOrientations}
      surface="glass">
      {children}
    </SheetScaffold>
  );
}
