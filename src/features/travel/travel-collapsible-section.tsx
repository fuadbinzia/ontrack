import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import {
    AppText,
    CollapsibleBody,
    DisclosureChevron,
    GlassTonePill,
    Symbol,
} from '@/components/primitives';
import type { AppIconName, TypeVariant } from '@/design-system';
import { radii } from '@/design-system';
import {
    TRAVEL_TITLE_ICON_GAP,
    travelEditorialTextStyle,
    travelOverlineStyle,
} from '@/features/travel/travel-chrome';
import { TravelHomeGlass } from '@/features/travel/travel-home-glass';
import {
    travelAccent,
    travelCardBorder,
} from '@/features/travel/travel-surface';
import {
    useTravelItineraryInk,
    useTravelItineraryOnGlass,
    useTravelItineraryShellProps,
} from '@/features/travel/use-travel-itinerary-glass';
import { useResponsive } from '@/hooks/use-responsive';
import { useTheme } from '@/hooks/use-theme';
import { AgentTestId } from '@/utils/agent-ui';

/** Soft lift for itinerary board panels. */
const TRAVEL_HEADER_SHADOW = '0 4px 14px rgba(0, 0, 0, 0.22)';

export function TravelCollapsibleSection({
  title,
  count,
  expanded,
  onToggle,
  onAddPress,
  addTestID,
  toggleTestID,
  titleVariant = 'overline',
  nested = false,
  icon,
  card = false,
  compact = false,
  accentColor,
  flushContent = false,
  tightHeader = false,
  children,
}: {
  title: string;
  count?: number;
  expanded: boolean;
  onToggle: () => void;
  /** Optional plus control to the right of the title (e.g. add timeline item). */
  onAddPress?: () => void;
  addTestID?: string;
  toggleTestID?: string;
  /** Slightly larger parent headers can use `caption` or `callout`. */
  titleVariant?: TypeVariant;
  /** Smaller chevron flush to the title — for sections nested under a parent. */
  nested?: boolean;
  icon?: AppIconName;
  /** Join the header and expanded content into one bordered itinerary panel. */
  card?: boolean;
  /** Detail-page density from the itinerary mock; hit slop preserves tap size. */
  compact?: boolean;
  accentColor?: string;
  /** Let day cards sit nearly flush with the parent timeline panel. */
  flushContent?: boolean;
  tightHeader?: boolean;
  children?: ReactNode;
}) {
  const theme = useTheme();
  const { s, spacing } = useResponsive();
  const label = count === undefined ? title : `${title} (${count})`;
  const onGlass = useTravelItineraryOnGlass();
  const primaryInk = useTravelItineraryInk();
  const shellProps = useTravelItineraryShellProps();
  // Card shells + nested kind rows sit on artwork-tinted glass. Light ink when
  // the plate is dark; kind accents stay on bright boards.
  const accent =
    card || nested
      ? onGlass
        ? primaryInk
        : (accentColor ?? travelAccent(theme))
      : (accentColor ?? travelAccent(theme));
  const tap = compact
    ? nested
      ? Math.max(28, s(28))
      : tightHeader
        ? Math.max(32, s(32))
        : Math.max(40, s(40))
    : Math.max(44, s(44));
  const chevronBox = compact
    ? Math.max(24, s(24))
    : nested
      ? s(16)
      : Math.max(32, s(32));
  // Same icon→title breath for parent + nested (mock: backpack / FLIGHTS).
  const titleIconGap = Math.max(TRAVEL_TITLE_ICON_GAP, s(TRAVEL_TITLE_ICON_GAP));
  const headerGap = titleIconGap;
  const leadingIconSize = compact ? (nested ? 12 : 16) : undefined;
  // Hug the glyph so `titleIconGap` is the true space to the label (no phantom pad).
  const leadingIconBox =
    leadingIconSize !== undefined
      ? Math.max(leadingIconSize, s(leadingIconSize))
      : Math.max(28, s(30));
  const cardRadius = compact ? Math.max(11, s(12)) : Math.max(16, s(18));

  const header = (
    <View
      style={[
        styles.headerShell,
        {
          minHeight: tap,
          gap: headerGap,
          paddingLeft: nested ? 0 : spacing.md,
          paddingRight: nested ? 0 : spacing.md,
          paddingVertical: nested || compact ? 0 : spacing.xs,
          borderRadius: card || nested ? 0 : radii.lg,
          // Card shells frost via TravelHomeGlass; standalone headers stay clear.
          backgroundColor: 'transparent',
          borderWidth: card || nested ? 0 : StyleSheet.hairlineWidth,
          borderBottomWidth: card && expanded ? StyleSheet.hairlineWidth : 0,
          borderColor: nested
            ? 'transparent'
            : card
              ? onGlass
                ? 'rgba(255,255,255,0.12)'
                : 'rgba(17, 74, 110, 0.10)'
              : travelCardBorder(theme),
        },
      ]}>
      <AgentTestId
        testID={toggleTestID}
        label={label}
        onPress={onToggle}
        style={styles.toggleWrapper}>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ expanded }}
          accessibilityLabel={label}
          onPress={onToggle}
          hitSlop={
            compact
              ? nested
                ? 8
                : tightHeader
                  ? 6
                  : 2
              : nested
                ? 10
                : undefined
          }
          style={[styles.toggle, { minHeight: tap, gap: headerGap }]}>
          {icon ? (
            <View style={[styles.leadingIcon, { width: leadingIconBox }]}>
              <Symbol
                name={icon}
                size={leadingIconSize ?? 'sm'}
                color={accent}
              />
            </View>
          ) : null}
          <AppText
            variant={compact && nested ? 'overline' : titleVariant}
            color="accent"
            // Parent card titles ("Trip Tools", "Timeline") must not use fit —
            // adjustsFontSizeToFit was crushing them to unreadably small sizes
            // inside the glass header row. Nested kind labels may still shrink.
            fit={Boolean(compact && nested) || !compact}
            fitMinimumScale={compact && nested ? 0.9 : undefined}
            numberOfLines={1}
            style={[
              travelOverlineStyle,
              styles.title,
              compact && nested ? styles.compactNestedTitle : undefined,
              compact && !nested ? styles.compactCardTitle : undefined,
              { color: accent },
            ]}>
            {title}
          </AppText>
          {count !== undefined ? (
            <GlassTonePill
              label={String(count)}
              toneColor={accent}
              showDot={false}
            />
          ) : null}
          <View
            style={[
              styles.chevron,
              {
                minHeight: nested ? s(22) : chevronBox,
                minWidth: chevronBox,
                width: chevronBox,
                borderRadius: nested ? 0 : radii.pill,
                backgroundColor: 'transparent',
              },
            ]}>
            <DisclosureChevron
              expanded={expanded}
              size={nested ? 12 : 'sm'}
              color={accent}
            />
          </View>
        </Pressable>
      </AgentTestId>
      {onAddPress ? (
        <AgentTestId
          testID={addTestID}
          label={`Add to ${title}`}
          onPress={onAddPress}
          style={styles.addButton}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Add to ${title}`}
            onPress={onAddPress}
            hitSlop={6}
            style={[
              {
                minHeight: tap,
                minWidth: tap,
                borderRadius: radii.pill,
                backgroundColor: 'transparent',
              },
            ]}>
            <Symbol name="add" size="sm" color={accent} />
          </Pressable>
        </AgentTestId>
      ) : null}
    </View>
  );

  const body = (
    <CollapsibleBody expanded={expanded}>
      <View
        style={
          card
            ? {
                padding: flushContent
                  ? spacing.xxs
                  : compact
                    ? spacing.xs
                    : spacing.md,
              }
            : undefined
        }>
        {children}
      </View>
    </CollapsibleBody>
  );

  if (card) {
    return (
      <TravelHomeGlass
        {...shellProps}
        style={{
          borderRadius: cardRadius,
          borderCurve: 'continuous',
          boxShadow: compact ? TRAVEL_HEADER_SHADOW : undefined,
        }}>
        {header}
        {body}
      </TravelHomeGlass>
    );
  }

  return (
    <View style={[styles.section, { gap: compact ? spacing.xxs : spacing.sm }]}>
      {header}
      {body}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {},
  headerShell: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  toggle: {
    flex: 1,
    flexShrink: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
  },
  toggleWrapper: { flex: 1, minWidth: 0 },
  title: {
    ...travelEditorialTextStyle,
    flex: 1,
    flexShrink: 1,
    minWidth: 0,
  },
  chevron: {
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  addButton: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  leadingIcon: {
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  compactNestedTitle: {
    letterSpacing: 1.2,
  },
  /** Match icon optical center next to the 16pt leading glyph. */
  compactCardTitle: {
    flexGrow: 1,
    flexShrink: 1,
    minWidth: 0,
    letterSpacing: -0.1,
  },
});
