import { StyleSheet } from 'react-native';

import { radii, spacing } from '@/design-system';

export const activityFormStyles = StyleSheet.create({
  root: { flex: 1 },
  screen: { gap: spacing.lg },
  header: { gap: spacing.sm },
  headerTitle: { alignSelf: 'stretch', minWidth: 0 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  actions: { gap: spacing.sm, paddingTop: spacing.md },
  assistant: { gap: spacing.md },
  assistantHeading: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  assistantDot: { width: 8, height: 8, borderRadius: radii.pill },
  followUp: { gap: spacing.md, borderTopWidth: 1, paddingTop: spacing.lg, marginTop: spacing.xs },
});
