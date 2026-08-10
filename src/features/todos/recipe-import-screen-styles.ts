import { Platform, StyleSheet } from 'react-native';

import { layout, radii, spacing } from '@/design-system';

export const recipeImportScreenStyles = StyleSheet.create({
  screen: {
    width: '100%',
    maxWidth: layout.maxContentWidth,
    alignSelf: 'center',
    gap: spacing.xl,
    paddingTop: Platform.select({ web: 64, default: spacing.sm }),
  },
  center: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.lg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  headerCopy: { flex: 1, gap: spacing.xs },
  sourceSection: { gap: spacing.lg },
  urlCard: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.md,
  },
  flex: { flex: 1 },
  pickerActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  analyzing: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  analyzingCopy: { flex: 1, gap: spacing.xs },
  detailsCard: { gap: spacing.lg },
  servingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  imageSource: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  warningCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  optionCard: {
    borderRadius: radii.lg,
  },
});
