import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
    AppText,
    Card,
    EmptyState,
    GlassIconWell,
    GlassPlate,
    IconButton,
    Screen,
    Symbol,
} from '@/components/primitives';
import { fontFamilies, layout, radii, spacing } from '@/design-system';
import { useTheme } from '@/hooks/use-theme';
import { useUI } from '@/store/ui';
import { useVisionBoard } from '@/store/vision-board';
import { AgentUiIds } from '@/utils/agent-ui';
import { confirmDestructiveAction } from '@/utils/confirm-destructive';

import { VISION_BOARD_ACCENTS } from './defaults';
import { cleanupOrphanedVisionBoardImages } from './media';
import {
    isSampleVisionBoardItem,
    VISION_BOARD_DASHBOARD_PREVIEWS,
    visionBoardImageSource,
} from './sample';
import {
    categoryCover,
    countVisionBoardItems,
    itemsForCategory,
    newestVisionBoardItem,
    orderedVisionBoardCategories,
} from './selectors';
import type {
    VisionBoardAffirmationItem,
    VisionBoardImageItem,
} from './types';

import {
  boardFillPercent,
  countLabel,
  VisionSectionChip,
} from './vision-board-dashboard-chrome';
import { VisionBoardDashboardHero } from './vision-board-dashboard-hero';

