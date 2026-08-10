import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import {
  AppText,
  Card,
  EmptyState,
  IconButton,
  Input,
  SheetScaffold,
} from '@/components/primitives';
import type { Theme } from '@/design-system';
import { ProfileAvatar } from '@/features/account/profile-avatar';
import { noteAuthorColor } from '@/features/travel/travel-item-note-colors';
import {
  TravelRemoveConfirmModal,
  type TravelRemoveConfirmPayload,
} from '@/features/travel/travel-remove-confirm-modal';
import {
  TRAVEL_EXPENSE_SELF_ID,
  type TravelItemNote,
  type TravelItineraryItem,
  type TravelPlan,
} from '@/features/travel/types';
import { useResponsive } from '@/hooks/use-responsive';
import { useTheme } from '@/hooks/use-theme';
import { usePreferences } from '@/store/preferences';
import { AgentUiIds } from '@/utils/agent-ui';
import { newId } from '@/utils/id';

function formatNoteTime(iso: string): string {
  try {
    return new Intl.DateTimeFormat(undefined, {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    }).format(new Date(iso));
  } catch {
    return '';
  }
}

function NoteCard({
  note,
  theme,
  isEditing,
  onEdit,
  onDelete,
}: {
  note: TravelItemNote;
  theme: Theme;
  isEditing: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { spacing, s } = useResponsive();
  const accent = noteAuthorColor(note.authorId, theme);
  const isSelf = note.authorId === TRAVEL_EXPENSE_SELF_ID;
  const displayName =
    isSelf && note.authorName.trim().toLowerCase() !== 'you'
      ? `${note.authorName} (You)`
      : isSelf
        ? 'You'
        : note.authorName;
  const timeLabel = note.updatedAt
    ? `Edited ${formatNoteTime(note.updatedAt)}`
    : formatNoteTime(note.createdAt);

  return (
    <Card airy style={{ gap: spacing.sm }}>
      <View style={[styles.noteHeader, { gap: spacing.sm }]}>
        <ProfileAvatar
          displayName={displayName}
          userId={isSelf ? undefined : note.authorId}
          isSelf={isSelf}
          size={Math.max(28, s(28))}
        />
        <View style={styles.authorCopy}>
          <AppText variant="callout" fit style={{ color: accent }}>
            {displayName}
          </AppText>
          <AppText variant="caption" color="tertiary" fit>
            {timeLabel}
          </AppText>
        </View>
      </View>
      <AppText>{note.body}</AppText>
      {isSelf ? (
        <View style={[styles.noteActions, { gap: spacing.sm }]}>
          <IconButton
            icon={isEditing ? 'close' : 'edit'}
            testID={AgentUiIds.travel.notes.edit(note.id)}
            accessibilityLabel={isEditing ? 'Cancel edit' : 'Edit note'}
            onPress={onEdit}
          />
          <IconButton
            icon="delete"
            testID={AgentUiIds.travel.notes.delete(note.id)}
            color={theme.danger}
            accessibilityLabel="Delete note"
            onPress={onDelete}
          />
        </View>
      ) : null}
    </Card>
  );
}

export function TravelItemNotesSheet({
  item,
  visible,
  onClose,
  onSaveNotes,
}: {
  plan: TravelPlan;
  item: TravelItineraryItem;
  visible: boolean;
  onClose: () => void;
  onSaveNotes: (notes: TravelItemNote[]) => void;
}) {
  const theme = useTheme();
  const { spacing, s } = useResponsive();
  const preferenceName = usePreferences((state) => state.name).trim();
  const [draft, setDraft] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [removeConfirm, setRemoveConfirm] = useState<TravelRemoveConfirmPayload | null>(null);
  const notes = item.notes ?? [];
  const isEditing = editingId != null;
  // Nested inside the field pill — keep ≤ trailing pad so it doesn’t clip.
  const sendSize = Math.max(32, s(34));

  useEffect(() => {
    if (visible) return;
    setDraft('');
    setEditingId(null);
    setRemoveConfirm(null);
  }, [visible]);

  const cancelEdit = () => {
    setEditingId(null);
    setDraft('');
  };
  const beginEdit = (note: TravelItemNote) => {
    setRemoveConfirm(null);
    if (editingId === note.id) {
      cancelEdit();
      return;
    }
    setEditingId(note.id);
    setDraft(note.body);
  };
  const requestDelete = (note: TravelItemNote) => {
    cancelEdit();
    const preview = note.body.length > 80 ? `${note.body.slice(0, 77).trimEnd()}…` : note.body;
    setRemoveConfirm({
      title: 'Delete Note?',
      message: `This action will permanently remove “${preview}”.`,
      actionLabel: 'Delete Note',
      confirmTestID: AgentUiIds.travel.notes.confirmDelete,
      onConfirm: () => onSaveNotes(notes.filter((entry) => entry.id !== note.id)),
    });
  };
  const submit = () => {
    const body = draft.trim();
    if (!body) return;
    if (editingId) {
      onSaveNotes(
        notes.map((note) =>
          note.id === editingId ? { ...note, body, updatedAt: new Date().toISOString() } : note,
        ),
      );
      cancelEdit();
      return;
    }
    onSaveNotes([
      ...notes,
      {
        id: newId('note'),
        body,
        authorId: TRAVEL_EXPENSE_SELF_ID,
        authorName: preferenceName || 'You',
        createdAt: new Date().toISOString(),
      },
    ]);
    setDraft('');
  };

  const footer = (
    <View style={[styles.composer, { gap: spacing.sm }]}>
      {isEditing ? (
        <IconButton
          icon="close"
          testID={AgentUiIds.travel.notes.cancelEdit}
          accessibilityLabel="Cancel edit"
          onPress={cancelEdit}
        />
      ) : null}
      <Input
        value={draft}
        onChangeText={setDraft}
        placeholder={isEditing ? 'Edit note…' : 'Add a note…'}
        multiline
        maxLength={500}
        testID={AgentUiIds.travel.notes.composer}
        accessibilityLabel={isEditing ? 'Edit trip note' : 'Trip note'}
        containerStyle={styles.composerInput}
        style={styles.input}
        trailing={
          <IconButton
            icon={isEditing ? 'check' : 'send'}
            testID={AgentUiIds.travel.notes.submit}
            color={draft.trim() ? theme.accentPrimary : theme.textTertiary}
            disabled={!draft.trim()}
            accessibilityLabel={isEditing ? 'Save note' : 'Post note'}
            size={sendSize}
            onPress={submit}
          />
        }
      />
    </View>
  );

  return (
    <>
      <SheetScaffold
        visible={visible}
        eyebrow="Notes"
        title={item.title}
        subtitle="Share details and keep everyone in the loop"
        closeAccessibilityLabel="Close Notes"
        closeTestID={AgentUiIds.travel.notes.close}
        onClose={onClose}
        footer={footer}
        surface="glass">
        {notes.length === 0 ? (
          <EmptyState
            icon="note"
            title="No notes yet"
            message="Share a quick thought with the group."
          />
        ) : (
          <View style={{ gap: spacing.sm }}>
            {notes.map((note) => (
              <NoteCard
                key={note.id}
                note={note}
                theme={theme}
                isEditing={editingId === note.id}
                onEdit={() => beginEdit(note)}
                onDelete={() => requestDelete(note)}
              />
            ))}
          </View>
        )}
      </SheetScaffold>
      <TravelRemoveConfirmModal
        payload={removeConfirm}
        onCancel={() => setRemoveConfirm(null)}
      />
    </>
  );
}

/** Compact notes action used in itinerary card toolbars. */
export function TravelItemNotesButton({
  hasNotes,
  size,
  iconSize = 'md',
  onPress,
  testID,
  onGlass = false,
}: {
  hasNotes: boolean;
  size: number;
  iconSize?: 'sm' | 'md' | 'lg' | 'xl' | number;
  onPress: () => void;
  testID: string;
  /** Mist / black-glass toolbars — frost well + light glyph. */
  onGlass?: boolean;
}) {
  const theme = useTheme();
  return (
    <View>
      <IconButton
        icon="note"
        size={size}
        iconSize={iconSize}
        testID={testID}
        color={onGlass ? '#FFFFFF' : undefined}
        accessibilityLabel={hasNotes ? 'View notes' : 'Add notes'}
        onPress={onPress}
      />
      {hasNotes ? (
        <View
          style={[
            styles.dot,
            {
              backgroundColor: theme.accentPrimary,
              borderColor: onGlass
                ? 'rgba(255,255,255,0.35)'
                : 'rgba(255,255,255,0.65)',
            },
          ]}
          pointerEvents="none"
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  noteHeader: { flexDirection: 'row', alignItems: 'center' },
  authorCopy: { flex: 1, minWidth: 0, flexShrink: 1 },
  noteActions: { flexDirection: 'row', justifyContent: 'flex-end' },
  composer: { flexDirection: 'row', alignItems: 'center', width: '100%' },
  composerInput: { flex: 1, minWidth: 0 },
  input: { flex: 1, minWidth: 0 },
  dot: {
    position: 'absolute',
    top: 2,
    right: 2,
    width: 8,
    height: 8,
    borderRadius: 4,
    borderWidth: 1.5,
  },
});
