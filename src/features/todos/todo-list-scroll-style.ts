import type { ViewStyle } from 'react-native';

import { spacing } from '@/design-system';

/**
 * FlatList `flexGrow: 1` on a populated checklist parks the first row near the
 * bottom on the opening layout pass, then the next pass snaps it to the top.
 */
export function checklistScrollContentStyle(hasRows: boolean): ViewStyle {
  return hasRows ? { flexGrow: 0 } : { flexGrow: 1 };
}

export function checklistDismissFooterStyle(): ViewStyle {
  return { minHeight: spacing.xxl * 3 };
}
