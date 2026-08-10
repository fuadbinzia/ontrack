import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, View } from 'react-native';

import { AppText, GlassPlate } from '@/components/primitives';
import { fontFamilies, radii, spacing } from '@/design-system';
import { useTheme } from '@/hooks/use-theme';

import { visionBoardImageSource } from './sample';
import type {
  VisionBoardAffirmationItem,
  VisionBoardImageItem,
} from './types';

export function VisionBoardDashboardHero({
  affirmation,
  heroImage,
  itemCount,
}: {
  affirmation?: VisionBoardAffirmationItem;
  heroImage?: VisionBoardImageItem;
  itemCount: number;
}) {
  const theme = useTheme();
  return (
      <View style={styles.hero}>
        {heroImage ? (
          <Image
            source={visionBoardImageSource(heroImage.uri)}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            accessibilityLabel={heroImage.caption || 'Latest vision board image'}
          />
        ) : null}
        <LinearGradient
          colors={
            heroImage
              ? ['rgba(18,20,17,0.18)', 'rgba(18,20,17,0.82)']
              : theme.name === 'light'
                ? ['#9BAA91', '#344A3A']
                : ['#536351', '#1B281E']
          }
          style={StyleSheet.absoluteFill}
        />
        <View style={styles.heroContent}>
          <GlassPlate airy style={styles.heroPill}>
            <AppText style={styles.heroPillMark}>“</AppText>
            <AppText variant="caption" style={styles.heroPillText}>
              Today’s Affirmation
            </AppText>
          </GlassPlate>
          <View style={styles.heroCopy}>
            <AppText
              style={[styles.heroQuote, { fontFamily: fontFamilies.serif }]}
              numberOfLines={3}>
              {affirmation?.text || 'I am creating a life that feels true to me.'}
            </AppText>
            <View style={styles.heroDivider} />
            <AppText variant="callout" style={styles.heroSupport}>
              {affirmation?.attribution
                ? affirmation.attribution
                : itemCount
                  ? 'Focus. Align. Manifest.'
                  : 'Add your first affirmation to make this space yours.'}
            </AppText>
          </View>
        </View>
        <View style={styles.heroPagination} pointerEvents="none">
          {[0, 1, 2, 3, 4].map((dot) => (
            <View
              key={dot}
              style={[
                styles.heroDot,
                dot === 2 ? styles.heroDotActive : styles.heroDotInactive,
              ]}
            />
          ))}
        </View>
      </View>
  );
}

const styles = StyleSheet.create({
  hero: {
    width: '100%',
    maxHeight: 280,
    aspectRatio: 1.86,
    overflow: 'hidden',
    borderRadius: 22,
    borderCurve: 'continuous',
    boxShadow: '0 7px 22px rgba(43, 36, 29, 0.11)',
  },
  heroContent: {
    flex: 1,
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 28,
  },
  heroPill: {
    alignSelf: 'flex-start',
    zIndex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radii.pill,
  },
  heroPillMark: {
    color: '#FFFFFF',
    fontFamily: fontFamilies.serif,
    fontSize: 18,
    lineHeight: 16,
    fontWeight: '600',
  },
  heroPillText: {
    color: '#FFFFFF',
    fontFamily: fontFamilies.serif,
    fontSize: 11.5,
    lineHeight: 14,
    fontWeight: '400',
  },
  heroCopy: { alignItems: 'flex-start', gap: spacing.sm },
  heroQuote: {
    maxWidth: '72%',
    color: '#FFFFFF',
    fontSize: 23,
    lineHeight: 28,
    fontWeight: '400',
  },
  heroDivider: {
    width: 20,
    height: 1.5,
    borderRadius: radii.pill,
    backgroundColor: 'rgba(255,255,255,0.9)',
  },
  heroSupport: {
    color: 'rgba(255,255,255,0.86)',
    fontFamily: fontFamilies.serif,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '400',
  },
  heroPagination: {
    position: 'absolute',
    bottom: 9,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 7,
  },
  heroDot: { width: 6, height: 6, borderRadius: 3 },
  heroDotActive: { backgroundColor: '#FFFFFF' },
  heroDotInactive: { backgroundColor: 'rgba(255,255,255,0.48)' }
});
