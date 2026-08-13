import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/primitives';
import { radii, type Theme } from '@/design-system';
import { useResponsive } from '@/hooks/use-responsive';
import { useTheme } from '@/hooks/use-theme';
import type {
  GoogleCalendarSyncDirection,
  GoogleCalendarSyncPreview,
  GoogleCalendarSyncPreviewItem,
} from '@/services/calendar/google-types';

const directionLabels: Record<GoogleCalendarSyncDirection, string> = {
  two_way: 'Two-way sync',
  to_google: 'To Google',
  from_google: 'From Google',
};

export function calendarSyncReviewActionLabel(
  item: Pick<GoogleCalendarSyncPreviewItem, 'action' | 'destination'>,
): string {
  if (item.action === 'relink') return 'Repair calendar link';
  const destination = item.destination === 'google' ? 'Google' : 'onTrack';
  if (item.action === 'create') return `Add to ${destination}`;
  if (item.action === 'delete') return `Remove from ${destination}`;
  return `Update in ${destination}`;
}

function actionColor(item: GoogleCalendarSyncPreviewItem, theme: Theme): string {
  if (item.action === 'delete') return theme.danger;
  if (item.action === 'create') return theme.success;
  if (item.action === 'relink') return theme.warning;
  return theme.accentPrimary;
}

function ChangeDetail({
  detail,
}: {
  detail: NonNullable<GoogleCalendarSyncPreviewItem['details']>[number];
}) {
  const theme = useTheme();
  const { spacing } = useResponsive();
  const hasComparison = Boolean(detail.before && detail.after && detail.before !== detail.after);

  return (
    <View style={{ gap: spacing.xxs }}>
      <AppText variant="caption" color="tertiary" fit>{detail.label}</AppText>
      {hasComparison ? (
        <View style={[styles.comparison, { gap: spacing.sm }]}>
          <View style={[styles.valueColumn, { gap: spacing.xxs }]}>
            <AppText variant="caption" color="tertiary" fit>Current</AppText>
            <AppText variant="callout" color="secondary">{detail.before}</AppText>
          </View>
          <AppText
            accessibilityLabel="changes to"
            variant="callout"
            color="accent"
            style={styles.arrow}>
            →
          </AppText>
          <View style={[styles.valueColumn, { gap: spacing.xxs }]}>
            <AppText variant="caption" color="tertiary" fit>After sync</AppText>
            <AppText variant="callout" style={{ color: theme.textPrimary }}>{detail.after}</AppText>
          </View>
        </View>
      ) : (
        <AppText variant="callout" color="secondary">
          {detail.after ?? detail.before ?? 'No value'}
        </AppText>
      )}
    </View>
  );
}

function CalendarSyncReviewItem({
  item,
  isLast,
}: {
  item: GoogleCalendarSyncPreviewItem;
  isLast: boolean;
}) {
  const theme = useTheme();
  const { spacing } = useResponsive();
  const color = actionColor(item, theme);

  return (
    <View
      accessibilityLabel={`${calendarSyncReviewActionLabel(item)}: ${item.title}`}
      style={[
        styles.item,
        {
          borderBottomColor: theme.separator,
          borderBottomWidth: isLast ? 0 : StyleSheet.hairlineWidth,
          gap: spacing.sm,
          paddingVertical: spacing.md,
        },
      ]}>
      <View style={[styles.itemHeader, { gap: spacing.sm }]}>
        <View
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={[styles.actionMarker, { backgroundColor: color }]}
        />
        <View style={[styles.itemHeading, { gap: spacing.xxs }]}>
          <AppText variant="caption" fit style={{ color }}>
            {calendarSyncReviewActionLabel(item)}
          </AppText>
          <AppText variant="subheading" fit>{item.title}</AppText>
        </View>
      </View>

      {item.details?.length ? (
        <View style={[styles.details, { gap: spacing.md, paddingLeft: spacing.md }]}>
          {item.details.map((detail, index) => (
            <ChangeDetail key={`${detail.label}-${index}`} detail={detail} />
          ))}
        </View>
      ) : null}

      {item.reason ? (
        <AppText
          variant="caption"
          color="secondary"
          style={[styles.reason, { borderLeftColor: theme.separator, paddingLeft: spacing.md }]}>
          {item.reason}
        </AppText>
      ) : null}
    </View>
  );
}

export function CalendarSyncReview({ preview }: { preview: GoogleCalendarSyncPreview }) {
  const theme = useTheme();
  const { spacing } = useResponsive();
  const changeLabel = preview.changes.length === 1 ? 'change' : 'changes';

  return (
    <View style={[styles.root, { gap: spacing.md }]}>
      <View
        style={[
          styles.summary,
          {
            borderColor: theme.separator,
            borderRadius: radii.lg,
            gap: spacing.xxs,
            paddingHorizontal: spacing.md,
            paddingVertical: spacing.sm,
          },
        ]}>
        <AppText variant="callout" fit>
          {preview.changes.length} planned {changeLabel}
        </AppText>
        <AppText variant="caption" color="secondary" fit>
          {directionLabels[preview.direction]} · Nothing changes until you confirm
        </AppText>
      </View>

      <View>
        {preview.changes.map((item, index) => (
          <CalendarSyncReviewItem
            key={`${item.id}-${item.action}-${index}`}
            item={item}
            isLast={index === preview.changes.length - 1}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    width: '100%',
  },
  summary: {
    borderWidth: StyleSheet.hairlineWidth,
    borderCurve: 'continuous',
  },
  item: {
    width: '100%',
  },
  itemHeader: {
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  actionMarker: {
    width: 3,
    borderRadius: radii.pill,
  },
  itemHeading: {
    flex: 1,
    minWidth: 0,
  },
  details: {
    width: '100%',
  },
  comparison: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
  },
  valueColumn: {
    flex: 1,
    minWidth: 0,
  },
  arrow: {
    flexShrink: 0,
  },
  reason: {
    borderLeftWidth: StyleSheet.hairlineWidth,
  },
});
