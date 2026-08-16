import { StyleSheet, TextInput, View } from 'react-native';

import {
  AppText,
  GlassPlate,
  IconButton,
  Symbol,
} from '@/components/primitives';
import {
  fontFamilies,
  glassMaterials,
  radii,
  spacing,
  typography,
} from '@/design-system';
import { useResponsive } from '@/hooks/use-responsive';
import { useTheme } from '@/hooks/use-theme';
import { AgentTestId, AgentUiIds, useAgentUiTarget } from '@/utils/agent-ui';
import { formatCount } from '@/utils/grammar';

export function TodoListsOverviewHeader({
  listCount,
  totalOpen,
  editMode,
  draft,
  onDraftChange,
  onSubmitDraft,
  onToggleEditMode,
}: {
  listCount: number;
  totalOpen: number;
  editMode: boolean;
  draft: string;
  onDraftChange: (value: string) => void;
  onSubmitDraft: () => void;
  onToggleEditMode: () => void;
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
          <AppText
            variant="title"
            style={[
              styles.title,
              { fontSize: s(35), lineHeight: s(42) },
            ]}>
            Checklists
          </AppText>
          <AppText variant="body" color="secondary">
            {totalOpen
              ? `${formatCount(totalOpen, 'open item')} across ${formatCount(listCount, 'list')}.`
              : 'Everything is handled. Make a list for what comes next.'}
          </AppText>
        </View>
        {listCount > 0 ? (
          <View style={styles.headingActions}>
            <IconButton
              testID={AgentUiIds.checklists.editMode}
              accessibilityLabel={
                editMode
                  ? 'Finish editing checklists'
                  : 'Edit checklists'
              }
              icon={editMode ? 'check' : 'edit'}
              iconSize={16}
              size={36}
              appearance={editMode ? 'solid' : 'glass'}
              color={editMode ? theme.textOnAccent : theme.accentPrimary}
              background={editMode ? theme.accentPrimary : undefined}
              onPress={onToggleEditMode}
            />
          </View>
        ) : null}
      </View>

      {!editMode ? (
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
          <View style={styles.inputRow}>
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
                  placeholder="New list"
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
          </View>
        </GlassPlate>
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
  headingCopy: { flex: 1, gap: spacing.xs, minWidth: 0 },
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
  composer: {
    gap: spacing.sm,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
    paddingLeft: spacing.sm,
    paddingRight: spacing.sm,
    borderRadius: radii.lg,
    borderCurve: 'continuous',
    zIndex: 1,
  },
  inputRow: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingLeft: spacing.md,
  },
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
