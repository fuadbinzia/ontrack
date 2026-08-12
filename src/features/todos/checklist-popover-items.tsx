import { Pressable, StyleSheet, View } from 'react-native';

import {
  AppText,
  GlassIconWell,
  GlassPlate,
  Symbol,
} from '@/components/primitives';
import { radii, spacing, type AppIconName } from '@/design-system';
import { useTheme } from '@/hooks/use-theme';
import { AgentTestId } from '@/utils/agent-ui';

export interface ChecklistPopoverItem {
  id: string;
  title: string;
  description?: string;
  icon: AppIconName;
  selected?: boolean;
  destructive?: boolean;
  dividerBefore?: boolean;
}

export function ChecklistPopoverItems({
  items,
  density,
  itemTestID,
  onSelect,
}: {
  items: ChecklistPopoverItem[];
  density: 'sheet' | 'compact';
  itemTestID?: (id: string) => string;
  onSelect: (id: string) => void;
}) {
  const theme = useTheme();
  const compact = density === 'compact';

  return (
    <View style={compact ? styles.compactList : styles.sheetList}>
      {items.map((item) => {
        const itemColor = item.destructive
          ? theme.danger
          : item.selected
            ? theme.accentPrimary
            : theme.textPrimary;

        const selectItem = () => onSelect(item.id);

        return (
          <View key={item.id}>
            {item.dividerBefore ? (
              <View
                style={[
                  compact ? styles.compactDivider : styles.sheetDivider,
                  { backgroundColor: theme.separator },
                ]}
              />
            ) : null}
            <AgentTestId
              testID={itemTestID?.(item.id)}
              label={item.title}
              onPress={selectItem}>
              <GlassPlate
                airy
                style={[
                  compact ? styles.compactItemPlate : styles.sheetItemPlate,
                  item.selected ? { borderColor: theme.accentSoft } : undefined,
                ]}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={item.title}
                  accessibilityHint={item.description}
                  accessibilityState={{ selected: item.selected }}
                  onPress={selectItem}
                  style={({ pressed }) => [
                    compact ? styles.compactItem : styles.sheetItem,
                    { opacity: pressed ? 0.7 : 1 },
                  ]}>
                  <GlassIconWell size={compact ? 36 : 40}>
                    <Symbol name={item.icon} size={compact ? 17 : 18} color={itemColor} />
                  </GlassIconWell>
                  <View style={styles.itemCopy}>
                    <AppText
                      fit
                      variant="callout"
                      color={item.destructive ? 'danger' : 'primary'}>
                      {item.title}
                    </AppText>
                    {item.description ? (
                      <AppText
                        variant="caption"
                        color="secondary"
                        numberOfLines={compact ? 1 : 2}>
                        {item.description}
                      </AppText>
                    ) : null}
                  </View>
                  {item.selected ? (
                    <Symbol name="check" size={compact ? 16 : 18} color={theme.accentPrimary} />
                  ) : null}
                </Pressable>
              </GlassPlate>
            </AgentTestId>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  sheetList: {
    gap: spacing.sm,
  },
  compactList: {
    gap: spacing.xxs,
  },
  sheetDivider: {
    height: StyleSheet.hairlineWidth,
    marginHorizontal: spacing.md,
    marginBottom: spacing.lg,
  },
  compactDivider: {
    height: StyleSheet.hairlineWidth,
    marginHorizontal: spacing.md,
    marginVertical: spacing.sm,
  },
  sheetItemPlate: {
    borderRadius: radii.lg,
  },
  compactItemPlate: {
    borderRadius: radii.md,
  },
  sheetItem: {
    minHeight: 68,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  compactItem: {
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
  },
  itemCopy: {
    flex: 1,
    minWidth: 0,
    gap: spacing.xxs,
  },
});
