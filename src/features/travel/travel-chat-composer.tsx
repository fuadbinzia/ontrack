import { StyleSheet, View } from 'react-native';

import {
  AppText,
  IconButton,
  Input,
} from '@/components/primitives';
import {
  travelChatMessagePreview,
  type TravelChatMessage,
} from '@/features/travel/chat';
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
  /** Clearance below the input (dock is lifted above the tab bar). */
  bottomInset?: number;
  replyTo?: TravelChatMessage;
  onCancelReply: () => void;
  editingId?: string;
  onCancelEdit: () => void;
  onTyping: () => void;
}) {
  const theme = useTheme();
  const { spacing: rs, s } = useResponsive();
  // Nested inside the field pill — keep ≤ trailing pad so it doesn’t clip.
  const sendSize = Math.max(30, s(32));

  return (
    <View
      style={[
        styles.composer,
        {
          paddingHorizontal: rs.sm,
          paddingTop: 0,
          paddingBottom: bottomInset,
          gap: rs.xs,
        },
      ]}>
      {replyTo || editingId ? (
        <View
          style={[
            styles.quoteBar,
            { gap: rs.sm, paddingBottom: rs.xs },
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

      <View style={styles.composerInner}>
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
    </View>
  );
}

const styles = StyleSheet.create({
  composer: {
    width: '100%',
  },
  composerInner: {
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
