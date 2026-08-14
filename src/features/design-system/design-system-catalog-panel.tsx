import { Pressable, View } from 'react-native';

import {
  AppText,
  CollapsibleSection,
  GlassPlate,
} from '@/components/primitives';
import { useResponsive } from '@/hooks/use-responsive';
import { AgentUiIds, useAgentUiTarget } from '@/utils/agent-ui';
import { haptics } from '@/utils/haptics';
import { formatCount } from '@/utils/grammar';

import {
  catalogByGroup,
  DESIGN_CATALOG,
  DESIGN_CATALOG_GROUP_LABELS,
  DESIGN_CATALOG_GROUPS,
  DESIGN_FEATURE_LABELS,
  type DesignCatalogElement,
} from './design-system-catalog';

function usageLabel(element: DesignCatalogElement): string {
  if (element.usedBy.length === 0) return 'Gallery only';
  if (element.usedBy.length <= 3) {
    return element.usedBy.map((id) => DESIGN_FEATURE_LABELS[id]).join(', ');
  }
  const head = element.usedBy
    .slice(0, 2)
    .map((id) => DESIGN_FEATURE_LABELS[id])
    .join(', ');
  return `${head} +${element.usedBy.length - 2} more`;
}

export function DesignSystemCatalogPanel({
  onOpenDemo,
}: {
  onOpenDemo: (demo: DesignCatalogElement['demo']) => void;
}) {
  const { spacing } = useResponsive();
  const byGroup = catalogByGroup();

  return (
    <View style={{ gap: spacing.lg }}>
      <AppText variant="callout" color="secondary">
        Every shared building block in onTrack, grouped by job. Tap a row to open its live demo.
      </AppText>
      <AppText variant="caption" color="tertiary" fit>
        {formatCount(DESIGN_CATALOG.length, 'element')}
      </AppText>

      {DESIGN_CATALOG_GROUPS.map((group, index) => {
        const items = byGroup[group];
        return (
          <CollapsibleSection
            key={group}
            title={`${DESIGN_CATALOG_GROUP_LABELS[group]} · ${items.length}`}
            defaultExpanded={index === 0}
            testID={AgentUiIds.designSystem.catalogGroup(group.toLowerCase())}>
            <View style={{ gap: spacing.sm }}>
              {items.map((el) => (
                <ElementRow key={el.id} element={el} onOpenDemo={onOpenDemo} />
              ))}
            </View>
          </CollapsibleSection>
        );
      })}
    </View>
  );
}

function ElementRow({
  element,
  onOpenDemo,
}: {
  element: DesignCatalogElement;
  onOpenDemo: (demo: DesignCatalogElement['demo']) => void;
}) {
  const { spacing, s, layout } = useResponsive();
  const label = `${element.name}. Open demo`;
  const handlePress = () => {
    haptics.select();
    onOpenDemo(element.demo);
  };
  const testID = AgentUiIds.designSystem.catalogElement(element.id);
  const agent = useAgentUiTarget(testID, { label, onPress: handlePress });

  return (
    <Pressable
      ref={agent.ref}
      accessibilityRole="button"
      accessibilityLabel={label}
      testID={testID}
      onLayout={agent.onLayout}
      onPress={handlePress}
      style={{ minHeight: layout.minTapTarget }}>
      <GlassPlate
        airy
        style={{
          borderRadius: s(14),
          paddingHorizontal: spacing.md,
          paddingVertical: spacing.sm,
          gap: spacing.xxs,
        }}>
        <AppText variant="callout" bold fit>
          {element.name}
        </AppText>
        <AppText variant="caption" color="secondary" numberOfLines={2}>
          {element.description}
        </AppText>
        <AppText variant="caption" color="tertiary" numberOfLines={1} fit>
          {usageLabel(element)}
        </AppText>
      </GlassPlate>
    </Pressable>
  );
}
