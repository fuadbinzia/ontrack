import { Pressable, View } from 'react-native';

import {
  AppText,
  Button,
  Card,
  ErrorMessage,
  GlassPlate,
  HeaderBackButton,
  ProgressRing,
  Symbol,
} from '@/components/primitives';
import { shareTodoListText } from '@/features/todos/share';
import { haptics } from '@/utils/haptics';
import type { TodoList, TodoMember, TodoRecipe, TodoTask } from '@/store/todos';
import { AgentUiIds, type AgentUiTarget } from '@/utils/agent-ui';
import { groceryListScreenStyles as styles } from './grocery-list-screen-styles';

export type GroceryListHeaderProps = {
  list: TodoList;
  listId: string;
  tasks: TodoTask[];
  members: TodoMember[];
  recipes: TodoRecipe[];
  completedCount: number;
  progress: number;
  owner: boolean;
  canEdit: boolean;
  view: 'meal' | 'combined';
  setView: (view: 'meal' | 'combined') => void;
  plateBorder: string;
  syncError?: string;
  clearSyncError: () => void;
  theme: { backgroundSunken: string; textSecondary: string };
  s: (n: number) => number;
  router: {
    canGoBack: () => boolean;
    back: () => void;
    replace: (href: never) => void;
    push: (href: never) => void;
  };
  settingsAgent: AgentUiTarget;
  shareAgent: AgentUiTarget;
  mealViewAgent: AgentUiTarget;
  combinedViewAgent: AgentUiTarget;
};

export function GroceryListHeader(props: GroceryListHeaderProps) {
  const {
    list,
    listId,
    tasks,
    members,
    recipes,
    completedCount,
    progress,
    owner,
    canEdit,
    view,
    setView,
    plateBorder,
    syncError,
    clearSyncError,
    theme,
    s,
    router,
    settingsAgent,
    shareAgent,
    mealViewAgent,
    combinedViewAgent,
  } = props;

  return (
          <View style={styles.header}>
            <View style={styles.heading}>
              <View style={styles.headingCopy}>
                <HeaderBackButton
                  compact
                  label="Grocery list"
                  accessibilityLabel="Back to checklists"
                  testID={AgentUiIds.grocery.back}
                  onPress={() => {
                    if (router.canGoBack()) router.back();
                    else router.replace('/(tabs)/to-do' as never);
                  }}
                />
                <AppText
                  style={[
                    styles.title,
                    { fontSize: s(35), lineHeight: s(42) },
                  ]}>
                  {list.name}
                </AppText>
                <AppText variant="body" color="secondary">
                  {tasks.length
                    ? `${completedCount} of ${tasks.length} ingredients and items checked`
                    : 'Add a recipe or capture a one-off item.'}
                </AppText>
              </View>
              <ProgressRing
                progress={progress}
                size={52}
                strokeWidth={4}
                label={`${Math.round(progress * 100)}%`}
                sublabel="done"
                trackColor={theme.backgroundSunken}
              />
            </View>

            <View style={styles.headerActions}>
              {owner ? (
                <Button
                  icon="add"
                  testID={AgentUiIds.grocery.addRecipe}
                  onPress={() =>
                    router.push(`/todos/${listId}/recipe-import` as never)
                  }>
                  Add Recipe
                </Button>
              ) : !canEdit ? (
                <Card variant="sunken" style={styles.memberNotice}>
                  <AppText variant="caption" color="secondary">
                    You can check ingredients assigned to you or Anyone.
                  </AppText>
                </Card>
              ) : null}
              <Pressable
                ref={settingsAgent.ref}
                testID={settingsAgent.testID}
                onLayout={settingsAgent.onLayout}
                accessibilityLabel="Grocery list settings"
                accessibilityRole="button"
                onPress={() => router.push(`/todos/${listId}/settings` as never)}
                style={({ pressed }) => [
                  styles.iconButtonWrap,
                  { opacity: pressed ? 0.72 : 1 },
                ]}>
                <GlassPlate airy style={styles.iconButton}>
                  <View style={styles.iconGlyph}>
                    <Symbol
                      name="settings"
                      size={20}
                      color={theme.textSecondary}
                    />
                  </View>
                </GlassPlate>
              </Pressable>
              <Pressable
                ref={shareAgent.ref}
                testID={shareAgent.testID}
                onLayout={shareAgent.onLayout}
                accessibilityLabel="Share grocery list"
                accessibilityRole="button"
                onPress={() =>
                  void shareTodoListText(list, tasks, members, recipes)
                }
                style={({ pressed }) => [
                  styles.iconButtonWrap,
                  { opacity: pressed ? 0.72 : 1 },
                ]}>
                <GlassPlate airy style={styles.iconButton}>
                  <View style={styles.iconGlyph}>
                    <Symbol name="share" size={20} color={theme.textSecondary} />
                  </View>
                </GlassPlate>
              </Pressable>
            </View>

            {syncError ? (
              <Pressable onPress={clearSyncError}>
                <ErrorMessage message={syncError} />
              </Pressable>
            ) : null}

            <GlassPlate
              airy
              accessibilityRole="tablist"
              style={styles.segmented}>
              {([
                ['meal', 'By meal', mealViewAgent] as const,
                ['combined', 'Combined', combinedViewAgent] as const,
              ]).map(([id, label, agent]) => {
                const selected = view === id;
                return (
                  <Pressable
                    key={id}
                    ref={agent.ref}
                    testID={agent.testID}
                    onLayout={agent.onLayout}
                    accessibilityRole="tab"
                    accessibilityState={{ selected }}
                    onPress={() => {
                      setView(id);
                      haptics.select();
                    }}
                    style={styles.segmentPressable}>
                    {selected ? (
                      <GlassPlate
                        style={[
                          styles.segmentSelected,
                          { borderColor: plateBorder },
                        ]}
                      />
                    ) : null}
                    <AppText
                      variant="callout"
                      color={selected ? 'accent' : 'secondary'}
                      style={styles.segmentLabel}>
                      {label}
                    </AppText>
                  </Pressable>
                );
              })}
            </GlassPlate>
          </View>
  );
}
