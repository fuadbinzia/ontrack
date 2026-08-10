import { StyleSheet, View } from 'react-native';

import { GlassPlate } from '@/components/primitives';
import { colorWithAlpha } from '@/design-system';
import { useResponsive } from '@/hooks/use-responsive';
import { useTheme } from '@/hooks/use-theme';

import { authPalette } from './auth-palette';

/**
 * onTrack lens mark — a mist disc holding a tilted orbit ring and the
 * ink bead that rides it. Dusty-blue shell mark (mock), not app-wide copper.
 */
export function AuthBrandMark({ size }: { size?: number }) {
  const theme = useTheme();
  const { s } = useResponsive();
  const box = size ?? Math.max(40, s(44));
  const ring = box * 0.58;
  const bead = Math.max(5, box * 0.17);
  const ink = theme.name === 'dark' ? authPalette.nightDust : authPalette.ink;
  const rim = theme.name === 'dark' ? authPalette.nightFog : authPalette.dust;

  return (
    <GlassPlate
      mist
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        styles.disc,
        {
          width: box,
          height: box,
          borderRadius: box / 2,
          borderColor: colorWithAlpha(rim, 0.4),
        },
      ]}>
      <View
        style={[
          styles.ring,
          {
            width: ring,
            height: ring,
            borderRadius: ring / 2,
            borderColor: colorWithAlpha(ink, 0.78),
          },
        ]}
      />
      <View
        style={[
          styles.bead,
          {
            width: bead,
            height: bead,
            borderRadius: bead / 2,
            backgroundColor: ink,
            top: box * 0.18,
            right: box * 0.2,
          },
        ]}
      />
    </GlassPlate>
  );
}

const styles = StyleSheet.create({
  disc: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    flexShrink: 0,
  },
  ring: { borderWidth: 1, transform: [{ rotate: '-24deg' }, { scaleY: 0.82 }] },
  bead: { position: 'absolute' },
});
