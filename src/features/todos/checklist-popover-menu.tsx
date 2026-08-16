import { useRef, useState } from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated from 'react-native-reanimated';

import {
  AppText,
  GlassPlate,
  IconButton,
  SheetScaffold,
  Symbol,
} from '@/components/primitives';
import { clampNumber } from '@/components/primitives/dropdown-layout';
import {
  fontFamilies,
  glassMaterials,
  popoverEntering,
  popoverExiting,
  radii,
  shadows,
  spacing,
  type AppIconName,
} from '@/design-system';
import { useResponsive } from '@/hooks/use-responsive';
import { useTheme } from '@/hooks/use-theme';
import { useAgentUiTarget } from '@/utils/agent-ui';
import { haptics } from '@/utils/haptics';

import {
  ChecklistPopoverItems,
  type ChecklistPopoverItem,
} from './checklist-popover-items';

export type { ChecklistPopoverItem };

interface ChecklistPopoverMenuProps {
  title: string;
  accessibilityLabel: string;
  triggerIcon: AppIconName;
  items: ChecklistPopoverItem[];
  onSelect: (id: string) => void;
  testID?: string;
  presentation?: 'popover' | 'sheet';
  sheetSubtitle?: string;
  closeTestID?: string;
  itemTestID?: (id: string) => string;
}

interface Anchor {
  x: number;
  y: number;
  width: number;
  height: number;
}

const PANEL_WIDTH = 300;
const PANEL_PADDING = spacing.sm;
const PANEL_HEADER_HEIGHT = 66;
const ITEM_HEIGHT = 64;

