import { StyleSheet, View } from 'react-native';

import {
  AppText,
  Button,
  GlassPlate,
  IconButton,
} from '@/components/primitives';
import { radii, spacing } from '@/design-system';
import { dismissTravelChatAlertsBanner } from '@/features/travel/chat';
import { travelChatPlateBorder } from '@/features/travel/travel-chat-chrome';
import { TravelSheetPrimaryAction } from '@/features/travel/travel-list-actions';
import { TravelSheetModal } from '@/features/travel/travel-sheet';
import { useResponsive } from '@/hooks/use-responsive';
import { useTheme } from '@/hooks/use-theme';
import { AgentUiIds } from '@/utils/agent-ui';

export function TravelChatAlertsSettings({
  visible,
  canEnableAlerts,
  enablingNotifications,
  notificationsEnabled,
  notificationsAvailable,
  onClose,
  onEnableNotifications,
}: {
  visible: boolean;
  canEnableAlerts: boolean;
  enablingNotifications: boolean;
  notificationsEnabled: boolean;
  notificationsAvailable: boolean;
  onClose: () => void;
  onEnableNotifications: () => void;
}) {
  return (
    <TravelSheetModal
      visible={visible}
      eyebrow="Chat"
      title="Chat Settings"
      subtitle="New-message alerts"
      subtitleIcon="chat"
      onClose={onClose}
      closeAccessibilityLabel="Close chat settings"
      closeTestID={AgentUiIds.travel.chat.settingsClose}
      footer={
        canEnableAlerts ? (
          <TravelSheetPrimaryAction
            label={enablingNotifications ? 'Turning On…' : 'Turn On Alerts'}
            icon="smart"
            disabled={enablingNotifications}
            testID={AgentUiIds.travel.chat.settingsEnableNotifications}
            onPress={onEnableNotifications}
          />
        ) : undefined
      }>
      <AppText variant="body" color="secondary">
        {notificationsEnabled
          ? 'Alerts are on. You’ll hear about new trip messages even when the app is closed.'
          : notificationsAvailable
            ? 'Stay in the loop when the app is closed. Turn on alerts anytime from here.'
            : 'Push alerts aren’t available in this app build. Chat still works normally.'}
      </AppText>
    </TravelSheetModal>
  );
}

export function TravelChatAlertsBanner({
  visible,
  deviceReady,
  enablingNotifications,
  onEnableNotifications,
  onDismiss,
}: {
  visible: boolean;
  deviceReady: boolean;
  enablingNotifications: boolean;
  onEnableNotifications: () => void;
  onDismiss: () => void;
}) {
  const theme = useTheme();
  const { layout: responsiveLayout, spacing: rs, s } = useResponsive();

  if (!visible) return null;

  return (
    <GlassPlate
      intensity={52}
      style={[
        styles.notificationBanner,
        {
          marginHorizontal: responsiveLayout.screenPadding,
          marginBottom: rs.sm,
          zIndex: 1,
          borderColor: travelChatPlateBorder(theme),
        },
      ]}>
      <View style={[styles.bannerCopy, { zIndex: 1 }]}>
        <AppText variant="callout" color="accent" fit>
          Get New-Message Alerts
        </AppText>
        <AppText variant="caption" color="secondary" fit>
          Stay in the Loop When the App Is Closed.
        </AppText>
      </View>
      <View style={[styles.bannerActions, { zIndex: 1, gap: rs.xs }]}>
        <Button
          testID={AgentUiIds.travel.chat.enableNotifications}
          loading={enablingNotifications}
          disabled={!deviceReady}
          onPress={onEnableNotifications}>
          Turn On
        </Button>
        <IconButton
          icon="close"
          size={Math.max(36, s(36))}
          accessibilityLabel="Dismiss new-message alerts"
          testID={AgentUiIds.travel.chat.dismissNotifications}
          onPress={onDismiss}
        />
      </View>
    </GlassPlate>
  );
}

const styles = StyleSheet.create({
  notificationBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.lg,
    borderCurve: 'continuous',
  },
  bannerCopy: { flex: 1, gap: spacing.xxs, minWidth: 0, flexShrink: 1 },
  bannerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 0,
  },
});
