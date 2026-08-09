import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import {
    AppText,
    Card,
    GlassIconWell,
    GlassMetaChip,
    statusBadgeToneColor,
    Symbol,
    type StatusBadgeTone,
} from '@/components/primitives';
import type { AppIconName } from '@/design-system';
import { useResponsive } from '@/hooks/use-responsive';
import { useTheme } from '@/hooks/use-theme';
import type { JurisdictionStatus, JurisdictionStatusKind } from '@/types/food';
import { AgentUiIds } from '@/utils/agent-ui';
import { formatDateKeyMedium } from '@/utils/date';

export interface CountryRestrictionRowProps {
  /** Sourced regulatory status — `sourceUrl` + `lastReviewedAt` required. */
  status: JurisdictionStatus;
  /** Opens the restriction detail / source. */
  onPress?: () => void;
  testID?: string;
  style?: StyleProp<ViewStyle>;
}

/** Status meaning always carries icon + text — never color alone. */
export function countryRestrictionTone(
  kind: JurisdictionStatusKind,
): StatusBadgeTone {
  switch (kind) {
    case 'allowed':
      return 'success';
    case 'restricted':
      return 'warning';
    case 'not-approved-for-use':
      return 'warning';
    case 'banned':
      return 'danger';
  }
}

export function countryRestrictionIcon(
  kind: JurisdictionStatusKind,
): AppIconName {
  switch (kind) {
    case 'allowed':
      return 'check';
    case 'restricted':
      return 'warning';
    case 'not-approved-for-use':
      return 'minus-circle';
    case 'banned':
      return 'close';
  }
}

/** "Banned" is a regulatory status — never presented as "dangerous". */
export function countryRestrictionLabel(kind: JurisdictionStatusKind): string {
  switch (kind) {
    case 'allowed':
      return 'Allowed';
    case 'restricted':
      return 'Restricted';
    case 'not-approved-for-use':
      return 'Not approved for this use';
    case 'banned':
      return 'Banned';
  }
}

function sourceHost(url: string): string | undefined {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return undefined;
  }
}

/**
 * Jurisdiction status row: country name, icon+text status chip, and the
 * mandatory source / last-reviewed affordance.
 */
export function CountryRestrictionRow({
  status,
  onPress,
  testID,
  style,
}: CountryRestrictionRowProps) {
  const theme = useTheme();
  const { spacing, s } = useResponsive();
  const tone = countryRestrictionTone(status.status);
  const toneColor = statusBadgeToneColor(tone, theme);
  const label = countryRestrictionLabel(status.status);
  const rowTestID =
    testID ?? AgentUiIds.food.ingredients.country(status.countryCode);
  const host = sourceHost(status.sourceUrl);
  // `lastReviewedAt` may be a date key or a full ISO timestamp.
  const reviewed = `Reviewed ${formatDateKeyMedium(status.lastReviewedAt.slice(0, 10))}`;
  const sourceLine = host ? `${host} · ${reviewed}` : reviewed;

  return (
    <Card
      padded={false}
      onPress={onPress}
      accessibilityLabel={`${status.countryName}, ${label}, ${sourceLine}`}
      testID={rowTestID}
      style={style}>
      <View
        style={[
          styles.row,
          { minHeight: s(56), padding: spacing.md, gap: spacing.md },
        ]}>
        <GlassIconWell size={Math.max(36, s(38))}>
          <Symbol name="globe" size="sm" color={theme.textSecondary} />
        </GlassIconWell>
        <View style={[styles.body, { gap: spacing.xxs }]}>
          <AppText variant="body" numberOfLines={1} style={styles.shrinkText}>
            {status.countryName}
          </AppText>
          <AppText variant="caption" color="tertiary" numberOfLines={1}>
            {sourceLine}
          </AppText>
        </View>
        <GlassMetaChip accessibilityLabel={label}>
          <Symbol
            name={countryRestrictionIcon(status.status)}
            size={Math.max(12, s(13))}
            color={toneColor}
          />
          <AppText
            variant="caption"
            numberOfLines={1}
            style={[styles.shrinkText, { color: toneColor }]}>
            {label}
          </AppText>
        </GlassMetaChip>
        {onPress ? (
          <Symbol name="chevron-right" size="sm" color={theme.textTertiary} />
        ) : null}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  body: {
    flex: 1,
    minWidth: 0,
  },
  shrinkText: {
    flexShrink: 1,
    minWidth: 0,
  },
});
