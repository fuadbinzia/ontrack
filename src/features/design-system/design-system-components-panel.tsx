import { useState, type ReactNode } from 'react';
import { View } from 'react-native';

import {
    ActionChipRow,
    AppText,
    Button,
    Card,
    CollapsibleSection,
    DangerZone,
    DestructiveSection,
    Dropdown,
    EmptyState,
    ErrorMessage,
    GlassIconWell,
    GlassMetaChip,
    GlassPlate,
    GlassPrimaryAction,
    GlassSwitch,
    GlassTonePill,
    IconButton,
    LoadingBlock,
    MetaList,
    PanelTitle,
    ProgressRing,
    SectionHeader,
    SheetGrabber,
    StatusBadge,
    Symbol,
    ToolbarRow,
} from '@/components/primitives';
import {
    ActivityCard,
    CategoryBadge,
    ChipRow,
    MetricDisplay,
} from '@/components/shared';
import { useResponsive } from '@/hooks/use-responsive';
import { FeatureThemeProvider, useTheme } from '@/hooks/use-theme';
import type { Activity, ActivityCategory } from '@/types/models';
import { AgentUiIds } from '@/utils/agent-ui';
import { confirmDestructiveAction } from '@/utils/confirm-destructive';
import { todayKey } from '@/utils/date';

import {
    DESIGN_CATALOG,
    DESIGN_FEATURE_LABELS,
    type DesignCatalogElement,
} from './design-system-catalog';

const DEMO_CATEGORIES: ActivityCategory[] = [
  {
    id: 'food',
    name: 'Food',
    icon: 'food',
    colorKey: 'food',
    supportsPhotos: true,
    supportsTimer: false,
    detailKind: 'food',
  },
  {
    id: 'gym',
    name: 'Gym',
    icon: 'gym',
    colorKey: 'gym',
    supportsPhotos: false,
    supportsTimer: true,
    detailKind: 'gym',
  },
  {
    id: 'work',
    name: 'Work',
    icon: 'work',
    colorKey: 'work',
    supportsPhotos: false,
    supportsTimer: false,
    detailKind: 'work',
  },
];

const DEMO_ACTIVITY: Activity = {
  id: 'ds-activity',
  date: todayKey(),
  title: 'Morning run',
  categoryId: 'gym',
  startMinutes: 7 * 60 + 30,
  durationMinutes: 45,
  status: 'upcoming',
  summary: 'Easy pace',
  createdAt: '2026-08-05T12:00:00.000Z',
  updatedAt: '2026-08-05T12:00:00.000Z',
};

function usedInLabel(id: string): string {
  const el = DESIGN_CATALOG.find((e) => e.id === id);
  if (!el || el.usedBy.length === 0) return 'Gallery ready · not yet adopted in features';
  return `Used in ${el.usedBy.map((f) => DESIGN_FEATURE_LABELS[f]).join(' · ')}`;
}

function DemoCard({
  title,
  catalogId,
  children,
}: {
  title: string;
  catalogId: string;
  children: ReactNode;
}) {
  const { spacing } = useResponsive();
  return (
    <Card airy style={{ gap: spacing.md }}>
      <View style={{ gap: spacing.xxs }}>
        <PanelTitle>{title}</PanelTitle>
        <AppText variant="caption" color="tertiary" numberOfLines={2}>
          {usedInLabel(catalogId)}
        </AppText>
      </View>
      {children}
    </Card>
  );
}

