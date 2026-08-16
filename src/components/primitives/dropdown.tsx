import { type ReactNode, useEffect, useId, useMemo, useRef, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  useWindowDimensions,
  View,
  type ModalProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  FieldLeadingIcon,
  fieldLeadingIconRowStyle,
} from '@/components/primitives/field-leading-icon';
import {
  borders,
  glassFieldBackground,
  popoverEntering,
  popoverExiting,
  radii,
  shadows,
  spacing,
  type AppIconName,
} from '@/design-system';
import { useDockedKeyboardInset } from '@/hooks/use-docked-keyboard-inset';
import { useResponsive } from '@/hooks/use-responsive';
import { useTheme } from '@/hooks/use-theme';
import { useAgentUiTarget } from '@/utils/agent-ui';
import { haptics } from '@/utils/haptics';

import { AppText } from './app-text';
import { DisclosureChevron } from './disclosure-chevron';
import { filterDropdownOptions } from './dropdown-filter';
import { placeDropdownMenu, type DropdownAnchor } from './dropdown-layout';
import { fieldTitleCase } from './field-title-case';
import { GlassPlate } from './glass-plate';
import { Symbol } from './symbol';

const ITEM_HEIGHT = 44;
const DESCRIBED_ITEM_HEIGHT = 58;
const MENU_MAX_HEIGHT = 280;
const MENU_PADDING = spacing.xs;

export type DropdownOption<T extends string = string> = {
  value: T;
  label: string;
  description?: string;
  /** Extra terms included when this dropdown is searchable. */
  searchText?: string;
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

type DropdownCommonProps<T extends string = string> = {
  label: string;
  options: readonly DropdownOption<T>[];
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  testID?: string;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  menuMaxHeight?: number;
  /** Optional interactive content rendered after the selectable menu rows. */
  menuFooter?: ReactNode;
  /** Estimated footer height used to keep overlay placement within the viewport. */
  menuFooterHeight?: number;
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
  searchable?: boolean;
  searchPlaceholder?: string;
  searchTestID?: string;
  emptyMessage?: string;
  placeholder?: string;
  /** Preserve data casing for names and other user-authored option labels. */
  preserveOptionCase?: boolean;
};

export type DropdownProps<T extends string = string> =
  | (DropdownCommonProps<T> & {
      multiple?: false;
      value: T;
      onChange: (value: T) => void;
      /** Optional action when the already-selected option is pressed again. */
      onReselect?: (value: T) => void;
    })
  | (DropdownCommonProps<T> & {
      multiple: true;
      value: readonly T[];
      onChange: (value: T[]) => void;
      onReselect?: never;
    });

function DropdownOptionRow<T extends string>({
  option,
  selected,
  onSelect,
  preserveCase,
}: {
  option: DropdownOption<T>;
  selected: boolean;
  onSelect: () => void;
  preserveCase: boolean;
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
          backgroundColor: selected || pressed ? theme.accentFaint : 'transparent',
          opacity: pressed ? 0.78 : 1,
        },
      ]}
    >
      {option.leading ? <View style={styles.optionLeading}>{option.leading}</View> : null}
      <View style={styles.optionCopy}>
        <AppText variant="callout" color={selected ? 'accent' : 'primary'} numberOfLines={1}>
          {preserveCase ? option.label : fieldTitleCase(option.label)}
        </AppText>
        {option.description ? (
          <AppText variant="caption" color="secondary" numberOfLines={1}>
            {option.description}
          </AppText>
        ) : null}
      </View>
      {selected ? <Symbol name="check" size="sm" color={theme.accentPrimary} /> : null}
    </Pressable>
  );
}

/**
 * Field + overlay menu. The menu floats in a transparent Modal so opening it
 * never pushes sibling layout down.
 */
