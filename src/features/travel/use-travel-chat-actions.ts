import type { RealtimeChannel } from '@supabase/supabase-js';
import * as Clipboard from 'expo-clipboard';
import type { Dispatch, RefObject, SetStateAction } from 'react';
import { useCallback, useRef, useState } from 'react';

import type { DropdownAnchor } from '@/components/primitives/dropdown-layout';
import {
  deleteTravelChatMessage,
  editTravelChatMessage,
  enableTravelChatNotifications,
  markTravelChatRead,
  sendTravelChatMessage,
  sendTravelChatTyping,
  setTravelChatReaction,
  toggleTravelChatReactionLocal,
  travelChatMessagePreview,
  type OptimisticTravelChatMessage,
  type TravelChatMessage,
} from '@/features/travel/chat';
import type { TravelChatMessageMenuAction } from '@/features/travel/travel-chat-message-menu';
import { newId } from '@/utils/id';

export function useTravelChatActions(input: {
  accessCode: string | undefined;
  deviceId: string;
  userId?: string;
  senderName: string;
  messages: OptimisticTravelChatMessage[];
  setMessages: Dispatch<SetStateAction<OptimisticTravelChatMessage[]>>;
  refresh: () => Promise<void>;
  channelRef: RefObject<RealtimeChannel | undefined>;
  setError: (value: string | undefined) => void;
  notificationsAvailable: boolean;
  notificationsEnabled: boolean;
  setNotificationsEnabled: (value: boolean) => void;
  setNotificationsAvailable: (value: boolean) => void;
}) {
  const {
    accessCode,
    deviceId,
    userId,
    senderName,
    setMessages,
    refresh,
    channelRef,
    setError,
    notificationsAvailable,
    notificationsEnabled,
    setNotificationsEnabled,
    setNotificationsAvailable,
  } = input;

  const [draft, setDraft] = useState('');
  const [replyTo, setReplyTo] = useState<TravelChatMessage>();
  const [editingId, setEditingId] = useState<string>();
  const [sending, setSending] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [enablingNotifications, setEnablingNotifications] = useState(false);
  const [menuMessage, setMenuMessage] =
    useState<OptimisticTravelChatMessage | null>(null);
  const [menuAnchor, setMenuAnchor] = useState<DropdownAnchor | null>(null);
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const emitTyping = useCallback(() => {
    if (!userId) return;
    if (typingTimerRef.current) return;
    sendTravelChatTyping(channelRef.current, {
      userId,
      name: senderName,
    });
    typingTimerRef.current = setTimeout(() => {
      typingTimerRef.current = null;
    }, 2000);
  }, [channelRef, senderName, userId]);

  const sendText = async () => {
    if (!accessCode || !deviceId || !draft.trim() || sending) return;
    const body = draft.trim();
    if (editingId) {
      setSending(true);
      setError(undefined);
      try {
        const updated = await editTravelChatMessage({
          accessCode,
          messageId: editingId,
          body,
        });
        setMessages((current) =>
          current.map((item) => (item.id === updated.id ? { ...item, ...updated } : item)),
        );
        setEditingId(undefined);
        setDraft('');
      } catch (reason) {
        setError(
          reason instanceof Error ? reason.message : 'This message could not be edited.',
        );
      } finally {
        setSending(false);
      }
      return;
    }

    const optimisticId = newId('chat-pending');
    const optimisticMessage: OptimisticTravelChatMessage = {
      id: optimisticId,
      senderName,
      senderDeviceId: deviceId,
      senderUserId: userId,
      body,
      createdAt: new Date().toISOString(),
      kind: 'text',
      replyToId: replyTo?.id,
      replyPreview: replyTo
        ? travelChatMessagePreview(replyTo, { maxChars: 120 })
        : undefined,
      replySenderName: replyTo?.senderName,
      reactions: [],
      pending: true,
    };
    setMessages((current) => [...current, optimisticMessage]);
    setDraft('');
    const replySnapshot = replyTo;
    setReplyTo(undefined);
    setSending(true);
    setError(undefined);
    try {
      const message = await sendTravelChatMessage({
        accessCode,
        senderName,
        senderDeviceId: deviceId,
        body,
        replyToId: replySnapshot?.id,
      });
      setMessages((current) => {
        const withoutOptimistic = current.filter((item) => item.id !== optimisticId);
        return withoutOptimistic.some((item) => item.id === message.id)
          ? withoutOptimistic
          : [...withoutOptimistic, message];
      });
      void markTravelChatRead(accessCode, message.createdAt).catch(() => undefined);
    } catch (reason) {
      setMessages((current) => current.filter((item) => item.id !== optimisticId));
      setDraft((current) => current || body);
      if (replySnapshot) setReplyTo(replySnapshot);
      const detail =
        reason instanceof Error ? reason.message : 'Your message could not be sent.';
      setError(`Message not sent. Your draft was restored. ${detail}`);
    } finally {
      setSending(false);
    }
  };

  const closeMessageMenu = () => {
    setMenuMessage(null);
    setMenuAnchor(null);
  };

  const openMessageActions = useCallback(
    (message: OptimisticTravelChatMessage, anchor: DropdownAnchor) => {
      setMenuMessage(message);
      setMenuAnchor(anchor);
    },
    [],
  );

  const toggleReaction = (
    message: OptimisticTravelChatMessage,
    emoji: string,
  ) => {
    if (!accessCode) return;
    setMessages((current) =>
      current.map((item) =>
        item.id === message.id
          ? {
              ...item,
              reactions: toggleTravelChatReactionLocal(item.reactions, emoji),
            }
          : item,
      ),
    );
    void setTravelChatReaction({
      accessCode,
      messageId: message.id,
      emoji,
    })
      .then(() => refresh())
      .catch((reason: unknown) => {
        setError(
          reason instanceof Error
            ? reason.message
            : 'This reaction could not be saved.',
        );
        void refresh();
      });
  };

  const handleMessageMenuAction = (action: TravelChatMessageMenuAction) => {
    const message = menuMessage;
    closeMessageMenu();
    if (!message) return;

    if (typeof action === 'object' && 'react' in action) {
      toggleReaction(message, action.react);
      return;
    }
    if (action === 'reply') {
      setEditingId(undefined);
      setReplyTo(message);
      return;
    }
    if (action === 'copy') {
      const text = travelChatMessagePreview(message, { emptyFallback: '' });
      if (text) void Clipboard.setStringAsync(text);
      return;
    }
    if (action === 'edit') {
      setReplyTo(undefined);
      setEditingId(message.id);
      setDraft(message.body);
      return;
    }
    if (action === 'delete' && accessCode) {
      void (async () => {
        try {
          const updated = await deleteTravelChatMessage({
            accessCode,
            messageId: message.id,
          });
          setMessages((current) =>
            current.map((item) =>
              item.id === updated.id ? { ...item, ...updated, body: '' } : item,
            ),
          );
        } catch (reason) {
          setError(
            reason instanceof Error
              ? reason.message
              : 'This message could not be deleted.',
          );
        }
      })();
    }
  };

  const enableNotifications = async () => {
    if (!accessCode || !deviceId || enablingNotifications) return;
    setEnablingNotifications(true);
    setError(undefined);
    try {
      await enableTravelChatNotifications(accessCode, deviceId);
      setNotificationsEnabled(true);
    } catch (reason) {
      if (
        reason instanceof Error &&
        reason.message.startsWith('Push alerts are unavailable')
      ) {
        setNotificationsAvailable(false);
      } else {
        setError(
          reason instanceof Error
            ? reason.message
            : 'Notifications could not be enabled.',
        );
      }
    } finally {
      setEnablingNotifications(false);
    }
  };

  const canEnableAlerts =
    notificationsAvailable && !notificationsEnabled && Boolean(deviceId);

  return {
    draft,
    setDraft,
    replyTo,
    setReplyTo,
    editingId,
    setEditingId,
    sending,
    settingsOpen,
    setSettingsOpen,
    enablingNotifications,
    menuMessage,
    menuAnchor,
    emitTyping,
    sendText,
    closeMessageMenu,
    openMessageActions,
    toggleReaction,
    handleMessageMenuAction,
    enableNotifications,
    canEnableAlerts,
  };
}
