import { StyleSheet, TextInput, View } from 'react-native';

import {
  AppText,
  Button,
  GlassPlate,
  IconButton,
  SegmentedControl,
  Symbol,
} from '@/components/primitives';
import { fontFamilies, glassMaterials, radii, spacing, typography } from '@/design-system';
import { useResponsive } from '@/hooks/use-responsive';
import { useTheme } from '@/hooks/use-theme';
import type { TodoListKind } from '@/store/todos';
import { AgentTestId, AgentUiIds, useAgentUiTarget } from '@/utils/agent-ui';

export function TodoListsOverviewHeader({
  listCount,
  totalOpen,
  editMode,
  inviteCount,
  draft,
  draftKind,
  onDraftChange,
  onDraftKindChange,
  onSubmitDraft,
  onToggleEditMode,
  onOpenCollaborators,
}: {
  listCount: number;
  totalOpen: number;
  editMode: boolean;
  inviteCount: number;
  draft: string;
  draftKind: TodoListKind;
  onDraftChange: (value: string) => void;
  onDraftKindChange: (kind: TodoListKind) => void;
  onSubmitDraft: () => void;
  onToggleEditMode: () => void;
  onOpenCollaborators: () => void;
}) {
  const theme = useTheme();
  const { s } = useResponsive();
  const canCreate = Boolean(draft.trim());
  const newListNameAgent = useAgentUiTarget(AgentUiIds.checklists.newListName, {
    label: 'New list name',
  });

  return (
    <View style={styles.header}>
      <View style={styles.heading}>
        <View style={styles.headingCopy}>
          <AppText variant="overline" color="accent">Your checklists</AppText>
          <AppText
            style={[
              styles.title,
              { fontSize: s(35), lineHeight: s(42) },
            ]}>
            Checklists
          </AppText>
          <AppText variant="body" color="secondary">
            {totalOpen
              ? `${totalOpen} open ${totalOpen === 1 ? 'item' : 'items'} across ${listCount} ${listCount === 1 ? 'list' : 'lists'}.`
              : 'Everything is handled. Make a list for what comes next.'}
          </AppText>
        </View>
        <View style={styles.headingActions}>
          {listCount > 0 ? (
            <Button
              testID={AgentUiIds.checklists.editMode}
              accessibilityLabel={
                editMode
                  ? 'Finish editing checklists'
                  : 'Edit checklists'
              }
              size="sm"
              variant={editMode ? 'primary' : 'secondary'}
              onPress={onToggleEditMode}
              style={[
                styles.editModeButton,
                {
                  borderColor: editMode
                    ? theme.accentPrimary
                    : theme.separator,
                },
              ]}
              textStyle={editMode ? undefined : { color: theme.accentPrimary }}>
              {editMode ? 'Done' : 'Edit'}
            </Button>
          ) : null}
          <IconButton
            testID={AgentUiIds.checklists.collaborators}
            accessibilityLabel={
              inviteCount
                ? `Add collaborators, ${inviteCount} invitations waiting`
                : 'Add collaborators'
            }
            icon="invite"
            iconSize={21}
            color={
              inviteCount
                ? theme.accentPrimary
                : theme.textSecondary
            }
            onPress={onOpenCollaborators}
          />
        </View>
      </View>

      {!editMode ? (
        <View style={styles.newListBlock}>
          <SegmentedControl
            value={draftKind}
            options={[
              {
                value: 'checklist',
                label: 'Checklist',
                icon: 'tasks',
                testID: AgentUiIds.checklists.newListKind('checklist'),
              },
              {
                value: 'grocery',
                label: 'Grocery',
                icon: 'groceries',
                testID: AgentUiIds.checklists.newListKind('grocery'),
              },
            ]}
            onChange={onDraftKindChange}
          />
          <GlassPlate
            style={[
              styles.composer,
              {
                borderColor: canCreate
                  ? theme.accentPrimary
                  : theme.name === 'dark'
                    ? glassMaterials.border.dark
                    : glassMaterials.border.light,
                borderWidth: canCreate ? 1 : StyleSheet.hairlineWidth,
              },
            ]}>
            <Symbol name="add" size={21} color={theme.accentPrimary} />
            <AgentTestId
              testID={newListNameAgent.testID}
              label="New list name"
              onPress={() => undefined}
              style={styles.inputWrap}>
              <View collapsable={false} style={styles.inputWrap}>
                <TextInput
                  accessibilityLabel="New list name"
                  maxLength={80}
                  onChangeText={onDraftChange}
                  onSubmitEditing={onSubmitDraft}
                  placeholder={
                    draftKind === 'grocery'
                      ? 'New grocery list'
                      : 'New checklist'
                  }
                  placeholderTextColor={theme.textTertiary}
                  returnKeyType="done"
                  underlineColorAndroid="transparent"
                  style={[styles.input, { color: theme.textPrimary }]}
                  value={draft}
                />
              </View>
            </AgentTestId>
            <IconButton
              testID={AgentUiIds.checklists.createList}
              accessibilityLabel="Create list"
              icon="arrow-up"
              iconSize={18}
              appearance={canCreate ? 'solid' : 'glass'}
              color={
                canCreate ? theme.textOnAccent : theme.textSecondary
              }
              background={canCreate ? theme.accentPrimary : undefined}
              disabled={!canCreate}
              onPress={onSubmitDraft}
            />
          </GlassPlate>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  header: { gap: spacing.lg, paddingBottom: spacing.md },
  heading: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  headingCopy: { flex: 1, gap: spacing.xs },
  headingActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  title: {
    fontFamily: fontFamilies.serif,
    fontWeight: '400',
    letterSpacing: -0.7,
  },
  editModeButton: {
    minWidth: 58,
    borderWidth: StyleSheet.hairlineWidth,
  },
  composer: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingLeft: spacing.lg,
    paddingRight: spacing.sm,
    borderRadius: radii.lg,
    borderCurve: 'continuous',
    zIndex: 1,
  },
  newListBlock: { gap: spacing.sm },
  input: {
    ...typography.body,
    flex: 1,
    minHeight: 52,
    paddingVertical: spacing.md,
  },
  inputWrap: {
    flex: 1,
    minWidth: 0,
  },
});
