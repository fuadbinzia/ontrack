import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import {
    AppText,
    CollapsibleBody,
    DisclosureChevron,
    GlassIconWell,
    Symbol,
} from '@/components/primitives';
import { glassMaterials, radii } from '@/design-system';
import {
    TRAVEL_TITLE_ICON_GAP,
    travelEditorialTextStyle,
} from '@/features/travel/travel-chrome';
import { TravelHomeGlass } from '@/features/travel/travel-home-glass';
import { itinerarySheetChrome } from '@/features/travel/travel-itinerary-sheet-chrome';
import {
    useTravelItineraryInk,
    useTravelItineraryOnGlass,
    useTravelItineraryShellProps,
} from '@/features/travel/use-travel-itinerary-glass';
import { useResponsive } from '@/hooks/use-responsive';
import { useTheme } from '@/hooks/use-theme';
import { useAgentUiTarget } from '@/utils/agent-ui';
import { haptics } from '@/utils/haptics';

const NOTES_CARD_SHADOW = '0 4px 14px rgba(0, 0, 0, 0.22)';

/** Trip notes strip — glass card matching the dates row. */
export function TravelTripNotesCard({
  notes,
  toggleTestID,
  editTestID,
  onEdit,
  defaultExpanded = false,
  expanded: expandedProp,
  onExpandedChange,
  /** Denser frost while an expanded flight card darkens the hero stack. */
  denseGlass = false,
}: {
  notes: string;
  toggleTestID?: string;
  editTestID?: string;
  onEdit?: () => void;
  defaultExpanded?: boolean;
  expanded?: boolean;
  onExpandedChange?: (expanded: boolean) => void;
  denseGlass?: boolean;
}) {
  const theme = useTheme();
  const chrome = itinerarySheetChrome(theme);
  const noteTone = chrome.icons.note;
  const primaryInk = useTravelItineraryInk();
  const secondaryInk = useTravelItineraryInk('secondary');
  const tertiaryInk = useTravelItineraryInk('tertiary');
  const shellProps = useTravelItineraryShellProps({ dense: denseGlass });
  const onGlass = useTravelItineraryOnGlass();
  const divider = onGlass
    ? glassMaterials.border.dark
    : glassMaterials.clear.lightBorder;
  const { s, spacing: rs, typography } = useResponsive();
  const [uncontrolled, setUncontrolled] = useState(defaultExpanded);
  const expanded = expandedProp ?? uncontrolled;
  const trimmed = notes.trim();
  const canEdit = Boolean(onEdit);

  // Match Transportation compact card title scale (subheading), not caption.
  const iconBox = Math.max(28, s(30));
  const titleIconGap = Math.max(TRAVEL_TITLE_ICON_GAP, s(TRAVEL_TITLE_ICON_GAP));
  const tap = Math.max(40, s(40));
  const chevronBox = Math.max(24, s(24));
  const accessibilityLabel = expanded ? `Notes, expanded` : `Notes, collapsed`;
  const bodyLabel = trimmed
    ? canEdit
      ? `Edit notes: ${trimmed}`
      : `Notes: ${trimmed}`
    : 'Add trip notes';
  const bodyCopy = trimmed || 'Tap to add notes…';

  const setExpanded = (next: boolean) => {
    if (expandedProp === undefined) setUncontrolled(next);
    onExpandedChange?.(next);
  };
  const toggle = () => {
    haptics.select();
    setExpanded(!expanded);
  };
  const openEdit = () => {
    if (!onEdit) return;
    haptics.tap();
    onEdit();
  };
  const agent = useAgentUiTarget(toggleTestID, {
    label: accessibilityLabel,
    onPress: toggle,
  });
  const editAgent = useAgentUiTarget(editTestID, {
    label: bodyLabel,
    onPress: canEdit ? openEdit : undefined,
  });
  if (!trimmed && !canEdit) return null;

  const radius = Math.max(12, s(14));

  return (
    <TravelHomeGlass
      {...shellProps}
      style={[
        styles.card,
        {
          boxShadow: NOTES_CARD_SHADOW,
          borderRadius: radius,
        },
      ]}>
      <Pressable
        ref={agent.ref}
        testID={toggleTestID}
        onLayout={agent.onLayout}
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        accessibilityLabel={accessibilityLabel}
        accessibilityHint={expanded ? 'Collapses trip notes' : 'Expands trip notes'}
        onPress={toggle}
        hitSlop={2}
        style={({ pressed }) => [
          styles.header,
          {
            minHeight: tap,
            gap: titleIconGap,
            paddingHorizontal: rs.md,
            paddingVertical: rs.xs,
          },
          pressed && styles.pressed,
        ]}>
        <GlassIconWell size={iconBox} borderRadius={radii.sm}>
          <Symbol name="note" size={16} color={noteTone.fg} />
        </GlassIconWell>
        <AppText
          variant="subheading"
          numberOfLines={1}
          style={[
            styles.label,
            styles.title,
            {
              color: primaryInk,
              letterSpacing: -0.1,
            },
          ]}>
          Notes
        </AppText>
        <View
          style={[
            styles.chevron,
            {
              minHeight: chevronBox,
              minWidth: chevronBox,
              width: chevronBox,
            },
          ]}>
          <DisclosureChevron
            expanded={expanded}
            size="sm"
            color={primaryInk}
          />
        </View>
      </Pressable>
      <CollapsibleBody expanded={expanded}>
        <Pressable
          ref={editAgent.ref}
          testID={editTestID}
          onLayout={editAgent.onLayout}
          accessibilityRole={canEdit ? 'button' : 'text'}
          accessibilityLabel={bodyLabel}
          accessibilityHint={canEdit ? 'Opens the trip notes editor' : undefined}
          disabled={!canEdit}
          onPress={canEdit ? openEdit : undefined}
          style={({ pressed }) => [
            styles.bodyWrap,
            {
              borderTopColor: divider,
              // Align note copy with the "Notes" title (after icon + gap).
              paddingLeft: rs.md + iconBox + titleIconGap,
              paddingRight: rs.md,
              paddingTop: rs.sm,
              paddingBottom: Math.max(rs.md, s(14)),
              minHeight: tap,
            },
            canEdit && pressed && styles.pressed,
          ]}>
          <AppText
            variant="callout"
            style={[
              styles.body,
              {
                color: trimmed ? secondaryInk : tertiaryInk,
                fontSize: Math.max(14, typography.callout.fontSize),
                lineHeight: Math.max(20, typography.callout.lineHeight + 1),
              },
            ]}>
            {bodyCopy}
          </AppText>
        </Pressable>
      </CollapsibleBody>
    </TravelHomeGlass>
  );
}

const styles = StyleSheet.create({
  card: {
    borderCurve: 'continuous',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  title: {
    flex: 1,
    flexShrink: 1,
    minWidth: 0,
  },
  chevron: {
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  bodyWrap: {
    width: '100%',
    borderTopWidth: StyleSheet.hairlineWidth,
    justifyContent: 'center',
  },
  label: {
    ...travelEditorialTextStyle,
    fontWeight: '400',
  },
  body: {
    ...travelEditorialTextStyle,
    fontWeight: '400',
    letterSpacing: -0.15,
  },
  pressed: { opacity: 0.72 },
});
