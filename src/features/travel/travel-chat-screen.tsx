import { FlashList } from '@shopify/flash-list';
import { useRouter, type Href } from 'expo-router';
import { useBottomTabBarHeight } from 'expo-router/js-tabs';
import { useCallback, useEffect, useMemo, useRef, useState, type ComponentRef } from 'react';
import {
  Platform,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { bottomNavBottomPad } from '@/components/navigation/bottom-nav-inset';
import {
  EmptyState,
  ErrorMessage,
  IconButton,
  LoadingBlock,
  ScreenAtmosphere,
  screenAtmosphereBottomColor,
  screenAtmosphereTopColor,
  usePageSurfaceBackground,
  useSafeAreaChrome,
  useSafeAreaChromeOverlay,
} from '@/components/primitives';
import { layout, spacing } from '@/design-system';
import { useAuthSession } from '@/features/auth/auth-provider';
import {
  buildTravelChatListItems,
  dismissTravelChatAlertsBanner,
  type OptimisticTravelChatMessage,
  type TravelChatListItem,
} from '@/features/travel/chat';
import {
  TravelChatAlertsBanner,
  TravelChatAlertsSettings,
} from '@/features/travel/travel-chat-alerts';
import { TravelChatAccessGate } from '@/features/travel/travel-chat-access-gate';
import {
  TravelChatDateSeparator,
  TravelChatDestinationStamp,
  TravelChatLandscape,
  TravelChatMemberStack,
  travelChatPalette,
} from '@/features/travel/travel-chat-chrome';
import { TravelChatComposer } from '@/features/travel/travel-chat-composer';
import { TravelChatMessageMenu } from '@/features/travel/travel-chat-message-menu';
import { TravelChatMessageRow } from '@/features/travel/travel-chat-message-row';
import { TravelSheetHeader } from '@/features/travel/travel-sheet';
import { useTravelChatActions } from '@/features/travel/use-travel-chat-actions';
import { useTravelChatSession } from '@/features/travel/use-travel-chat-session';
import { useDockedKeyboardInset } from '@/hooks/use-docked-keyboard-inset';
import { useResponsive } from '@/hooks/use-responsive';
import { useTheme } from '@/hooks/use-theme';
import { usePreferences } from '@/store/preferences';
import { useTravel } from '@/store/travel';
import { useUI } from '@/store/ui';
import { AgentUiIds } from '@/utils/agent-ui';
import { goBackOrReplace } from '@/utils/navigation';

function TravelChatItemSeparator() {
  return <View style={styles.itemSeparator} />;
}

export function TravelChatScreen({ planId }: { planId: string }) {
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const { layout: responsiveLayout, spacing: rs, s } = useResponsive();
  const atmosphereTop = screenAtmosphereTopColor(theme.name);
  const atmosphereOverlay = useMemo(() => <ScreenAtmosphere />, []);
  useSafeAreaChrome(atmosphereTop, { priority: 1 });
  useSafeAreaChromeOverlay(atmosphereOverlay, windowHeight, { priority: 1 });
  usePageSurfaceBackground(screenAtmosphereBottomColor(theme.name), {
    priority: 1,
  });
  const measuredTabBarHeight = useUI((state) => state.tabBarHeight);
  const navTabBarHeight = useBottomTabBarHeight();
  const tabBarBottomPad = bottomNavBottomPad(insets.bottom, spacing.sm);
  const tabBarHeight = Math.max(
    measuredTabBarHeight,
    navTabBarHeight,
    responsiveLayout.bottomNavBarBaseHeight + tabBarBottomPad,
  );
  const { keyboardInset, keyboardOpen } = useDockedKeyboardInset({
    androidMode: 'resize',
  });
  const [composerDockHeight, setComposerDockHeight] = useState(0);
  const palette = travelChatPalette(theme);
  const listRef =
    useRef<ComponentRef<typeof FlashList<TravelChatListItem>>>(null);
  const plan = useTravel((state) => state.plans.find((item) => item.id === planId));
  const savePlan = useTravel((state) => state.savePlan);
  const { user } = useAuthSession();
  const senderName = usePreferences((state) => state.name).trim() || 'Trip member';

  const closeChat = () => {
    const fallback: Href = planId
      ? { pathname: '/travel/[id]', params: { id: planId } }
      : ('/(tabs)/travel' as Href);
    goBackOrReplace(router, fallback);
  };

  const session = useTravelChatSession({
    planId,
    plan,
    userId: user?.id,
    senderName,
    savePlan,
  });

  const actions = useTravelChatActions({
    accessCode: session.accessCode,
    deviceId: session.deviceId,
    userId: user?.id,
    senderName,
    messages: session.messages,
    setMessages: session.setMessages,
    refresh: session.refresh,
    channelRef: session.channelRef,
    setError: session.setError,
    notificationsAvailable: session.notificationsAvailable,
    notificationsEnabled: session.notificationsEnabled,
    setNotificationsEnabled: session.setNotificationsEnabled,
    setNotificationsAvailable: session.setNotificationsAvailable,
  });

  const listItems = buildTravelChatListItems(session.messages);
  // Float the composer just above the tab dock — tight air, not flush.
  const composerDockGap = rs.xs;
  const composerInnerPad = rs.xs;
  const composerLift = keyboardOpen
    ? keyboardInset
    : tabBarHeight + composerDockGap;
  const estimatedComposerChrome = Math.max(44, s(48)) + rs.xs;
  const estimatedDockHeight = estimatedComposerChrome + composerInnerPad;
  const dockHeight =
    composerDockHeight > 0 ? composerDockHeight : estimatedDockHeight;
  // Keep last bubbles / empty state clear of the floating composer + tab dock.
  const listBottomPad = dockHeight + composerLift + rs.lg;

  const scrollToLatest = useCallback((animated = false) => {
    if (listItems.length === 0) return;
    requestAnimationFrame(() => {
      listRef.current?.scrollToEnd({ animated });
    });
  }, [listItems.length]);

  useEffect(() => {
    if (session.loading || listItems.length === 0) return;
    scrollToLatest(false);
  }, [session.loading, listBottomPad, listItems.length, scrollToLatest]);

  if (!plan) {
    return (
      <TravelChatAccessGate variant="missing-plan" onClose={closeChat} />
    );
  }

  if (!session.accessCode) {
    return (
      <TravelChatAccessGate
        variant="missing-access"
        plan={plan}
        members={session.members}
        memberSubtitle={session.memberSubtitle}
        rosterReady={session.rosterReady}
        userId={user?.id}
        roster={session.roster}
        palette={palette}
        onClose={closeChat}
      />
    );
  }

  const headerSubtitle = session.peerTypingName
    ? `${session.peerTypingName} is typing…`
    : session.memberSubtitle;

  return (
    <View style={styles.fill}>
      <TravelChatLandscape color={palette.mountainColor} />
      <TravelChatDestinationStamp
        title={plan.title}
        destination={plan.destination}
        color={palette.stamp}
      />

      <View style={{ paddingHorizontal: responsiveLayout.screenPadding, zIndex: 1 }}>
        <TravelSheetHeader
          presentation="page"
          eyebrow="Group Chat"
          title={plan.title}
          subtitle={headerSubtitle}
          closeAccessibilityLabel="Close Group Chat"
          closeTestID={AgentUiIds.travel.chat.close}
          paddingTop={rs.sm}
          onClose={closeChat}
        />
        <View
          style={[
            styles.headerMetaRow,
            { marginTop: -rs.md, marginBottom: rs.md, gap: rs.sm },
          ]}>
          <View style={styles.headerMetaLeading}>
            <TravelChatMemberStack members={session.members} />
          </View>
          <IconButton
            icon="settings"
            size={Math.max(40, s(40))}
            accessibilityLabel="Chat settings"
            testID={AgentUiIds.travel.chat.menu}
            onPress={() => actions.setSettingsOpen(true)}
          />
        </View>
      </View>

      <TravelChatAlertsSettings
        visible={actions.settingsOpen}
        canEnableAlerts={actions.canEnableAlerts}
        enablingNotifications={actions.enablingNotifications}
        notificationsEnabled={session.notificationsEnabled}
        notificationsAvailable={session.notificationsAvailable}
        onClose={() => actions.setSettingsOpen(false)}
        onEnableNotifications={() => void actions.enableNotifications()}
      />

      <TravelChatAlertsBanner
        visible={
          session.notificationsAvailable &&
          !session.notificationsEnabled &&
          session.alertsBannerDismissed === false
        }
        deviceReady={Boolean(session.deviceId)}
        enablingNotifications={actions.enablingNotifications}
        onEnableNotifications={() => void actions.enableNotifications()}
        onDismiss={() => {
          session.setAlertsBannerDismissed(true);
          void dismissTravelChatAlertsBanner();
        }}
      />

      {session.error ? (
        <View style={[styles.error, { zIndex: 1 }]}>
          <ErrorMessage message={session.error} selectable />
        </View>
      ) : null}

      {session.loading ? (
        <View style={[styles.center, { zIndex: 1 }]}>
          <LoadingBlock label="Loading messages…" />
        </View>
      ) : (
        <FlashList<TravelChatListItem>
          ref={listRef}
          data={listItems}
          keyExtractor={(item) => item.id}
          getItemType={(item) => item.type}
          contentInsetAdjustmentBehavior="never"
          contentContainerStyle={[
            styles.messages,
            listItems.length === 0 ? styles.emptyMessages : null,
            { paddingBottom: listBottomPad },
          ]}
          style={styles.list}
          keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
          keyboardShouldPersistTaps="handled"
          ItemSeparatorComponent={TravelChatItemSeparator}
          maintainVisibleContentPosition={{
            startRenderingFromBottom: true,
            autoscrollToBottomThreshold: 0.2,
            animateAutoScrollToBottom: true,
          }}
          onLoad={() => {
            scrollToLatest(false);
          }}
          ListEmptyComponent={
            <EmptyState
              icon="chat"
              title="Start the Conversation"
              message="Share ideas, arrival plans, reservations, and anything the group should know."
            />
          }
          renderItem={({ item }) => {
            if (item.type === 'date') {
              return <TravelChatDateSeparator label={item.label} />;
            }
            return (
              <TravelChatMessageRow
                message={item.message as OptimisticTravelChatMessage}
                identity={{ userId: user?.id, deviceId: session.deviceId }}
                palette={palette}
                onLongPress={actions.openMessageActions}
                onToggleReaction={actions.toggleReaction}
              />
            );
          }}
        />
      )}

      <View
        onLayout={(event) => {
          const next = Math.round(event.nativeEvent.layout.height);
          if (next > 0 && next !== composerDockHeight) {
            setComposerDockHeight(next);
          }
        }}
        style={[
          styles.composerArea,
          {
            bottom: composerLift,
            zIndex: 2,
          },
        ]}>
        <TravelChatComposer
          draft={actions.draft}
          onChangeDraft={actions.setDraft}
          onSendText={() => void actions.sendText()}
          sending={actions.sending}
          deviceReady={Boolean(session.deviceId)}
          bottomInset={composerInnerPad}
          replyTo={actions.replyTo}
          onCancelReply={() => actions.setReplyTo(undefined)}
          editingId={actions.editingId}
          onCancelEdit={() => {
            actions.setEditingId(undefined);
            actions.setDraft('');
          }}
          onTyping={actions.emitTyping}
        />
      </View>

      <TravelChatMessageMenu
        message={actions.menuMessage}
        anchor={actions.menuAnchor}
        identity={{ userId: user?.id, deviceId: session.deviceId }}
        bottomChrome={
          keyboardInset > 0 ? keyboardInset : tabBarHeight + composerDockGap
        }
        onClose={actions.closeMessageMenu}
        onAction={actions.handleMessageMenuAction}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    paddingHorizontal: layout.screenPadding,
  },
  headerMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerMetaLeading: {
    flex: 1,
    minWidth: 0,
    flexShrink: 1,
  },
  error: { paddingHorizontal: layout.screenPadding, paddingTop: spacing.sm },
  list: { flex: 1, zIndex: 1 },
  messages: { padding: layout.screenPadding },
  emptyMessages: { flexGrow: 1, justifyContent: 'center' },
  itemSeparator: { height: spacing.md },
  composerArea: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
  },
});
