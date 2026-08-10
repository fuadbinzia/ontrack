import { StyleSheet, View } from 'react-native';

import {
  AppText,
  GlassPlate,
  IconButton,
  Input,
} from '@/components/primitives';
import { radii } from '@/design-system';
import {
  travelChatMessagePreview,
  type TravelChatMessage,
} from '@/features/travel/chat';
import { travelChatPlateBorder } from '@/features/travel/travel-chat-chrome';
import { useResponsive } from '@/hooks/use-responsive';
import { useTheme } from '@/hooks/use-theme';
import { AgentUiIds } from '@/utils/agent-ui';

export function TravelChatComposer({
  draft,
  onChangeDraft,
  onSendText,
  sending,
  deviceReady,
  bottomInset = 0,
  replyTo,
  onCancelReply,
  editingId,
  onCancelEdit,
  onTyping,
}: {
  draft: string;
  onChangeDraft: (value: string) => void;
  onSendText: () => void;
  sending: boolean;
  deviceReady: boolean;
  /** Tab-bar / IME clearance painted inside the glass dock (flush to nav). */
  bottomInset?: number;
  replyTo?: TravelChatMessage;
  onCancelReply: () => void;
  editingId?: string;
  onCancelEdit: () => void;
  onTyping: () => void;
}) {
  const theme = useTheme();
  const { layout: responsiveLayout, spacing: rs, s } = useResponsive();
  // Nested inside the field pill — keep ≤ trailing pad so it doesn’t clip.
  const sendSize = Math.max(32, s(34));
  const plateBorder = travelChatPlateBorder(theme);

  return (
    <GlassPlate
      airy
      intensity={56}
      style={[
        styles.composerDock,
        {
          minHeight: Math.max(56, s(58)),
          paddingHorizontal: responsiveLayout.screenPadding,
          paddingTop: rs.xs,
          paddingBottom: bottomInset,
          gap: rs.xs,
          borderTopLeftRadius: radii.xl,
          borderTopRightRadius: radii.xl,
          borderColor: plateBorder,
        },
      ]}>
      {replyTo || editingId ? (
        <View
          style={[
            styles.quoteBar,
            { gap: rs.sm, paddingBottom: rs.xs, zIndex: 1 },
          ]}>
          <View style={[styles.quoteCopy, { minWidth: 0, flex: 1 }]}>
            <AppText variant="caption" color="accent" fit>
              {editingId
                ? 'Editing message'
                : `Replying to ${replyTo?.senderName ?? ''}`}
            </AppText>
            {!editingId && replyTo ? (
              <AppText variant="caption" color="secondary" numberOfLines={1}>
                {travelChatMessagePreview(replyTo)}
              </AppText>
            ) : null}
          </View>
          <IconButton
            icon="close"
            size={Math.max(32, s(32))}
            accessibilityLabel={editingId ? 'Cancel edit' : 'Cancel reply'}
            testID={AgentUiIds.travel.chat.replyCancel}
            onPress={editingId ? onCancelEdit : onCancelReply}
          />
        </View>
      ) : null}

      <View style={[styles.composerDockInner, { zIndex: 1 }]}>
        <Input
          testID={AgentUiIds.travel.chat.composer}
          value={draft}
          onChangeText={(value) => {
            onChangeDraft(value);
            onTyping();
          }}
          placeholder={editingId ? 'Edit message…' : 'Message the trip…'}
          multiline
          maxLength={2000}
          accessibilityLabel="Trip Message"
          containerStyle={styles.composerInput}
          style={[styles.input, { paddingVertical: rs.sm }]}
          trailing={
            <IconButton
              icon="arrow-up"
              accessibilityLabel={editingId ? 'Save edit' : 'Send message'}
              testID={AgentUiIds.travel.chat.send}
              loading={sending}
              disabled={!draft.trim() || !deviceReady}
              color={theme.textOnAccent}
              background={theme.accentPrimary}
              appearance="solid"
              size={sendSize}
              onPress={onSendText}
            />
          }
        />
      </View>
    </GlassPlate>
  );
}

const styles = StyleSheet.create({
  composerDock: {
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    borderBottomWidth: 0,
    borderCurve: 'continuous',
  },
  composerDockInner: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  composerInput: {
    flex: 1,
    minWidth: 0,
  },
  input: {
    flex: 1,
    minWidth: 0,
    minHeight: 40,
    maxHeight: 112,
  },
  quoteBar: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  quoteCopy: {
    gap: 2,
  },
});
