import { StyleSheet } from 'react-native';

export const travelItineraryTimelineStyles = StyleSheet.create({
  timeline: {},
  dayConnector: {
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  dayBody: {
    flex: 1,
    minWidth: 0,
  },
  dayRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    minWidth: 0,
  },
  dayContent: {
    flex: 1,
    minWidth: 0,
  },
  eventStack: {
    width: '100%',
    minWidth: 0,
  },
  nowInStack: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    minWidth: 0,
  },
  nowInStackLabel: {
    flexShrink: 1,
    minWidth: 0,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  eventShell: {
    width: '100%',
    minWidth: 0,
  },
  spineColumn: {
    alignItems: 'center',
    flexShrink: 0,
    position: 'relative',
  },
  dayMarker: {
    zIndex: 1,
  },
  spineLine: {
    position: 'absolute',
    width: 2,
    borderRadius: 1,
  },
  emptyCard: {
    alignItems: 'flex-start',
  },
  emptyIcon: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
