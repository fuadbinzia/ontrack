import { Pressable, ScrollView, StyleSheet } from 'react-native';

import { AgentTestId, AgentUiIds } from '@/utils/agent-ui';
import { AppText, GlassPlate } from '@/components/primitives';
import { layout, radii, spacing } from '@/design-system';
import { useTheme } from '@/hooks/use-theme';
import type { ChecklistCategory } from '@/store/todos';

export const ALL_CATEGORIES = 'all';

export function ChecklistCategoryTabs({
  categories,
  selectedId,
  onSelect,
}: {
  categories: ChecklistCategory[];
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  const theme = useTheme();
  const tabs = [{ id: ALL_CATEGORIES, name: 'All' }, ...categories];

  return (
    <AgentTestId
      testID={AgentUiIds.checklists.detail.categoryTabs}
      label="Checklist categories"
      style={styles.anchor}
    >
      <ScrollView
        horizontal
        contentContainerStyle={styles.content}
        showsHorizontalScrollIndicator={false}
      >
        {tabs.map((category) => {
          const selected = category.id === selectedId;
          return (
            <AgentTestId
              key={category.id}
              testID={AgentUiIds.checklists.detail.category(category.id)}
              label={`${category.name} category`}
              onPress={() => onSelect(category.id)}
            >
              <Pressable
                accessibilityRole="tab"
                accessibilityLabel={`${category.name} category`}
                accessibilityState={{ selected }}
                onPress={() => onSelect(category.id)}
                style={({ pressed }) => ({ opacity: pressed ? 0.72 : 1 })}
              >
                <GlassPlate
                  airy
                  style={[
                    styles.tab,
                    selected
                      ? {
                          borderColor: theme.accentPrimary,
                          borderWidth: 1,
                        }
                      : undefined,
                  ]}
                >
                  <AppText
                    variant="caption"
                    color={selected ? 'accent' : 'secondary'}
                    fit
                    titleCase
                  >
                    {category.name}
                  </AppText>
                </GlassPlate>
              </Pressable>
            </AgentTestId>
          );
        })}
      </ScrollView>
    </AgentTestId>
  );
}

const styles = StyleSheet.create({
  anchor: { marginHorizontal: -spacing.xs },
  content: { gap: spacing.sm, paddingHorizontal: spacing.xs },
  tab: {
    minHeight: layout.minTapTarget,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    borderRadius: radii.pill,
  },
});
