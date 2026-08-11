import { type ReactNode, useEffect, useId, useRef, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
  type ModalProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Animated, { FadeInDown, FadeOutUp, ReduceMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  FieldLeadingIcon,
  fieldLeadingIconRowStyle,
} from '@/components/primitives/field-leading-icon';
import {
  borders,
  motion,
  radii,
  shadows,
  spacing,
  type AppIconName,
} from '@/design-system';
import { useResponsive } from '@/hooks/use-responsive';
import { useTheme } from '@/hooks/use-theme';
import { useAgentUiTarget } from '@/utils/agent-ui';
import { haptics } from '@/utils/haptics';

import { AppText } from './app-text';
import { DisclosureChevron } from './disclosure-chevron';
import {
  placeDropdownMenu,
  type DropdownAnchor,
} from './dropdown-layout';
import { fieldTitleCase } from './field-title-case';
import { GlassPlate } from './glass-plate';
import { Symbol } from './symbol';

const ITEM_HEIGHT = 44;
const MENU_MAX_HEIGHT = 280;
const MENU_PADDING = spacing.xs;

export type DropdownOption<T extends string = string> = {
  value: T;
  label: string;
  testID?: string;
  leading?: ReactNode;
};

export type DropdownTriggerRenderProps = {
  open: boolean;
  label: string;
  selectedLabel: string;
  onPress: () => void;
  fieldRef: React.RefObject<View | null>;
};

export type DropdownProps<T extends string = string> = {
  label: string;
  value: T;
  options: readonly DropdownOption<T>[];
  onChange: (value: T) => void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  testID?: string;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  menuMaxHeight?: number;
  matchTriggerWidth?: boolean;
  icon?: AppIconName;
  iconBackground?: string;
  iconColor?: string;
  fieldBackground?: string;
  labelColor?: string;
  fieldStyle?: StyleProp<ViewStyle>;
  /** Orientations supported by the native menu modal (iOS). */
  supportedOrientations?: ModalProps['supportedOrientations'];
  /** Custom trigger — menu still overlays via Modal. */
  renderTrigger?: (props: DropdownTriggerRenderProps) => ReactNode;
};

function DropdownOptionRow<T extends string>({
  option,
  selected,
  onSelect,
}: {
  option: DropdownOption<T>;
  selected: boolean;
  onSelect: () => void;
}) {
  const theme = useTheme();
  const handlePress = () => {
    haptics.select();
    onSelect();
  };
  const agent = useAgentUiTarget(option.testID, {
    label: option.label,
    onPress: handlePress,
  });

  return (
    <Pressable
      ref={agent.ref}
      onLayout={agent.onLayout}
      testID={agent.testID}
      accessibilityRole="menuitem"
      accessibilityLabel={option.label}
      accessibilityState={{ selected }}
      onPress={handlePress}
      style={({ pressed }) => [
        styles.option,
        {
          backgroundColor:
            selected || pressed ? theme.accentFaint : 'transparent',
          opacity: pressed ? 0.78 : 1,
        },
      ]}>
      {option.leading ? <View style={styles.optionLeading}>{option.leading}</View> : null}
      <AppText
        variant="callout"
        color={selected ? 'accent' : 'primary'}
        numberOfLines={1}
        style={styles.optionLabel}>
        {fieldTitleCase(option.label)}
      </AppText>
      {selected ? <Symbol name="check" size="sm" color={theme.accentPrimary} /> : null}
    </Pressable>
  );
}

/**
 * Field + overlay menu. The menu floats in a transparent Modal so opening it
 * never pushes sibling layout down.
 */
export function Dropdown<T extends string = string>({
  label,
  value,
  options,
  onChange,
  open: openProp,
  onOpenChange,
  testID,
  accessibilityLabel,
  accessibilityHint = 'Opens a dropdown to choose another option',
  menuMaxHeight = MENU_MAX_HEIGHT,
  matchTriggerWidth = true,
  icon,
  iconBackground,
  iconColor,
  fieldBackground,
  labelColor,
  fieldStyle,
  supportedOrientations,
  renderTrigger,
}: DropdownProps<T>) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const { s, spacing: rs } = useResponsive();
  const listId = useId();
  const fieldRef = useRef<View>(null);
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const [anchor, setAnchor] = useState<DropdownAnchor>();
  const isOpen = openProp ?? uncontrolledOpen;

  const fieldLabel = fieldTitleCase(label);
  const selectedLabel = fieldTitleCase(
    options.find((option) => option.value === value)?.label ?? value,
  );
  const a11yLabel = accessibilityLabel ?? `${fieldLabel}: ${selectedLabel}`;

  useEffect(() => {
    if (!isOpen) {
      setAnchor(undefined);
      return;
    }
    if (anchor) return;
    fieldRef.current?.measureInWindow((x, y, width, height) => {
      if (width <= 0 || height <= 0) return;
      setAnchor({ x, y, width, height });
    });
  }, [isOpen, anchor]);

  const setOpen = (next: boolean) => {
    onOpenChange?.(next);
    if (openProp === undefined) setUncontrolledOpen(next);
    if (!next) setAnchor(undefined);
  };

  const openMenu = () => {
    fieldRef.current?.measureInWindow((x, y, width, height) => {
      if (width <= 0 || height <= 0) return;
      setAnchor({ x, y, width, height });
      setOpen(true);
    });
  };

  const toggle = () => {
    haptics.select();
    if (isOpen) {
      setOpen(false);
      return;
    }
    openMenu();
  };

  const choose = (next: T) => {
    if (next !== value) onChange(next);
    setOpen(false);
  };

  const contentHeight = options.length * ITEM_HEIGHT + MENU_PADDING * 2;
  const placement =
    anchor &&
    placeDropdownMenu({
      anchor,
      windowWidth,
      windowHeight,
      insetTop: insets.top,
      insetBottom: insets.bottom,
      insetLeft: insets.left,
      insetRight: insets.right,
      contentHeight,
      menuMaxHeight,
      gutter: spacing.md,
      gap: spacing.xs,
      matchTriggerWidth,
    });

  const triggerAgent = useAgentUiTarget(testID, {
    label: a11yLabel,
    // Registry value for --contains (selected option value / label).
    value: String(value ?? selectedLabel ?? ''),
    onPress: toggle,
  });

  const fieldBorderColor = isOpen
    ? theme.accentSoft
    : icon
      ? 'transparent'
      : theme.separator;
  const useGlassField = !fieldBackground;

  const defaultTrigger = useGlassField ? (
    <GlassPlate
      style={[
        styles.field,
        {
          borderColor: fieldBorderColor,
        },
        fieldStyle,
      ]}>
      <Pressable
        ref={(node) => {
          fieldRef.current = node;
          triggerAgent.ref(node);
        }}
        onLayout={triggerAgent.onLayout}
        testID={triggerAgent.testID}
        accessibilityRole="button"
        accessibilityLabel={a11yLabel}
        accessibilityHint={accessibilityHint}
        accessibilityState={{ expanded: isOpen }}
        onPress={toggle}
        style={({ pressed }) => [
          fieldLeadingIconRowStyle({
            minHeight: icon ? Math.max(56, s(60)) : Math.max(48, s(52)),
            paddingHorizontal: icon ? rs.md : spacing.md,
            paddingVertical: icon ? rs.sm : spacing.sm,
            backgroundColor: 'transparent',
            borderColor: 'transparent',
            opacity: pressed ? 0.86 : 1,
          }),
          styles.fieldInner,
        ]}>
        {icon ? (
          <FieldLeadingIcon
            name={icon}
            backgroundColor={iconBackground}
            color={iconColor}
          />
        ) : null}
        <View style={styles.fieldCopy}>
          <AppText
            variant={icon ? 'caption' : 'overline'}
            color={icon ? undefined : 'tertiary'}
            fit
            numberOfLines={1}
            style={
              icon
                ? { color: labelColor, fontWeight: '600' }
                : { fontSize: s(9), lineHeight: s(11), letterSpacing: 0.9 }
            }>
              {fieldLabel}
            </AppText>
            <AppText variant={icon ? 'body' : 'callout'} fit numberOfLines={1}>
              {selectedLabel}
            </AppText>
        </View>
        <DisclosureChevron
          expanded={isOpen}
          variant="down-up"
          size="sm"
          color={theme.textTertiary}
        />
      </Pressable>
    </GlassPlate>
  ) : (
    <Pressable
      ref={(node) => {
        fieldRef.current = node;
        triggerAgent.ref(node);
      }}
      onLayout={triggerAgent.onLayout}
      testID={triggerAgent.testID}
      accessibilityRole="button"
      accessibilityLabel={a11yLabel}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ expanded: isOpen }}
      onPress={toggle}
      style={({ pressed }) => [
        styles.field,
        fieldLeadingIconRowStyle({
          minHeight: icon ? Math.max(56, s(60)) : Math.max(48, s(52)),
          paddingHorizontal: icon ? rs.md : spacing.md,
          paddingVertical: icon ? rs.sm : spacing.sm,
          backgroundColor: fieldBackground,
          borderColor: fieldBorderColor,
          opacity: pressed ? 0.86 : 1,
        }),
        fieldStyle,
      ]}>
      {icon ? (
        <FieldLeadingIcon
          name={icon}
          backgroundColor={iconBackground}
          color={iconColor}
        />
      ) : null}
      <View style={styles.fieldCopy}>
        <AppText
          variant={icon ? 'caption' : 'overline'}
          color={icon ? undefined : 'tertiary'}
          fit
          numberOfLines={1}
          style={
            icon
              ? { color: labelColor, fontWeight: '600' }
              : { fontSize: s(9), lineHeight: s(11), letterSpacing: 0.9 }
          }>
            {fieldLabel}
          </AppText>
          <AppText variant={icon ? 'body' : 'callout'} fit numberOfLines={1}>
            {selectedLabel}
          </AppText>
      </View>
      <DisclosureChevron
        expanded={isOpen}
        variant="down-up"
        size="sm"
        color={theme.textTertiary}
      />
    </Pressable>
  );

  return (
    <View style={styles.wrap}>
      {renderTrigger
        ? renderTrigger({
            open: isOpen,
            label,
            selectedLabel,
            onPress: toggle,
            fieldRef,
          })
        : defaultTrigger}

      <Modal
        animationType="fade"
        onRequestClose={() => setOpen(false)}
        presentationStyle="overFullScreen"
        supportedOrientations={supportedOrientations}
        statusBarTranslucent
        transparent
        visible={Boolean(isOpen && anchor && placement)}>
        <View style={styles.modalRoot}>
          <Pressable
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            onPress={() => setOpen(false)}
            style={StyleSheet.absoluteFill}
          />
          {placement ? (
            <Animated.View
              accessibilityLabel={`${fieldLabel} menu`}
              accessibilityViewIsModal
              entering={FadeInDown.duration(motion.fade).reduceMotion(
                ReduceMotion.System,
              )}
              exiting={FadeOutUp.duration(motion.fade).reduceMotion(
                ReduceMotion.System,
              )}
              style={[
                styles.menu,
                shadows.overlay,
                {
                  top: placement.top,
                  left: placement.left,
                  width: placement.width,
                  maxHeight: placement.maxHeight,
                  borderColor: theme.separator,
                },
              ]}>
              <GlassPlate style={StyleSheet.absoluteFill} />
              <ScrollView
                bounces={contentHeight > menuMaxHeight}
                keyboardShouldPersistTaps="handled"
                nestedScrollEnabled
                showsVerticalScrollIndicator={contentHeight > menuMaxHeight}
                style={{
                  zIndex: 1,
                  maxHeight: placement.maxHeight - MENU_PADDING * 2,
                }}>
                {options.map((option) => (
                  <DropdownOptionRow
                    key={`${listId}-${option.value}`}
                    option={option}
                    selected={option.value === value}
                    onSelect={() => choose(option.value)}
                  />
                ))}
              </ScrollView>
            </Animated.View>
          ) : null}
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    zIndex: 2,
  },
  field: {
    borderWidth: borders.thin,
    borderRadius: radii.md,
    borderCurve: 'continuous',
    gap: spacing.sm,
    overflow: 'hidden',
  },
  fieldInner: {
    zIndex: 1,
    gap: spacing.sm,
  },
  fieldCopy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  modalRoot: {
    flex: 1,
  },
  menu: {
    position: 'absolute',
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radii.lg,
    borderCurve: 'continuous',
    paddingVertical: MENU_PADDING,
  },
  option: {
    minHeight: ITEM_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  optionLeading: {
    flexShrink: 0,
  },
  optionLabel: {
    flex: 1,
    minWidth: 0,
  },
});