export function Dropdown<T extends string = string>(props: DropdownProps<T>) {
  const {
    label,
    value,
    options,
    onChange,
    onReselect,
    open: openProp,
    onOpenChange,
    testID,
    accessibilityLabel,
    accessibilityHint = props.multiple
      ? 'Opens a dropdown to choose one or more options'
      : 'Opens a dropdown to choose another option',
    menuMaxHeight = MENU_MAX_HEIGHT,
    menuFooter,
    menuFooterHeight = ITEM_HEIGHT,
    matchTriggerWidth = true,
    icon,
    iconBackground,
    iconColor,
    fieldBackground,
    labelColor,
    fieldStyle,
    supportedOrientations,
    renderTrigger,
    searchable = false,
    searchPlaceholder = 'Search Options',
    searchTestID,
    emptyMessage = 'No Matching Options',
    placeholder = 'Select',
    preserveOptionCase = false,
  } = props;
  const multiple = props.multiple === true;
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const { s, spacing: rs } = useResponsive();
  const listId = useId();
  const fieldRef = useRef<View>(null);
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const [anchor, setAnchor] = useState<DropdownAnchor>();
  const [query, setQuery] = useState('');
  const isOpen = openProp ?? uncontrolledOpen;
  // RN Modal ignores soft-input — lift/re-place like SheetScaffold.
  const { keyboardInset } = useDockedKeyboardInset({
    enabled: isOpen,
    androidMode: 'modal',
  });

  const selectedValues = multiple
    ? ((value as readonly T[]) ?? [])
    : value !== undefined && value !== null
      ? [value as T]
      : [];
  const selectedLabels = options
    .filter((option) => selectedValues.includes(option.value))
    .map((option) => option.label);
  const fieldLabel = fieldTitleCase(label);
  const rawSelectedLabel =
    selectedLabels.length > 0
      ? selectedLabels.join(', ')
      : multiple
        ? placeholder
        : String(value ?? '');
  const selectedLabel = preserveOptionCase ? rawSelectedLabel : fieldTitleCase(rawSelectedLabel);
  const a11yLabel = accessibilityLabel ?? `${fieldLabel}: ${selectedLabel}`;

  const measureAnchor = () => {
    fieldRef.current?.measureInWindow((x, y, width, height) => {
      if (width <= 0 || height <= 0) return;
      setAnchor({ x, y, width, height });
    });
  };

  useEffect(() => {
    if (!isOpen) {
      setAnchor(undefined);
      setQuery('');
      return;
    }
    // Remeasure when the IME opens — parent sheets lift and stale anchors
    // leave menuFooter inputs under the keyboard.
    measureAnchor();
  }, [isOpen, keyboardInset]);

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
    if (multiple) {
      const current = selectedValues;
      const nextValues = current.includes(next)
        ? current.filter((item) => item !== next)
        : [...current, next];
      (onChange as (value: T[]) => void)(nextValues);
      return;
    }
    if (next === value) onReselect?.(next);
    else (onChange as (value: T) => void)(next);
    setOpen(false);
  };

  const footerHeight = menuFooter ? menuFooterHeight : 0;
  const visibleOptions = useMemo(
    () => (searchable ? filterDropdownOptions(options, query) : [...options]),
    [options, query, searchable],
  );
  const itemHeight = options.some((option) => option.description)
    ? DESCRIBED_ITEM_HEIGHT
    : ITEM_HEIGHT;
  const searchHeight = searchable ? Math.max(48, s(52)) : 0;
  const contentHeight =
    Math.max(ITEM_HEIGHT, visibleOptions.length * itemHeight) +
    searchHeight +
    footerHeight +
    MENU_PADDING * 2;
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
      keyboardInset,
    });
  const listMaxHeight = placement
    ? Math.max(ITEM_HEIGHT, placement.maxHeight - MENU_PADDING * 2 - footerHeight - searchHeight)
    : menuMaxHeight;

  const searchAgent = useAgentUiTarget(searchTestID, {
    label: searchPlaceholder,
    value: query,
  });

  const triggerAgent = useAgentUiTarget(testID, {
    label: a11yLabel,
    // Registry value for --contains (selected option value / label).
    value: String(
      multiple ? selectedValues.join(',') || selectedLabel || '' : (value ?? selectedLabel ?? ''),
    ),
    onPress: toggle,
  });

  const fieldBorderColor = isOpen ? theme.accentSoft : icon ? 'transparent' : theme.separator;
  const useGlassField = !fieldBackground;

  const defaultTrigger = useGlassField ? (
    <GlassPlate
      style={[
        styles.field,
        {
          borderColor: fieldBorderColor,
        },
        fieldStyle,
      ]}
    >
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
        ]}
      >
        {icon ? (
          <FieldLeadingIcon name={icon} backgroundColor={iconBackground} color={iconColor} />
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
            }
          >
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
      ]}
    >
      {icon ? (
        <FieldLeadingIcon name={icon} backgroundColor={iconBackground} color={iconColor} />
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
          }
        >
          {fieldLabel}
        </AppText>
        <AppText variant={icon ? 'body' : 'callout'} fit numberOfLines={1}>
          {selectedLabel}
        </AppText>
      </View>
      <DisclosureChevron expanded={isOpen} variant="down-up" size="sm" color={theme.textTertiary} />
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
        visible={Boolean(isOpen && anchor && placement)}
      >
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
              entering={popoverEntering()}
              exiting={popoverExiting()}
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
              ]}
            >
              <GlassPlate style={StyleSheet.absoluteFill} />
              {searchable ? (
                <View
                  style={[
                    styles.searchWrap,
                    {
                      minHeight: searchHeight,
                      borderBottomColor: theme.separator,
                      backgroundColor: glassFieldBackground(theme.name),
                    },
                  ]}
                >
                  <Symbol name="search" size="sm" color={theme.textTertiary} />
                  <TextInput
                    ref={searchAgent.ref as never}
                    testID={searchAgent.testID}
                    onLayout={searchAgent.onLayout}
                    value={query}
                    onChangeText={setQuery}
                    placeholder={searchPlaceholder}
                    placeholderTextColor={theme.textTertiary}
                    autoCapitalize="none"
                    autoCorrect={false}
                    clearButtonMode="while-editing"
                    style={[styles.searchInput, { color: theme.textPrimary, fontSize: s(16) }]}
                  />
                </View>
              ) : null}
              <ScrollView
                bounces={visibleOptions.length * itemHeight > listMaxHeight}
                keyboardShouldPersistTaps="handled"
                nestedScrollEnabled
                showsVerticalScrollIndicator={visibleOptions.length * itemHeight > listMaxHeight}
                style={{
                  zIndex: 1,
                  maxHeight: listMaxHeight,
                }}
              >
                {visibleOptions.map((option) => (
                  <DropdownOptionRow
                    key={`${listId}-${option.value}`}
                    option={option}
                    selected={selectedValues.includes(option.value)}
                    onSelect={() => choose(option.value)}
                    preserveCase={preserveOptionCase}
                  />
                ))}
                {visibleOptions.length === 0 ? (
                  <AppText variant="caption" color="secondary" style={styles.emptyMessage}>
                    {emptyMessage}
                  </AppText>
                ) : null}
              </ScrollView>
              {menuFooter ? (
                <View style={[styles.menuFooter, { borderTopColor: theme.separator, zIndex: 1 }]}>
                  {menuFooter}
                </View>
              ) : null}
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
  optionCopy: {
    flex: 1,
    minWidth: 0,
    gap: 1,
  },
  searchWrap: {
    zIndex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  searchInput: {
    minWidth: 0,
    flex: 1,
    paddingVertical: 0,
  },
  emptyMessage: {
    minHeight: ITEM_HEIGHT,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  menuFooter: {
    gap: spacing.xs,
    padding: spacing.xs,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});