export function DesignSystemComponentsPanel({
  onOpenSheet,
}: {
  onOpenSheet: () => void;
}) {
  const theme = useTheme();
  const { spacing } = useResponsive();
  const [sort, setSort] = useState<'unhealthy' | 'healthy' | 'name'>('unhealthy');
  const [chip, setChip] = useState<'a' | 'b' | 'c'>('a');
  const [collapsedOpen, setCollapsedOpen] = useState(false);
  const [glassSwitchOn, setGlassSwitchOn] = useState(true);

  return (
    <View style={{ gap: spacing.xl }}>
      <SectionHeader title="Screens & layout" flush />
      <DemoCard title="Section header" catalogId="sectionHeader">
        <SectionHeader title="Book & Organize" actionLabel="See all" onAction={onOpenSheet} />
      </DemoCard>
      <DemoCard title="Collapsible section" catalogId="collapsibleSection">
        <CollapsibleSection
          title="Runtime"
          description="Environment details while collapsed"
          expanded={collapsedOpen}
          onExpandedChange={setCollapsedOpen}
          testID={AgentUiIds.designSystem.demo('collapsible')}>
          <MetaList
            items={[
              { label: 'App env', value: 'development' },
              { label: 'Bridge', value: 'Ready' },
            ]}
          />
        </CollapsibleSection>
      </DemoCard>
      <DemoCard title="Glass plate" catalogId="glassPlate">
        <GlassPlate
          style={{
            padding: spacing.md,
            borderRadius: 16,
            gap: spacing.sm,
          }}>
          <AppText variant="callout">Frosted glass plate</AppText>
          <GlassPrimaryAction
            label="Primary glass CTA"
            onPress={() => undefined}
            testID={AgentUiIds.designSystem.demo('glassPrimary')}
          />
        </GlassPlate>
      </DemoCard>
      <DemoCard title="Glass icon well" catalogId="glassIconWell">
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
          <GlassIconWell size={48} borderRadius={14}>
            <Symbol name="flight" size="md" color={theme.accentPrimary} />
          </GlassIconWell>
          <GlassIconWell size={48} borderRadius={14} variant="airy">
            <Symbol name="itinerary" size="md" color={theme.accentPrimary} />
          </GlassIconWell>
        </View>
      </DemoCard>
      <DemoCard title="Glass tone pill" catalogId="glassTonePill">
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
          <GlassTonePill label="On time" toneColor={theme.accentPrimary} />
          <GlassTonePill label="Delayed" toneColor={theme.danger} />
        </View>
      </DemoCard>
      <DemoCard title="Glass meta chip" catalogId="glassMetaChip">
        <GlassMetaChip accessibilityLabel="2h 15m duration">
          <Symbol name="clock" size="sm" color={theme.textPrimary} />
          <AppText variant="caption" fit>
            2h 15m
          </AppText>
        </GlassMetaChip>
      </DemoCard>
      <DemoCard title="Glass switch" catalogId="glassSwitch">
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
          <GlassSwitch value={glassSwitchOn} accessibilityLabel="Demo glass switch" />
          <Button
            size="sm"
            variant="secondary"
            testID={AgentUiIds.designSystem.demo('glassSwitchToggle')}
            accessibilityLabel="Toggle glass switch demo"
            onPress={() => setGlassSwitchOn((on) => !on)}>
            {glassSwitchOn ? 'On' : 'Off'}
          </Button>
        </View>
      </DemoCard>
      <DemoCard title="Sheet scaffold" catalogId="sheetScaffold">
        <Button
          variant="secondary"
          testID={AgentUiIds.designSystem.demo('sheet')}
          accessibilityLabel="Open sheet example"
          onPress={onOpenSheet}>
          Open Sheet
        </Button>
      </DemoCard>
      <DemoCard title="Sheet grabber" catalogId="sheetGrabber">
        <SheetGrabber accessibilityLabel="Example sheet grabber" />
        <AppText variant="caption" color="secondary">
          Bottom sheets dismiss with this pill (tap or swipe) — not a header X.
        </AppText>
      </DemoCard>

      <SectionHeader title="Buttons & actions" flush />
      <DemoCard title="Buttons" catalogId="button">
        <Button
          size="lg"
          testID={AgentUiIds.designSystem.primary}
          accessibilityLabel="Primary action example"
          onPress={onOpenSheet}>
          Primary Action
        </Button>
        <Button
          variant="secondary"
          testID={AgentUiIds.designSystem.secondary}
          accessibilityLabel="Secondary action example"
          onPress={onOpenSheet}>
          Secondary Action
        </Button>
        <Button
          variant="ghost"
          testID={AgentUiIds.designSystem.ghost}
          accessibilityLabel="Ghost action example"
          onPress={onOpenSheet}>
          Inline Action
        </Button>
        <View style={{ flexDirection: 'row', gap: spacing.sm, alignItems: 'center' }}>
          <Button loading onPress={() => undefined}>
            Saving
          </Button>
          <Button disabled onPress={() => undefined}>
            Disabled
          </Button>
        </View>
      </DemoCard>
      <DemoCard title="Icon button" catalogId="iconButton">
        <IconButton
          icon="smart"
          testID={AgentUiIds.designSystem.info}
          accessibilityLabel="Icon button example"
          onPress={onOpenSheet}
        />
      </DemoCard>
      <DemoCard title="Destructive section" catalogId="destructive">
        <DestructiveSection
          label="Delete Example"
          description="Destructive actions are separated and always confirmed."
          testID={AgentUiIds.designSystem.delete}
          onPress={() =>
            confirmDestructiveAction({
              title: 'Delete Example?',
              message: 'This demonstrates the canonical destructive prompt.',
              actionLabel: 'Delete Example',
              onConfirm: () => undefined,
            })
          }
        />
      </DemoCard>
      <DemoCard title="Danger zone" catalogId="dangerZone">
        <DangerZone>
          <DestructiveSection
            flush
            label="Reset Example"
            description="Grouped irreversible actions sit in a red-rimmed glass panel."
            testID={AgentUiIds.designSystem.demo('dangerZoneReset')}
            onPress={() =>
              confirmDestructiveAction({
                title: 'Reset Example?',
                message: 'This demonstrates the DangerZone + flush pattern.',
                actionLabel: 'Reset Example',
                onConfirm: () => undefined,
              })
            }
          />
        </DangerZone>
      </DemoCard>
      <DemoCard title="Dropdown and toolbar" catalogId="toolbarRow">
        <ToolbarRow
          primary={
            <Dropdown
              label="Sort"
              value={sort}
              options={[
                { value: 'unhealthy', label: 'Unhealthy' },
                { value: 'healthy', label: 'Healthy' },
                { value: 'name', label: 'A–Z' },
              ]}
              onChange={setSort}
              testID={AgentUiIds.designSystem.demo('dropdown')}
            />
          }
          trailing={
            <Button size="sm" variant="ghost" onPress={() => undefined}>
              Sync
            </Button>
          }
        />
      </DemoCard>
      <DemoCard title="Action chips" catalogId="actionChip">
        <ActionChipRow
          items={[
            { id: 'a', label: 'Travel demo', onPress: () => undefined },
            { id: 'b', label: 'Health demo', onPress: () => undefined },
            { id: 'c', label: 'Plants demo', onPress: () => undefined },
          ]}
        />
      </DemoCard>

      <SectionHeader title="Status & feedback" flush />
      <DemoCard title="Status badge" catalogId="statusBadge">
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
          <StatusBadge tone="success" label="Healthy" />
          <StatusBadge tone="warning" label="Degraded" />
          <StatusBadge tone="danger" label="Unconfigured" />
          <StatusBadge tone="neutral" label="Unchecked" />
        </View>
      </DemoCard>
      <DemoCard title="Meta list" catalogId="metaList">
        <MetaList
          items={[
            { label: 'App env', value: 'development' },
            { label: 'Metro', value: '127.0.0.1:8081' },
            { label: 'Supabase', value: 'Configured' },
          ]}
        />
      </DemoCard>
      <DemoCard title="Empty, loading, error" catalogId="empty">
        <EmptyState
          icon="itinerary"
          title="Nothing here yet"
          message="Empty states share one icon + copy + optional CTA pattern."
          actionLabel="Add Item"
          onAction={onOpenSheet}
          actionTestID={AgentUiIds.designSystem.demo('emptyAction')}
        />
        <LoadingBlock label="Loading…" />
        <ErrorMessage message="Errors use the shared semantic danger treatment." />
      </DemoCard>
      <DemoCard title="Progress ring" catalogId="progress">
        <View style={{ alignItems: 'center' }}>
          <ProgressRing progress={0.72} label="72%" sublabel="Done" />
        </View>
      </DemoCard>

      <SectionHeader title="Shared patterns" flush />
      <DemoCard title="Chip row" catalogId="chipRow">
        <ChipRow
          options={[
            { value: 'a', label: 'One' },
            { value: 'b', label: 'Two' },
            { value: 'c', label: 'Three' },
          ]}
          selected={chip}
          onSelect={setChip}
          testIDForOption={(v) => AgentUiIds.designSystem.demo(`chip.${v}`)}
        />
      </DemoCard>
      <DemoCard title="Category badge" catalogId="categoryBadge">
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
          {DEMO_CATEGORIES.map((category) => (
            <CategoryBadge key={category.id} category={category} />
          ))}
        </View>
      </DemoCard>
      <DemoCard title="Metric display" catalogId="metricDisplay">
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md }}>
          <MetricDisplay label="Steps" value="8,420" accent={theme.accentPrimary} />
          <MetricDisplay label="Sleep" value="7.2 h" detail="Last night" />
        </View>
      </DemoCard>
      <DemoCard title="Activity card" catalogId="activityCard">
        <ActivityCard
          activity={DEMO_ACTIVITY}
          category={DEMO_CATEGORIES[1]!}
          onPress={onOpenSheet}
          onToggleComplete={() => undefined}
          testID={AgentUiIds.designSystem.demo('activityCard')}
        />
      </DemoCard>

      <SectionHeader title="Feature accents" flush />
      <View style={{ gap: spacing.md }}>
        <FeatureAccent feature="travel" label="Travel" />
        <FeatureAccent feature="plants" label="Plants" />
        <FeatureAccent feature="vehicles" label="Vehicles" />
      </View>
    </View>
  );
}