export function VisionBoardDashboard() {
  const router = useRouter();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const measuredTabBarHeight = useUI((state) => state.tabBarHeight);
  const tabBarHeight =
    measuredTabBarHeight ||
    layout.bottomNavBarBaseHeight + insets.bottom;
  const categories = useVisionBoard((state) => state.categories);
  const items = useVisionBoard((state) => state.items);
  const reorderCategories = useVisionBoard((state) => state.reorderCategories);
  const removeCategory = useVisionBoard((state) => state.removeCategory);
  const [editing, setEditing] = useState(false);
  const [showPopulatedOnly, setShowPopulatedOnly] = useState(false);
  const orderedCategories = useMemo(
    () => orderedVisionBoardCategories(categories),
    [categories],
  );
  const visibleCategories = useMemo(
    () =>
      showPopulatedOnly && !editing
        ? orderedCategories.filter(
            (category) => itemsForCategory(items, category.id).length > 0,
          )
        : orderedCategories,
    [editing, items, orderedCategories, showPopulatedOnly],
  );
  const affirmation = newestVisionBoardItem<VisionBoardAffirmationItem>(
    items,
    'affirmation',
  );
  const heroImage = newestVisionBoardItem<VisionBoardImageItem>(items, 'image');
  const isWeb = Platform.OS === 'web';

  const moveCategory = (id: string, direction: -1 | 1) => {
    const index = orderedCategories.findIndex((category) => category.id === id);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= orderedCategories.length) return;
    const ids = orderedCategories.map((category) => category.id);
    [ids[index], ids[target]] = [ids[target], ids[index]];
    reorderCategories(ids);
  };

  const deleteCategory = (id: string, name: string) => {
    const categoryItems = itemsForCategory(items, id);
    const perform = () => {
      removeCategory(id);
      const referenced = useVisionBoard
        .getState()
        .items.filter((item): item is VisionBoardImageItem => item.kind === 'image')
        .map((item) => item.uri);
      void cleanupOrphanedVisionBoardImages(referenced);
    };
    const message =
      categoryItems.length === 0
        ? `Remove “${name}”?`
        : `Remove “${name}” and its ${categoryItems.length} board ${
            categoryItems.length === 1 ? 'item' : 'items'
          }?`;
    confirmDestructiveAction({
      title: 'Delete Category?',
      message,
      onConfirm: perform,
    });
  };

  return (
    <Screen
      bottomInset={false}
      contentStyle={{
        ...styles.screen,
        paddingBottom: tabBarHeight + spacing.lg,
      }}>
      <View style={styles.header}>
        <View style={styles.headerLead}>
          <View style={styles.headerCopy}>
            <AppText style={styles.title} numberOfLines={1}>
              Vision Board
            </AppText>
            <AppText
              variant="callout"
              color="secondary"
              numberOfLines={1}
              style={styles.subtitle}>
              Visualize. Believe. Achieve. ✨
            </AppText>
          </View>
        </View>
        <View style={styles.headerActions}>
          <IconButton
            icon="filter"
            shape="rounded"
            testID={AgentUiIds.vision.dashboardFilter}
            accessibilityLabel={
              showPopulatedOnly
                ? 'Show all vision board categories'
                : 'Show categories with board items'
            }
            color={showPopulatedOnly ? theme.accentPrimary : theme.textSecondary}
            onPress={() => setShowPopulatedOnly((value) => !value)}
          />
          {!isWeb ? (
            <IconButton
              icon="add"
              shape="rounded"
              testID={AgentUiIds.vision.dashboardAdd}
              accessibilityLabel="Add a vision board category"
              color={theme.accentPrimary}
              onPress={() => router.push('/vision-board/category-editor' as never)}
            />
          ) : null}
        </View>
      </View>

      {isWeb ? (
        <GlassPlate mist style={styles.webNotice}>
          <Symbol name="gallery" color={theme.textSecondary} />
          <AppText variant="callout" color="secondary" style={styles.flex}>
            Vision Board editing is available in the iOS and Android apps. Your synced boards
            remain viewable here.
          </AppText>
        </GlassPlate>
      ) : null}

      <VisionBoardDashboardHero
        affirmation={affirmation}
        heroImage={heroImage}
        itemCount={items.length}
      />
      <View style={styles.sectionHeader}>
        <AppText variant="subheading" style={styles.sectionTitle}>
          Your Categories
        </AppText>
        <View style={styles.sectionActions}>
          <VisionSectionChip
            testID={AgentUiIds.vision.dashboardViewAll}
            accessibilityLabel="Open consolidated vision board"
            icon="gallery"
            label="View All"
            color={theme.accentPrimary}
            onPress={() => router.push('/vision-board/all' as never)}
          />
          {!isWeb ? (
            <VisionSectionChip
              testID={AgentUiIds.vision.dashboardEdit}
              accessibilityLabel={
                editing
                  ? 'Finish editing vision board categories'
                  : 'Edit vision board categories'
              }
              icon={editing ? 'check' : 'edit'}
              label={editing ? 'Done' : 'Edit'}
              color={theme.success}
              onPress={() => setEditing((value) => !value)}
            />
          ) : null}
        </View>
      </View>

      {visibleCategories.length === 0 ? (
        <EmptyState
          icon="vision-board"
          title={
            showPopulatedOnly
              ? 'Your boards are ready for inspiration'
              : 'Create Your First Category'
          }
          message={
            showPopulatedOnly
              ? 'Add something to a category or show all categories.'
              : 'Give a part of your future its own place to grow.'
          }
          actionLabel={
            showPopulatedOnly ? 'Show All' : isWeb ? undefined : 'Add Category'
          }
          onAction={
            showPopulatedOnly
              ? () => setShowPopulatedOnly(false)
              : isWeb
                ? undefined
                : () => router.push('/vision-board/category-editor' as never)
          }
        />
      ) : (
        <View style={styles.categories}>
          {visibleCategories.map((category) => {
            const categoryItems = itemsForCategory(items, category.id);
            const counts = countVisionBoardItems(categoryItems);
            const preview =
              VISION_BOARD_DASHBOARD_PREVIEWS[
                category.id as keyof typeof VISION_BOARD_DASHBOARD_PREVIEWS
              ];
            const isSampleOnly =
              categoryItems.length > 0 &&
              categoryItems.every(isSampleVisionBoardItem);
            const usesPreview =
              Boolean(preview) && (categoryItems.length === 0 || isSampleOnly);
            const fillPercent =
              usesPreview && preview
                ? preview.progress
                : boardFillPercent(counts);
            const cover = categoryCover(items, category.id);
            const coverSource =
              usesPreview && preview
                ? preview.source
                : cover
                  ? visionBoardImageSource(cover.uri)
                  : null;
            const preset = VISION_BOARD_ACCENTS[category.accent];
            const accent = theme.name === 'light' ? preset.light : preset.dark;
            const tint =
              theme.name === 'light' ? preset.tintLight : preset.tintDark;
            const categoryIndex = orderedCategories.findIndex(
              (item) => item.id === category.id,
            );
            return (
              <Card
                key={category.id}
                airy
                padded={false}
                testID={AgentUiIds.vision.dashboardCategory(category.id)}
                accessibilityLabel={`Open ${category.name} vision board, ${countLabel(counts)}, ${fillPercent}% filled`}
                onPress={
                  editing
                    ? undefined
                    : () => router.push(`/vision-board/${category.id}` as never)
                }
                style={[
                  styles.categoryCard,
                  editing && styles.categoryCardEditing,
                ]}>
                <View style={styles.cover}>
                  <View
                    style={[
                      StyleSheet.absoluteFill,
                      styles.coverSurface,
                      { backgroundColor: tint },
                    ]}>
                    {coverSource ? (
                      <Image
                        source={coverSource}
                        style={StyleSheet.absoluteFill}
                        contentFit="cover"
                        accessibilityLabel={
                          usesPreview
                            ? `${category.name} inspiration preview`
                            : cover?.caption || `${category.name} cover`
                        }
                      />
                    ) : (
                      <Symbol name={category.icon} size={34} color={accent} />
                    )}
                  </View>
                </View>
                <View style={[styles.categoryBody, editing && styles.categoryBodyEditing]}>
                  <View style={styles.categoryTitleRow}>
                    <GlassIconWell size={36} borderRadius={radii.md}>
                      <Symbol name={category.icon} size={19} color={accent} />
                    </GlassIconWell>
                    <View style={[styles.flex, styles.categoryCopy]}>
                      <AppText
                        style={[styles.categoryName, { fontFamily: fontFamilies.serif }]}
                        numberOfLines={1}>
                        {category.name}
                      </AppText>
                      <AppText
                        variant="caption"
                        color="secondary"
                        numberOfLines={2}
                        style={styles.categoryIntention}>
                        {category.intention}
                      </AppText>
                    </View>
                    {!editing ? (
                      <Symbol name="chevron-right" color={theme.textTertiary} />
                    ) : null}
                  </View>
                  <View style={styles.progressRow}>
                    <View
                      style={[
                        styles.progressTrack,
                        { backgroundColor: theme.separator },
                      ]}>
                      <View
                        style={[
                          styles.progressFill,
                          {
                            backgroundColor: accent,
                            width: `${fillPercent}%`,
                          },
                        ]}
                      />
                    </View>
                    <AppText
                      variant="caption"
                      color="secondary"
                      style={styles.progressLabel}
                      numberOfLines={1}>
                      {fillPercent}%
                    </AppText>
                  </View>
                  {editing ? (
                    <View style={styles.editActions}>
                      <IconButton
                        icon="arrow-up"
                        disabled={categoryIndex === 0}
                        accessibilityLabel={`Move ${category.name} up`}
                        onPress={() => moveCategory(category.id, -1)}
                      />
                      <IconButton
                        icon="arrow-down"
                        disabled={categoryIndex === orderedCategories.length - 1}
                        accessibilityLabel={`Move ${category.name} down`}
                        onPress={() => moveCategory(category.id, 1)}
                      />
                      <IconButton
                        icon="edit"
                        accessibilityLabel={`Edit ${category.name}`}
                        onPress={() =>
                          router.push({
                            pathname: '/vision-board/category-editor',
                            params: { id: category.id },
                          } as never)
                        }
                      />
                      <IconButton
                        icon="delete"
                        color={theme.danger}
                        accessibilityLabel={`Delete ${category.name}`}
                        onPress={() => deleteCategory(category.id, category.name)}
                      />
                    </View>
                  ) : null}
                </View>
              </Card>
            );
          })}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: {
    width: '100%',
    maxWidth: 720,
    alignSelf: 'center',
    gap: spacing.md,
    paddingTop: spacing.xs,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  headerLead: {
    minWidth: 0,
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  headerCopy: { minWidth: 0, flex: 1, gap: spacing.xxs },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  title: {
    fontFamily: fontFamilies.serif,
    fontSize: 32,
    lineHeight: 37,
    fontWeight: '400',
  },
  subtitle: { fontFamily: fontFamilies.serif, fontWeight: '400' },
  webNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderRadius: radii.md,
    borderCurve: 'continuous',
    padding: spacing.md,
  },
  sectionHeader: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  sectionTitle: {
    fontFamily: fontFamilies.serif,
    fontSize: 16,
    lineHeight: 21,
    fontWeight: '400',
  },
  sectionActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  categories: { gap: spacing.sm },
  categoryCard: {
    minHeight: 88,
    overflow: 'hidden',
    flexDirection: 'row',
    borderRadius: 18,
    borderCurve: 'continuous',
    zIndex: 1,
  },
  categoryCardEditing: { minHeight: 144 },
  cover: { width: 116 },
  coverSurface: {
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 18,
    borderTopRightRadius: 0,
  },
  categoryBody: {
    flex: 1,
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  categoryBodyEditing: { gap: spacing.sm, paddingVertical: spacing.md },
  categoryTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  categoryCopy: { gap: 3 },
  iconTile: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.md,
    borderCurve: 'continuous',
  },
  categoryName: { fontSize: 18, lineHeight: 21, fontWeight: '400' },
  categoryIntention: {
    fontFamily: fontFamilies.serif,
    fontSize: 11.5,
    lineHeight: 15,
    fontWeight: '400',
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  progressTrack: {
    flex: 1,
    maxWidth: 140,
    height: 5,
    overflow: 'hidden',
    borderRadius: radii.pill,
  },
  progressFill: {
    height: '100%',
    borderRadius: radii.pill,
  },
  progressLabel: {
    minWidth: 30,
    fontFamily: fontFamilies.serif,
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '400',
    textAlign: 'right',
    fontVariant: ['tabular-nums'],
  },
  editActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.sm,
  },
  flex: { flex: 1 }
});