export function ChecklistPopoverMenu({
  title,
  accessibilityLabel,
  triggerIcon,
  items,
  onSelect,
  testID,
  presentation = 'popover',
  sheetSubtitle,
  closeTestID,
  itemTestID,
}: ChecklistPopoverMenuProps) {
  const theme = useTheme();
  const { s } = useResponsive();
  const dark = theme.name === 'dark';
  const plateBorder = dark
    ? glassMaterials.border.dark
    : glassMaterials.border.light;
  const insets = useSafeAreaInsets();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const [anchor, setAnchor] = useState<Anchor>();
  const [visible, setVisible] = useState(false);
  const openRef = useRef<() => void>(() => undefined);

  const panelWidth = Math.min(
    PANEL_WIDTH,
    windowWidth - insets.left - insets.right - spacing.xl * 2,
  );
  const panelHeight =
    PANEL_HEADER_HEIGHT +
    items.length * ITEM_HEIGHT +
    items.filter((item) => item.dividerBefore).length * spacing.md +
    PANEL_PADDING * 2;
  const minimumLeft = insets.left + spacing.lg;
  const maximumLeft = Math.max(
    minimumLeft,
    windowWidth - insets.right - spacing.lg - panelWidth,
  );
  const panelLeft = anchor
    ? clampNumber(
        anchor.x + anchor.width - panelWidth,
        minimumLeft,
        maximumLeft,
      )
    : maximumLeft;
  const spaceBelow = anchor
    ? windowHeight - insets.bottom - spacing.lg - (anchor.y + anchor.height)
    : 0;
  const panelTop = anchor
    ? spaceBelow >= panelHeight + spacing.sm
      ? anchor.y + anchor.height + spacing.sm
      : Math.max(insets.top + spacing.lg, anchor.y - panelHeight - spacing.sm)
    : insets.top + spacing.xxxl;
  const triggerRef = useRef<View | null>(null);

  const agent = useAgentUiTarget(testID, {
    label: accessibilityLabel,
    onPress: () => openRef.current(),
  });

  const pendingSelectRef = useRef<string | null>(null);

  const open = () => {
    haptics.select();
    if (presentation === 'sheet') {
      setVisible(true);
      return;
    }
    triggerRef.current?.measureInWindow((x, y, width, height) => {
      setAnchor({ x, y, width, height });
      setVisible(true);
    });
  };
  openRef.current = open;

  const close = () => setVisible(false);
  const flushPendingSelect = () => {
    const id = pendingSelectRef.current;
    pendingSelectRef.current = null;
    if (id) onSelect(id);
  };
  const selectItem = (id: string) => {
    close();
    // Sheet presentation uses a native Modal with a held exit. Presenting
    // appPrompt in the same tick mounts it in the sheet's embedded host, then
    // remounts on the root when the sheet unmounts — the confirm glitches twice.
    if (presentation === 'sheet') {
      pendingSelectRef.current = id;
      return;
    }
    onSelect(id);
  };

  return (
    <>
      <Pressable
        ref={triggerRef}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        accessibilityState={{ expanded: visible }}
        testID={agent.testID}
        onLayout={agent.onLayout}
        hitSlop={4}
        onPress={open}
        style={({ pressed }) => [
          styles.triggerWrap,
          { opacity: pressed ? 0.72 : 1 },
        ]}>
        <GlassPlate
          airy
          style={[
            styles.trigger,
            {
              borderColor: visible ? theme.accentSoft : plateBorder,
            },
          ]}>
          <Symbol
            name={triggerIcon}
            size={16}
            color={theme.accentPrimary}
          />
        </GlassPlate>
      </Pressable>

      {presentation === 'sheet' ? (
        <SheetScaffold
          visible={visible}
          eyebrow="Checklist"
          title={title}
          subtitle={sheetSubtitle}
          closeAccessibilityLabel="Close list actions"
          closeTestID={closeTestID}
          onClose={close}
          onExited={flushPendingSelect}
          contentContainerStyle={styles.sheetContent}>
          <ChecklistPopoverItems
            items={items}
            density="sheet"
            itemTestID={itemTestID}
            onSelect={selectItem}
          />
        </SheetScaffold>
      ) : (
        <Modal
          animationType="fade"
          onRequestClose={close}
          presentationStyle="overFullScreen"
          statusBarTranslucent
          transparent
          visible={visible}>
          <View
            style={[
              styles.modalRoot,
              {
                paddingTop: insets.top,
                paddingRight: insets.right,
                paddingBottom: insets.bottom,
                paddingLeft: insets.left,
              },
            ]}>
            <Pressable
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
              onPress={close}
              style={[
                StyleSheet.absoluteFill,
                { backgroundColor: theme.overlayScrim },
              ]}
            />
            <Animated.View
              accessibilityLabel={`${title} menu`}
              accessibilityViewIsModal
              entering={popoverEntering()}
              exiting={popoverExiting()}
              style={[
                styles.panelShell,
                shadows.overlay,
                {
                  width: panelWidth,
                  left: panelLeft,
                  top: panelTop,
                },
              ]}>
              <GlassPlate
                style={[
                  styles.panel,
                  { borderColor: plateBorder },
                ]}>
                <View style={styles.panelContent}>
                  <View style={styles.panelHeader}>
                    <View style={styles.panelCopy}>
                      <AppText variant="overline" color="accent">
                        Checklist
                      </AppText>
                      <AppText
                        variant="subheading"
                        style={[
                          styles.panelTitle,
                          { fontSize: s(21), lineHeight: s(25) },
                        ]}>
                        {title}
                      </AppText>
                    </View>
                    <IconButton
                      icon="close"
                      size={36}
                      accessibilityLabel="Close menu"
                      onPress={close}
                    />
                  </View>

                  <ChecklistPopoverItems
                    items={items}
                    density="compact"
                    itemTestID={itemTestID}
                    onSelect={selectItem}
                  />
                </View>
              </GlassPlate>
            </Animated.View>
          </View>
        </Modal>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  triggerWrap: {
    borderRadius: radii.pill,
  },
  trigger: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.pill,
  },
  modalRoot: {
    flex: 1,
  },
  panelShell: {
    position: 'absolute',
  },
  panel: {
    width: '100%',
    borderRadius: radii.xl,
    borderCurve: 'continuous',
  },
  panelContent: {
    zIndex: 1,
    padding: PANEL_PADDING,
    gap: spacing.xxs,
  },
  panelHeader: {
    minHeight: PANEL_HEADER_HEIGHT,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
  },
  panelCopy: {
    flex: 1,
    minWidth: 0,
    gap: spacing.xxs,
    justifyContent: 'center',
  },
  panelTitle: {
    fontFamily: fontFamilies.serif,
  },
  sheetContent: {
    paddingTop: 0,
  },
});
