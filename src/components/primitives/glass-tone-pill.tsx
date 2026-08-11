import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { glassMistPillShellStyle } from '@/design-system';
import { useResponsive } from '@/hooks/use-responsive';

import { AppText } from './app-text';
import { fieldTitleCase } from './field-title-case';
import { GlassPlate } from './glass-plate';

/**
 * Mist glass status / meta pill — tone-colored optional leading dot + caption.
 * Prefer this over solid `accentFaint` / sunken chips on atmosphere and glass boards.
 */
export function GlassTonePill({
  label,
  toneColor,
  textColor,
  showDot = true,
  testID,
  style,
}: {
  label: string;
  toneColor: string;
  /** Optional contrast-safe label ink when the semantic dot sits on dark glass. */
  textColor?: string;
  showDot?: boolean;
  testID?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const { spacing, s } = useResponsive();
  const title = fieldTitleCase(label);
  const dot = Math.max(6, s(7));

  return (
    <GlassPlate
      mist
      testID={testID}
      accessibilityRole="text"
      accessibilityLabel={title}
      style={[
        styles.pill,
        glassMistPillShellStyle({ spacingSm: spacing.sm, s }),
        { gap: spacing.sm },
        style,
      ]}>
      {showDot ? (
        <View
          style={{
            width: dot,
            height: dot,
            borderRadius: dot / 2,
            backgroundColor: toneColor,
          }}
        />
      ) : null}
      <AppText
        variant="caption"
        align="center"
        numberOfLines={1}
        style={{
          color: textColor ?? toneColor,
          flexShrink: 1,
          minWidth: 0,
          textAlign: 'center',
        }}>
        {title}
      </AppText>
    </GlassPlate>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
