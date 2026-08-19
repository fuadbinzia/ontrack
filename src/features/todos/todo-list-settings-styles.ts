import { StyleSheet } from 'react-native';

import { radii } from '@/design-system';

export const checklistSettingsStyles = StyleSheet.create({
  container: {
    width: '100%',
    maxWidth: 680,
    alignSelf: 'center',
  },
  center: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.pill,
  },
  memberCopy: { flex: 1, flexShrink: 1, minWidth: 0, gap: 2 },
  memberActions: {
    flexShrink: 0,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
});
