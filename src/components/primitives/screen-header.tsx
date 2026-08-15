import {
  cloneElement,
  isValidElement,
  type ReactElement,
  type ReactNode,
} from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import type { AppIconName } from '@/design-system';
import { useResponsive } from '@/hooks/use-responsive';
import { useTheme } from '@/hooks/use-theme';

import { AppText } from './app-text';
import { IconButton } from './button';
import { fieldTitleCase } from './field-title-case';
import { Symbol } from './symbol';

export interface ScreenHeaderProps {
  title: string;
  /** Secondary label on the title line (e.g. a date). */
  titleMeta?: string;
  eyebrow?: string;
  subtitle?: string;
  subtitleIcon?: AppIconName;
  leading?: ReactNode;
  /** Actions on the far right of the title line. */
  titleTrailing?: ReactNode;
  trailing?: ReactNode;
  /** Optional decorative layer behind the title copy. */
  decoration?: ReactNode;
  /** Page/full-screen dismiss (top-right X). Bottom sheets use `SheetGrabber` instead. */
  onClose?: () => void;
  closeAccessibilityLabel?: string;
  closeTestID?: string;
  /** Frosted close by default; pass `solid` for opaque sunken plates. */
  closeAppearance?: 'solid' | 'glass';
  style?: StyleProp<ViewStyle>;
}

type LeadingWithLabel = { label?: string };

/** Shared page/sheet hierarchy. Feature themes can recolor it but cannot restyle its actions. */
export function ScreenHeader({
  title,
  titleMeta,
  eyebrow,
  subtitle,
  subtitleIcon,
  leading,
  titleTrailing,
  trailing,
  decoration,
  onClose,
  closeAccessibilityLabel = 'Close',
  closeTestID,
  closeAppearance = 'glass',
  style,
}: ScreenHeaderProps) {
  const theme = useTheme();
  const { spacing, s, layout } = useResponsive();
  // Compact visual; hitSlop on IconButton keeps the ≥44pt target.
  const closeSize = Math.max(36, Math.round(Math.min(layout.minTapTarget, s(40))));
  const glassClose = closeAppearance === 'glass';

  const closeControl = onClose ? (
    <IconButton
      icon="close"
      onPress={onClose}
      accessibilityLabel={closeAccessibilityLabel}
      testID={closeTestID}
      size={closeSize}
      iconSize="sm"
      appearance={closeAppearance}
      background={glassClose ? undefined : theme.backgroundSunken}
      borderColor={glassClose ? undefined : theme.separator}
    />
  ) : null;

  const trailingSlot =
    trailing || closeControl ? (
      <View style={[styles.actions, { gap: spacing.sm }]}>
        {trailing ? <View style={styles.action}>{trailing}</View> : null}
        {closeControl ? <View style={styles.action}>{closeControl}</View> : null}
      </View>
    ) : null;

  const subtitleBlock = subtitle ? (
    <View style={[styles.subtitleRow, { gap: spacing.xs }]}>
      {subtitleIcon ? <Symbol name={subtitleIcon} size="sm" color={theme.textSecondary} /> : null}
      <AppText variant="callout" color="secondary" style={styles.subtitle}>
        {subtitle}
      </AppText>
    </View>
  ) : null;

  const titleBlock = titleMeta ? (
    <View style={[styles.titleWithMeta, { gap: spacing.sm }]}>
      <AppText variant="title" fit style={styles.titleText}>
        {fieldTitleCase(title)}
      </AppText>
      <AppText variant="callout" color="secondary" fit style={styles.titleMeta}>
        {titleMeta}
      </AppText>
    </View>
  ) : (
    <AppText variant="title" fit>
      {fieldTitleCase(title)}
    </AppText>
  );

  // Flourish sits behind the title only so long subtitles stay readable.
  const decoratedTitle = decoration ? (
    <View style={styles.copyDecorated}>
      <View style={styles.decoration} pointerEvents="none">
        {decoration}
      </View>
      <View style={styles.copyForeground}>{titleBlock}</View>
    </View>
  ) : (
    titleBlock
  );

  const titleTrailingSlot = titleTrailing ? (
    <View style={[styles.actions, { gap: spacing.xs }]}>{titleTrailing}</View>
  ) : null;

  const titleBand = titleTrailingSlot ? (
    <View style={[styles.titleRow, { gap: spacing.sm, alignItems: 'center' }]}>
      <View style={styles.copy}>{decoratedTitle}</View>
      {titleTrailingSlot}
    </View>
  ) : (
    decoratedTitle
  );

  // Eyebrow band hosts leading/close so title + subtitle use the full sheet width.
  // When leading is present (compact HeaderBackButton), fold eyebrow into its label so
  // the whole overline row is the back hit target — not just the chevron.
  if (eyebrow) {
    const leadingNode =
      leading && isValidElement(leading)
        ? cloneElement(leading as ReactElement<LeadingWithLabel>, {
            label: (leading.props as LeadingWithLabel).label ?? eyebrow,
          })
        : leading;

    return (
      <View style={[styles.stack, { gap: spacing.xs }, style]}>
        <View style={[styles.eyebrowRow, { gap: spacing.xs }]}>
          {leadingNode ? (
            <View style={styles.eyebrowLeading}>{leadingNode}</View>
          ) : (
            <AppText variant="overline" color="accent" fit style={styles.eyebrow}>
              {eyebrow}
            </AppText>
          )}
          {trailingSlot ? <View style={styles.eyebrowSpacer} /> : null}
          {trailingSlot}
        </View>
        {titleBand}
        {subtitleBlock}
      </View>
    );
  }

  // No eyebrow: close sits with the title; subtitle still spans full width below.
  return (
    <View style={[styles.stack, { gap: spacing.sm }, style]}>
      <View style={[styles.titleRow, { gap: spacing.sm }]}>
        {leading ? <View style={styles.action}>{leading}</View> : null}
        <View style={styles.copy}>{titleBand}</View>
        {trailingSlot}
      </View>
      {subtitleBlock}
    </View>
  );
}

const styles = StyleSheet.create({
  stack: {
    width: '100%',
  },
  titleRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  eyebrowRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
  },
  eyebrow: {
    flex: 1,
    minWidth: 0,
    flexShrink: 1,
  },
  /** Labeled compact back — grow so the eyebrow band is the hit target. */
  eyebrowLeading: {
    flex: 1,
    flexShrink: 1,
    minWidth: 0,
    maxWidth: '100%',
  },
  eyebrowSpacer: {
    flexGrow: 0,
    flexShrink: 0,
    width: 0,
  },
  copy: {
    flex: 1,
    minWidth: 0,
    flexShrink: 1,
  },
  titleWithMeta: {
    flexDirection: 'row',
    alignItems: 'baseline',
    minWidth: 0,
    flexShrink: 1,
  },
  titleText: {
    flexShrink: 1,
    minWidth: 0,
  },
  titleMeta: {
    flexShrink: 1,
    minWidth: 0,
  },
  copyDecorated: {
    position: 'relative',
    overflow: 'visible',
    minWidth: 0,
    flexShrink: 1,
  },
  decoration: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    zIndex: 0,
  },
  copyForeground: {
    zIndex: 1,
    elevation: 1,
    minWidth: 0,
  },
  subtitleRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
  },
  subtitle: {
    flex: 1,
    minWidth: 0,
    flexShrink: 1,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 0,
  },
  action: {
    flexShrink: 0,
  },
});
