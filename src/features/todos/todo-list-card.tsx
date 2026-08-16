import { useRef } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { AppText, DragHandle, GlassPlate, Symbol } from '@/components/primitives';
import { glassMaterials, layout, radii } from '@/design-system';
import { ProfileAvatar } from '@/features/account/profile-avatar';
import { todoListCardPresence } from '@/features/todos/todo-list-card-presence';
import { useResponsive } from '@/hooks/use-responsive';
import { useTheme } from '@/hooks/use-theme';
import { canLeaveTodoList, type TodoList } from '@/store/todos';
import { AgentTestId, AgentUiIds, useAgentUiTarget } from '@/utils/agent-ui';

export type TodoListCollaboratorChip = {
  userId?: string;
  displayName: string;
  isSelf?: boolean;
};

export function TodoListCard({
  editMode,
  list,
  nameDraft,
  collaborators,
  open,
  total,
  onPress,
  onDragStart,
  onNameChange,
  onNameSubmit,
  onMoveDown,
  onMoveUp,
  onRemove,
  canMoveDown,
  canMoveUp,
  isActive,
  testID,
}: {
  editMode: boolean;
  list: TodoList;
  nameDraft: string;
  collaborators?: TodoListCollaboratorChip[];
  open: number;
  total: number;
  onPress: () => void;
  onDragStart: () => void;
  onNameChange: (name: string) => void;
  onNameSubmit: (name: string) => void;
  onMoveDown: () => void;
  onMoveUp: () => void;
  onRemove: () => void;
  canMoveDown: boolean;
  canMoveUp: boolean;
  isActive: boolean;
  testID?: string;
}) {
  const theme = useTheme();
  const { spacing, typography, s } = useResponsive();
  const nameInputRef = useRef<TextInput>(null);
  const presence = todoListCardPresence(open, total);
  const collaboratorChip = Math.max(16, Math.round(s(18)));
  const collaboratorRing = 1;
  const openAgent = useAgentUiTarget(editMode ? undefined : testID, {
    label: list.name,
    onPress,
  });
  const collaboratorNames = collaborators?.map((person) => person.displayName);
  const collaboratorLabel = collaboratorNames?.join(', ');
  const leaving = canLeaveTodoList(list);
  const canRename = editMode && list.role === 'owner';
  const dark = theme.name === 'dark';
  const cardContents = (
    <>
      <View style={[styles.cardCopy, { gap: spacing.xs, minWidth: 0, flexShrink: 1 }]}>
        {canRename ? (
          <View style={styles.nameEditor}>
            <AgentTestId
              testID={AgentUiIds.checklists.listName(list.id)}
              label={`Edit ${list.name} name`}
              onPress={() => nameInputRef.current?.focus()}
              style={styles.nameInputAgent}>
              <TextInput
                ref={nameInputRef}
                accessibilityLabel="Checklist name"
                maxLength={80}
                onChangeText={onNameChange}
                onSubmitEditing={() => onNameSubmit(nameDraft)}
                placeholder="Checklist name"
                placeholderTextColor={theme.textTertiary}
                returnKeyType="done"
                selectTextOnFocus
                selectionColor={theme.accentPrimary}
                underlineColorAndroid="transparent"
                style={[
                  styles.nameInput,
                  typography.subheading,
                  { color: theme.textPrimary },
                ]}
                value={nameDraft}
              />
            </AgentTestId>
          </View>
        ) : (
          <>
            <AppText variant="subheading" numberOfLines={1}>
              {list.name}
            </AppText>
            {list.kind === 'grocery' && !editMode ? (
              <AppText variant="caption" color="accent">
                Grocery
              </AppText>
            ) : null}
          </>
        )}
        {!editMode && collaborators?.length ? (
          <View
            accessible
            accessibilityLabel={`Shared with ${collaboratorLabel}`}
            style={styles.collaboratorAvatars}>
            {collaborators.slice(0, 3).map((person, index) => (
              <View
                key={`${person.userId ?? person.displayName}-${index}`}
                style={[
                  index > 0 && styles.collaboratorAvatarOverlap,
                  {
                    borderRadius: collaboratorChip / 2,
                    borderWidth: collaboratorRing,
                    borderColor: dark
                      ? glassMaterials.border.dark
                      : glassMaterials.border.light,
                  },
                ]}>
                <ProfileAvatar
                  displayName={person.displayName}
                  userId={person.userId}
                  isSelf={person.isSelf}
                  size={collaboratorChip - collaboratorRing * 2}
                />
              </View>
            ))}
          </View>
        ) : null}
      </View>
      {!editMode ? (
        <View style={styles.count}>
          <AppText
            variant="heading"
            color={presence.tone}
            style={styles.countValue}>
            {presence.label}
          </AppText>
          <AppText variant="caption" color="tertiary" fit titleCase>
            {presence.sublabel}
          </AppText>
        </View>
      ) : null}
    </>
  );

  return (
    <GlassPlate
      airy={presence.clear}
      style={[
        styles.card,
        {
          paddingLeft: editMode ? spacing.sm : spacing.lg,
          paddingRight: editMode ? spacing.sm : spacing.md,
          borderColor: isActive
            ? theme.accentPrimary
            : dark
              ? glassMaterials.border.dark
              : glassMaterials.border.light,
          borderWidth: isActive ? 1 : StyleSheet.hairlineWidth,
        },
        isActive && styles.activeCard,
      ]}>
      <View style={styles.cardRow}>
        {editMode ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${leaving ? 'Leave' : 'Delete'} ${list.name}`}
            accessibilityHint={`${leaving ? 'Leaves' : 'Deletes'} after confirmation`}
            onPress={onRemove}
            style={({ pressed }) => [
              styles.cardActionButton,
              pressed && styles.pressed,
            ]}>
            <Symbol
              name={leaving ? 'minus-circle' : 'delete'}
              size={18}
              color={theme.danger}
            />
          </Pressable>
        ) : null}
        {editMode ? (
          <View style={[styles.cardMain, { gap: spacing.sm, paddingVertical: spacing.md }]}>
            {cardContents}
          </View>
        ) : (
          <Pressable
            ref={openAgent.ref}
            testID={testID}
            onLayout={openAgent.onLayout}
            accessibilityHint="Tap to open."
            accessibilityRole="button"
            accessibilityLabel={`${list.name}, ${open} open of ${total}${
              collaboratorLabel ? `, shared with ${collaboratorLabel}` : ''
            }`}
            onPress={onPress}
            style={({ pressed }) => [
              styles.cardMain,
              { gap: spacing.md, paddingVertical: spacing.lg },
              { opacity: pressed && !isActive ? 0.72 : 1 },
            ]}>
            {cardContents}
          </Pressable>
        )}
        {editMode ? (
          <Pressable
            accessibilityActions={[
              ...(canMoveUp ? [{ name: 'moveUp', label: 'Move Up' }] : []),
              ...(canMoveDown ? [{ name: 'moveDown', label: 'Move Down' }] : []),
            ]}
            accessibilityRole="button"
            accessibilityLabel={`Drag to reorder ${list.name}`}
            accessibilityHint="Long press and drag, or use the move actions"
            delayLongPress={180}
            disabled={isActive}
            onAccessibilityAction={(event) => {
              if (event.nativeEvent.actionName === 'moveUp') onMoveUp();
              if (event.nativeEvent.actionName === 'moveDown') onMoveDown();
            }}
            onLongPress={onDragStart}
            style={({ pressed }) => [
              styles.cardActionButton,
              (pressed || isActive) && styles.pressed,
            ]}>
            <DragHandle
              size={20}
              color={
                theme.name === 'dark'
                  ? theme.textOnAccent
                  : theme.textSecondary
              }
            />
          </Pressable>
        ) : null}
      </View>
    </GlassPlate>
  );
}

const styles = StyleSheet.create({
  card: {
    minHeight: 72,
    justifyContent: 'center',
    borderRadius: radii.lg,
    borderCurve: 'continuous',
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: 0,
  },
  cardMain: {
    minHeight: 56,
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: 0,
    zIndex: 1,
  },
  activeCard: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.16,
    shadowRadius: 16,
    elevation: 8,
  },
  cardCopy: {
    flex: 1,
    justifyContent: 'center',
  },
  nameEditor: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  nameInput: {
    flex: 1,
    minWidth: 0,
    paddingVertical: 0,
    textAlignVertical: 'center',
    includeFontPadding: false,
  },
  nameInputAgent: {
    flex: 1,
    minWidth: 0,
    justifyContent: 'center',
  },
  collaboratorAvatars: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 0,
  },
  collaboratorAvatarOverlap: { marginLeft: -4 },
  count: { alignItems: 'center', minWidth: 48, flexShrink: 0 },
  countValue: { fontVariant: ['tabular-nums'] },
  cardActionButton: {
    width: layout.minTapTarget,
    height: layout.minTapTarget,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.pill,
  },
  pressed: { opacity: 0.62 },
});
