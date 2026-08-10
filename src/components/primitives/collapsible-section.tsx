import type { PropsWithChildren, ReactNode } from 'react';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { useResponsive } from '@/hooks/use-responsive';
import { useTheme } from '@/hooks/use-theme';
import { useAgentUiTarget } from '@/utils/agent-ui';
import { haptics } from '@/utils/haptics';

import { AppText } from './app-text';
import { CollapsibleBody } from './collapsible-body';
import { DisclosureChevron } from './disclosure-chevron';
import { fieldTitleCase } from './field-title-case';

type CollapsibleSectionProps = PropsWithChildren<{
  title: string;
  /** Defaults to collapsed. */
  defaultExpanded?: boolean;
  expanded?: boolean;
  onExpandedChange?: (expanded: boolean) => void;
  /** One-line blurb under the title while collapsed; hidden when the section opens. */
  description?: string;
  /** Non-interactive trailing caption (shown only while expanded; hidden when `actionLabel` is set). */
  detail?: string;
  actionLabel?: string;
  onAction?: () => void;
  actionTestID?: string;
  actionDisabled?: boolean;
  /** Toggle control testID (title + chevron). */
  testID?: string;
  /** Optional leading chrome before the title (rare). */
  leading?: ReactNode;
}>;

/** Overline section with chevron toggle. Parent owns content rhythm via `gap`. */
export function CollapsibleSection({
  title,
  defaultExpanded = false,
  expanded: expandedProp,
  onExpandedChange,
  description,
  detail,
  actionLabel,
  onAction,
  actionTestID,
  actionDisabled,
  testID,
  leading,
  children,
}: CollapsibleSectionProps) {
  const theme = useTheme();
  const { spacing, layout } = useResponsive();
  const [uncontrolled, setUncontrolled] = useState(defaultExpanded);
  const expanded = expandedProp ?? uncontrolled;

  const setExpanded = (next: boolean) => {
    if (expandedProp === undefined) setUncontrolled(next);
    onExpandedChange?.(next);
  };

  const titleText = fieldTitleCase(title);
  const actionText = actionLabel ? fieldTitleCase(actionLabel) : undefined;
  const showAction = Boolean(expanded && actionText && onAction);
  const showDetail = Boolean(expanded && detail && !showAction);
  const showDescription = Boolean(!expanded && description);
  const toggle = () => {
    haptics.select();
    setExpanded(!expanded);
  };
  const handleAction = onAction && !actionDisabled ? onAction : undefined;

  const toggleAgent = useAgentUiTarget(testID, {
    label: `${expanded ? 'Collapse' : 'Expand'} ${titleText}`,
    onPress: toggle,
  });
  // Only register while expanded so collapsed headers don’t leave orphan actions.
  const actionAgent = useAgentUiTarget(showAction ? actionTestID : undefined, {
    label: actionText,
    onPress: handleAction,
  });

  return (
    <View style={[styles.root, expanded ? { gap: spacing.sm } : null]}>
      <View style={[styles.header, { gap: spacing.md }]}>
        <Pressable
          ref={toggleAgent.ref}
          testID={toggleAgent.testID}
          onLayout={toggleAgent.onLayout}
          accessibilityRole="button"
          accessibilityLabel={`${expanded ? 'Collapse' : 'Expand'} ${titleText}`}
          accessibilityHint={showDescription ? description : undefined}
          accessibilityState={{ expanded }}
          onPress={toggle}
          style={[
            styles.toggle,
            {
              minHeight: layout.minTapTarget,
              gap: spacing.xxs,
              paddingVertical: showDescription ? spacing.xxs : 0,
            },
          ]}>
          <View style={[styles.titleRow, { gap: spacing.xs }]}>
            {leading}
            <AppText variant="overline" color="secondary" fit style={styles.title}>
              {titleText}
            </AppText>
            <DisclosureChevron
              expanded={expanded}
              size="sm"
              color={theme.textSecondary}
            />
          </View>
          {showDescription ? (
            <AppText
              variant="caption"
              color="tertiary"
              numberOfLines={1}
              style={[styles.description, { paddingLeft: spacing.lg }]}>
              {description}
            </AppText>
          ) : null}
        </Pressable>
        {showAction ? (
          <Pressable
            ref={actionAgent.ref}
            testID={actionAgent.testID}
            onLayout={actionAgent.onLayout}
            accessibilityRole="button"
            accessibilityLabel={actionText}
            accessibilityState={{ disabled: Boolean(actionDisabled) }}
            disabled={actionDisabled}
            onPress={handleAction}
            hitSlop={8}
            style={{
              minHeight: layout.minTapTarget,
              minWidth: layout.minTapTarget,
              justifyContent: 'center',
              alignItems: 'flex-end',
              flexShrink: 0,
              opacity: actionDisabled ? 0.45 : 1,
            }}>
            <AppText variant="caption" color="accent" fit>
              {actionText}
            </AppText>
          </Pressable>
        ) : showDetail ? (
          <AppText variant="caption" color="tertiary" style={styles.detail} fit>
            {detail}
          </AppText>
        ) : null}
      </View>
      <CollapsibleBody expanded={expanded}>
        <View style={{ gap: spacing.sm }}>{children}</View>
      </CollapsibleBody>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    width: '100%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  toggle: {
    flex: 1,
    minWidth: 0,
    justifyContent: 'center',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: 0,
  },
  title: {
    flexShrink: 1,
    minWidth: 0,
  },
  description: {
    flexShrink: 1,
    minWidth: 0,
    paddingRight: 28,
  },
  detail: {
    flexShrink: 1,
    maxWidth: '42%',
    textAlign: 'right',
  },
});
