import { Platform, StyleSheet } from 'react-native';

import { fontFamilies, layout, radii, spacing } from '@/design-system';

export const groceryListScreenStyles = StyleSheet.create({
  screenContent: {
    flex: 1,
    width: '100%',
    maxWidth: layout.maxContentWidth,
    alignSelf: 'center',
  },
  listContent: {
    paddingTop: Platform.select({ web: 64, default: spacing.sm }),
  },
  center: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.lg,
  },
  header: { gap: spacing.xl },
  heading: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  headingCopy: { flex: 1, minWidth: 0, gap: spacing.xs },
  title: {
    fontFamily: fontFamilies.serif,
    fontWeight: '400',
    letterSpacing: -0.7,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  memberNotice: { flex: 1 },
  iconButtonWrap: {
    borderRadius: radii.pill,
  },
  iconButton: {
    width: layout.minTapTarget,
    height: layout.minTapTarget,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmented: {
    flexDirection: 'row',
    padding: spacing.xs,
    borderRadius: radii.pill,
  },
  segmentPressable: {
    flex: 1,
    minHeight: layout.minTapTarget,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.pill,
  },
  segmentSelected: {
    ...StyleSheet.absoluteFill,
    borderRadius: radii.pill,
  },
  segmentLabel: { zIndex: 1 },
  iconGlyph: { zIndex: 1 },
  row: { marginBottom: spacing.lg },
  sectionHeading: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  emptyCombined: { padding: spacing.xxl },
  emptyRecipe: {
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.xxl,
  },
});