function FeatureAccent({
  feature,
  label,
}: {
  feature: 'travel' | 'plants' | 'vehicles';
  label: string;
}) {
  return (
    <FeatureThemeProvider feature={feature}>
      <FeatureAccentCard label={label} />
    </FeatureThemeProvider>
  );
}

function FeatureAccentCard({ label }: { label: string }) {
  const theme = useTheme();
  const { spacing } = useResponsive();
  return (
    <Card airy style={{ gap: spacing.sm }}>
      <AppText variant="callout" color="accent" bold fit>
        {label}
      </AppText>
      <View
        style={{
          height: spacing.sm,
          borderRadius: spacing.sm,
          backgroundColor: theme.accentPrimary,
        }}
      />
    </Card>
  );
}

/** Catalog ids referenced by this panel — kept for typecheck hygiene. */
export const COMPONENTS_PANEL_CATALOG_IDS: readonly DesignCatalogElement['id'][] = [
  'sectionHeader',
  'collapsibleSection',
  'glassPlate',
  'glassIconWell',
  'glassTonePill',
  'glassMetaChip',
  'glassSwitch',
  'glassPrimaryAction',
  'dangerZone',
  'sheetScaffold',
  'sheetGrabber',
  'button',
  'iconButton',
  'destructive',
  'toolbarRow',
  'actionChip',
  'statusBadge',
  'metaList',
  'empty',
  'progress',
  'chipRow',
  'categoryBadge',
  'metricDisplay',
  'activityCard',
];
