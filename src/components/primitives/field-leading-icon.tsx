import { View } from 'react-native';

import type { AppIconName } from '@/design-system';
import { radii } from '@/design-system';
import { useResponsive } from '@/hooks/use-responsive';
import { useTheme } from '@/hooks/use-theme';

import { fieldLeadingIconPlateSize } from './field-leading-icon-style';
import { GlassIconWell } from './glass-icon-well';
import { Symbol } from './symbol';

export {
  fieldLeadingIconPlateSize,
  fieldLeadingIconRowStyle,
  iconMultilineOpticalPad,
} from './field-leading-icon-style';

/** Shared leading-icon column so Input / DateField / TimeField placeholders share one x-origin. */
export function FieldLeadingIcon({
  name,
  backgroundColor,
  color,
  size,
}: {
  name: AppIconName | (string & {});
  /**
   * When set, renders a frosted glass plate behind the glyph.
   * Fill color is ignored — mist GlassIconWell owns the material.
   */
  backgroundColor?: string;
  color?: string;
  /** Override plate edge length (e.g. StackedIconField matching label+value). */
  size?: number;
}) {
  const theme = useTheme();
  const { iconSizes, s } = useResponsive();
  const withPlate = Boolean(backgroundColor);
  const plate =
    size
    ?? fieldLeadingIconPlateSize({
      iconSize: iconSizes.sm,
      s,
      withPlate,
    });
  const glyph = (
    <Symbol name={name} size="sm" color={color ?? theme.textSecondary} />
  );

  if (!withPlate) {
    return (
      <View
        style={{
          width: plate,
          height: plate,
          alignItems: 'center',
          justifyContent: 'center',
          alignSelf: 'center',
          flexShrink: 0,
        }}>
        {glyph}
      </View>
    );
  }

  return (
    <GlassIconWell
      size={plate}
      borderRadius={radii.sm}
      style={{ alignSelf: 'center' }}>
      {glyph}
    </GlassIconWell>
  );
}
