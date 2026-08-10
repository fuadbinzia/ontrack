import { StyleSheet, View } from 'react-native';

import { activityFormStyles as styles } from '@/app/activity-form-styles';
import {
  AppText,
  Screen,
  ScreenAtmosphere,
  SheetGrabber,
} from '@/components/primitives';
import { AgentUiIds } from '@/utils/agent-ui';

export function ActivityFormMissingScreen({
  atmosphereFloor,
  onLeave,
}: {
  atmosphereFloor: string;
  onLeave: () => void;
}) {
  return (
    <View style={[styles.root, { backgroundColor: atmosphereFloor }]}>
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        <ScreenAtmosphere />
      </View>
      <Screen refresh={false}>
        <View style={styles.header}>
          <SheetGrabber
            testID={AgentUiIds.activityForm.grabber}
            onPress={onLeave}
            accessibilityLabel="Dismiss"
          />
          <AppText variant="title" style={styles.headerTitle} fit>
            Event Not Found
          </AppText>
        </View>
        <AppText variant="body" color="secondary">
          This event may have been deleted.
        </AppText>
      </Screen>
    </View>
  );
}
