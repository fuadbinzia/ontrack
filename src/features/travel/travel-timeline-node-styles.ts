import { StyleSheet } from 'react-native';

import { radii, spacing } from '@/design-system';

export const travelTimelineNodeStyles = StyleSheet.create({
  nodeCard: {
    flex: 1,
    minWidth: 0,
  },
  nodeBody: {
    flex: 1,
    minWidth: 0,
  },
  addressLink: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radii.md,
    borderCurve: 'continuous',
  },
  addressCopy: { flex: 1, minWidth: 0, flexShrink: 1 },
  itemSizeAction: {
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  itemHeader: { flexDirection: 'row', alignItems: 'center' },
  denseTime: {
    flexShrink: 0,
    justifyContent: 'center',
    alignSelf: 'stretch',
  },
  denseTimeLabel: {
    flexShrink: 1,
    minWidth: 0,
    textAlign: 'left',
  },
  pressed: { opacity: 0.6 },
  flex: { flex: 1, minWidth: 0, flexShrink: 1, gap: spacing.xxs },
  denseCopy: {
    gap: 0,
    justifyContent: 'center',
  },
  centeredCaption: { textAlign: 'center', width: '100%' },
});
