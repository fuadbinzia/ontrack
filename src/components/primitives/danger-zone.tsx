import {
    Children,
    type PropsWithChildren,
    type ReactNode,
} from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';

import { radii } from '@/design-system';
import { useResponsive } from '@/hooks/use-responsive';
import { useTheme } from '@/hooks/use-theme';
import { AgentTestId } from '@/utils/agent-ui';

import { GlassPlate } from './glass-plate';
import { SectionHeader } from './section-header';

type DangerZoneProps = PropsWithChildren<{
  /**
   * Overline above the panel. Defaults to "Danger Zone".
   * Pass `null` to hide the title (panel only).
   */
  title?: string | null;
  testID?: string;
  style?: ViewStyle;
}>;

/**
 * Danger zone: overline title + red-rimmed glass panel for irreversible actions.
 * Place `DestructiveSection flush` (or other danger CTAs) as children.
 */
export function DangerZone({
  title,
  testID,
  style,
  children,
}: DangerZoneProps) {
  const theme = useTheme();
  const { spacing } = useResponsive();
  const items = Children.toArray(children).filter(Boolean) as ReactNode[];
  const heading = title === undefined ? 'Danger Zone' : title;

  return (
    <AgentTestId
      testID={testID}
      label={heading ?? 'Danger Zone'}
      style={[{ gap: spacing.sm, width: '100%' }, style]}>
      {heading ? (
        <SectionHeader title={heading} flush titleColor="danger" />
      ) : null}
      <GlassPlate
        style={[
          styles.panel,
          {
            borderColor: theme.danger,
            borderWidth: StyleSheet.hairlineWidth * 2,
            padding: spacing.md,
            gap: spacing.md,
          },
        ]}>
        {items.map((child, index) => (
          <View key={index} style={{ gap: spacing.md }}>
            {index > 0 ? (
              <View
                style={[styles.divider, { backgroundColor: theme.danger }]}
              />
            ) : null}
            {child}
          </View>
        ))}
      </GlassPlate>
    </AgentTestId>
  );
}

const styles = StyleSheet.create({
  panel: {
    width: '100%',
    borderRadius: radii.md,
    borderCurve: 'continuous',
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    width: '100%',
    opacity: 0.45,
  },
});
