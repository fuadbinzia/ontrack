import { Pressable, StyleSheet, View } from 'react-native';

import {
    AppText,
    Button,
    GlassIconWell,
    GlassPrimaryAction,
    IconButton,
    Symbol,
    fieldTitleCase,
} from '@/components/primitives';
import { type AppIconName, glassMaterials } from '@/design-system';
import { travelEditorialTextStyle } from '@/features/travel/travel-chrome';
import { TravelHomeGlass } from '@/features/travel/travel-home-glass';
import {
    itinerarySheetChrome,
    type SheetIconTone,
} from '@/features/travel/travel-itinerary-sheet-chrome';
import {
    useTravelItineraryInk,
    useTravelItineraryMistProps,
    useTravelItineraryOnGlass,
} from '@/features/travel/use-travel-itinerary-glass';
import { useResponsive } from '@/hooks/use-responsive';
import { useTheme } from '@/hooks/use-theme';
import { AgentTestId } from '@/utils/agent-ui';
import { haptics } from '@/utils/haptics';

/** Compact trip action — mist tile on itinerary boards. */
export function TravelSheetAction({
  label,
  icon,
  badgeIcon,
  tone,
  onPress,
  accessibilityLabel,
  wide = false,
  testID,
}: {
  label: string;
  icon: AppIconName;
  badgeIcon?: AppIconName;
  tone: SheetIconTone;
  onPress: () => void;
  accessibilityLabel: string;
  wide?: boolean;
  testID?: string;
}) {
  const theme = useTheme();
  const chrome = itinerarySheetChrome(theme);
  const iconTone = chrome.icons[tone];
  const labelInk = useTravelItineraryInk();
  const mistProps = useTravelItineraryMistProps();
  const onGlass = useTravelItineraryOnGlass();
  const { s, spacing } = useResponsive();
  // Dense glass chips — keep ≥44pt hit via Pressable, trim visual chrome.
  const iconBox = Math.max(22, s(24));
  const badgeSize = Math.max(11, s(12));
  const radius = Math.max(10, s(11));
  const wellRadius = Math.max(7, s(8));
  const title = fieldTitleCase(label);
  const a11yLabel = fieldTitleCase(accessibilityLabel);
  const handlePress = () => {
    haptics.tap();
    onPress();
  };

  return (
    <AgentTestId
      testID={testID}
      label={a11yLabel}
      onPress={handlePress}
      // Flex lives on the registry wrapper so the 2-col grid fills the row.
      style={[styles.action, wide ? styles.actionWide : undefined]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={a11yLabel}
        onPress={handlePress}
        style={({ pressed }) => [
          styles.actionPressable,
          { opacity: pressed ? 0.82 : 1 },
        ]}>
        <TravelHomeGlass
          {...mistProps}
          style={[
            styles.actionGlass,
            {
              minHeight: Math.max(40, s(40)),
              paddingHorizontal: Math.max(10, spacing.sm),
              paddingVertical: Math.max(6, s(7)),
              borderRadius: radius,
            },
          ]}>
          <View style={[styles.actionContent, { gap: Math.max(6, spacing.xs) }]}>
            <View style={[styles.actionIcon, { width: iconBox, height: iconBox }]}>
              <GlassIconWell size={iconBox} borderRadius={wellRadius}>
                <Symbol name={icon} size={14} color={iconTone.fg} />
              </GlassIconWell>
              {badgeIcon ? (
                <View
                  style={[
                    styles.actionIconBadge,
                    {
                      width: badgeSize,
                      height: badgeSize,
                      borderRadius: badgeSize / 2,
                      backgroundColor: 'rgba(12,16,24,0.55)',
                      borderColor: onGlass
                        ? glassMaterials.border.mist
                        : glassMaterials.border.mistLight,
                    },
                  ]}>
                  <Symbol name={badgeIcon} size={8} color={iconTone.fg} />
                </View>
              ) : null}
            </View>
            <AppText
              variant="caption"
              fit
              align="center"
              style={[styles.actionLabel, { color: labelInk }]}>
              {title}
            </AppText>
          </View>
        </TravelHomeGlass>
      </Pressable>
    </AgentTestId>
  );
}

/** Wide sheet footer CTA — frosted sage glass (same material as View Itinerary). */
export function TravelSheetPrimaryAction({
  label,
  icon,
  onPress,
  disabled = false,
  editorialGold: _editorialGold = true,
  flat: _flat = false,
  flatColor: _flatColor,
  testID,
}: {
  label: string;
  icon?: AppIconName;
  onPress: () => void;
  disabled?: boolean;
  /** @deprecated Kept for call-site compatibility. */
  editorialGold?: boolean;
  /** @deprecated Kept for call-site compatibility. */
  flat?: boolean;
  /** @deprecated Kept for call-site compatibility. */
  flatColor?: string;
  testID?: string;
}) {
  return (
    <GlassPrimaryAction
      label={label}
      icon={icon}
      onPress={onPress}
      disabled={disabled}
      testID={testID}
    />
  );
}

/** Soft cream secondary CTA matching Friends sheet mock (Invite a Friend). */
export function TravelSheetSecondaryAction({
  label,
  icon,
  onPress,
  testID,
}: {
  label: string;
  icon?: AppIconName;
  onPress: () => void;
  testID?: string;
}) {
  return (
    <Button
      variant="secondary"
      icon={icon}
      testID={testID}
      accessibilityLabel={label}
      onPress={onPress}>
      {label}
    </Button>
  );
}

/** Circular chrome control (edit / collapse / add) matching sheet close button. */
export function TravelSheetIconControl({
  icon,
  onPress,
  accessibilityLabel,
  size,
  iconSize,
  tone = 'default',
  testID,
}: {
  icon: AppIconName;
  onPress: () => void;
  accessibilityLabel: string;
  size?: number;
  iconSize?: number;
  /** `accent` = gold icon on elevated cream (page header +). */
  tone?: 'default' | 'accent';
  testID?: string;
}) {
  const theme = useTheme();
  return (
    <IconButton
      appearance="glass"
      icon={icon}
      onPress={onPress}
      accessibilityLabel={accessibilityLabel}
      testID={testID}
      size={size}
      iconSize={iconSize}
      color={tone === 'accent' ? theme.accentPrimary : theme.textPrimary}
    />
  );
}

const styles = StyleSheet.create({
  actionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 1,
    minWidth: 0,
    width: '100%',
  },
  actionIcon: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    borderCurve: 'continuous',
  },
  actionIconBadge: {
    position: 'absolute',
    right: -3,
    bottom: -3,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
  },
  actionLabel: {
    ...travelEditorialTextStyle,
    flexShrink: 1,
    minWidth: 0,
    textAlign: 'center',
  },
  action: {
    flexGrow: 1,
    flexBasis: '47%',
    maxWidth: '100%',
    minWidth: 0,
  },
  actionWide: {
    flexBasis: '100%',
  },
  actionPressable: {
    width: '100%',
  },
  actionGlass: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderCurve: 'continuous',
  },
});
