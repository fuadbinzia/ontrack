import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText, GlassIconWell, GlassPlate, Symbol } from '@/components/primitives';
import type { AppIconName } from '@/design-system';
import { fontFamilies, radii } from '@/design-system';
import { travelOverlineStyle } from '@/features/travel/travel-chrome';
import { travelCardShadow } from '@/features/travel/travel-surface';
import {
    useTravelItineraryInk,
    useTravelItineraryOnGlass,
    useTravelItineraryShellProps,
} from '@/features/travel/use-travel-itinerary-glass';
import { useResponsive } from '@/hooks/use-responsive';
import { useTheme } from '@/hooks/use-theme';

export type TravelDetailsSummaryRow = {
  label: string;
  value?: string;
  detail?: string;
  icon?: AppIconName;
  /** Brand mark filling the icon well instead of the glyph (airline logos). */
  mark?: ReactNode;
};

export function TravelDetailsSummaryCard({
  title,
  subtitle,
  icon,
  mark,
  markStandalone = false,
  accentColor,
  confirmationCode,
  onPressConfirmation,
  rows,
  children,
}: {
  title: string;
  subtitle?: string;
  icon: AppIconName;
  /** Brand mark filling the header well instead of the glyph. */
  mark?: ReactNode;
  /** When true, `mark` owns chrome (e.g. bare OTA logo — no outer well). */
  markStandalone?: boolean;
  accentColor: string;
  confirmationCode?: string;
  onPressConfirmation?: () => void;
  rows: TravelDetailsSummaryRow[];
  children?: ReactNode;
}) {
  const theme = useTheme();
  const { s, spacing: rs } = useResponsive();
  const primaryInk = useTravelItineraryInk();
  const secondaryInk = useTravelItineraryInk('secondary');
  const onGlass = useTravelItineraryOnGlass();
  const shellProps = useTravelItineraryShellProps();
  const divider = onGlass ? 'rgba(255,255,255,0.16)' : theme.separator;
  const iconWellSize = Math.max(44, s(48));
  const wellRadius = Math.max(radii.md, s(14));

  return (
    <GlassPlate
      {...shellProps}
      style={[
        styles.card,
        {
          borderRadius: Math.max(radii.lg, s(18)),
          boxShadow: travelCardShadow(theme),
          padding: rs.lg,
          gap: rs.md,
        },
      ]}>
      <View style={[styles.header, { gap: rs.md }]}>
        {mark && markStandalone ? (
          mark
        ) : (
          <GlassIconWell size={iconWellSize} borderRadius={wellRadius}>
            {mark ?? <Symbol name={icon} size="lg" color={accentColor} />}
          </GlassIconWell>
        )}
        <View style={[styles.titleCopy, { gap: rs.xxs }]}>
          <AppText
            variant="heading"
            numberOfLines={2}
            style={[styles.editorialTitle, { color: primaryInk }]}>
            {title}
          </AppText>
          {subtitle ? (
            <AppText
              variant="caption"
              numberOfLines={2}
              style={{ color: secondaryInk }}>
              {subtitle}
            </AppText>
          ) : null}
        </View>
        {confirmationCode ? (
          <Pressable
            accessibilityRole={onPressConfirmation ? 'button' : undefined}
            accessibilityLabel={
              onPressConfirmation
                ? `View confirmation ${confirmationCode}`
                : undefined
            }
            disabled={!onPressConfirmation}
            hitSlop={8}
            onPress={onPressConfirmation}
            style={({ pressed }) => [
              styles.confirmation,
              pressed && styles.pressed,
            ]}>
            <AppText
              variant="overline"
              numberOfLines={1}
              style={[travelOverlineStyle, { color: secondaryInk }]}>
              Confirmation
            </AppText>
            <AppText
              variant="subheading"
              selectable
              numberOfLines={2}
              style={[styles.confirmationValue, { color: primaryInk }]}>
              {confirmationCode}
            </AppText>
          </Pressable>
        ) : null}
      </View>

      {rows.length ? (
        <View style={[styles.rows, { borderTopColor: divider }]}>
          {rows.map((row, index) => (
            <View
              key={`${row.label}-${index}`}
              style={[
                styles.row,
                {
                  gap: rs.md,
                  paddingVertical: rs.md,
                  borderTopColor: divider,
                },
                index > 0 && styles.rowDivider,
              ]}>
              <GlassIconWell size={iconWellSize} borderRadius={wellRadius}>
                {row.mark ?? (
                  <Symbol
                    name={row.icon ?? 'calendar'}
                    size="md"
                    color={accentColor}
                  />
                )}
              </GlassIconWell>
              <View style={[styles.rowCopy, { gap: rs.xxs }]}>
                <AppText
                  variant="overline"
                  fit
                  style={[travelOverlineStyle, { color: secondaryInk }]}>
                  {row.label}
                </AppText>
                {row.value ? (
                  <AppText
                    variant="subheading"
                    fit
                    selectable
                    style={{ color: primaryInk }}>
                    {row.value}
                  </AppText>
                ) : null}
                {row.detail ? (
                  <AppText
                    variant="caption"
                    numberOfLines={2}
                    style={{ color: secondaryInk }}>
                    {row.detail}
                  </AppText>
                ) : null}
              </View>
            </View>
          ))}
        </View>
      ) : null}

      {children}
    </GlassPlate>
  );
}

const styles = StyleSheet.create({
  card: {
    borderCurve: 'continuous',
    overflow: 'hidden',
  },
  header: { flexDirection: 'row', alignItems: 'center' },
  titleCopy: { flex: 1, minWidth: 0, flexShrink: 1 },
  editorialTitle: { fontFamily: fontFamilies.serif },
  confirmation: { maxWidth: '42%', alignItems: 'flex-end', flexShrink: 1 },
  confirmationValue: { textAlign: 'right', fontVariant: ['tabular-nums'] },
  pressed: { opacity: 0.7 },
  rows: { borderTopWidth: StyleSheet.hairlineWidth },
  row: { flexDirection: 'row', alignItems: 'center' },
  rowDivider: { borderTopWidth: StyleSheet.hairlineWidth },
  rowCopy: { flex: 1, minWidth: 0, flexShrink: 1 },
});
