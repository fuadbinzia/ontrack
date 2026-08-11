import { useEffect, useId, useRef, useState } from 'react';
import {
  Keyboard,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import Animated, { FadeInDown, FadeOutUp, ReduceMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText, Input, LoadingSpinner } from '@/components/primitives';
import {
  placeDropdownMenu,
  type DropdownAnchor,
} from '@/components/primitives/dropdown-layout';
import { motion, radii, shadows, spacing, type AppIconName } from '@/design-system';
import { TravelHomeGlass } from '@/features/travel/travel-home-glass';
import { useResponsive } from '@/hooks/use-responsive';
import { useTheme } from '@/hooks/use-theme';
import { AgentUiIds, useAgentUiTarget } from '@/utils/agent-ui';

import {
  ADDRESS_LOOKUP_MIN_QUERY,
  searchAddresses,
  type AddressSuggestion,
} from './address-lookup';

const ADDRESS_MAX_LENGTH = 240;
const DEBOUNCE_MS = 320;
const SUGGESTION_ROW_HEIGHT = 52;
const MENU_MAX_HEIGHT = 280;
const MENU_PADDING = spacing.xs;

interface AddressAutofindFieldProps {
  value: string;
  onChange: (value: string) => void;
  onSuggestionSelect?: (suggestion: AddressSuggestion) => void;
  testID?: string;
  placeholder?: string;
  stackedLabel?: string;
  icon?: AppIconName;
  iconBackground?: string;
  iconColor?: string;
  fieldBackground?: string;
  fieldBorderColor?: string;
  fieldBorderRadius?: number;
  stackedLabelColor?: string;
  placeholderTextColor?: string;
  accessibilityLabel?: string;
}

function approxHeightForText(text: string, minHeight: number, lineHeight: number): number {
  if (!text) return minHeight;
  const approxLines = Math.max(1, Math.ceil(text.length / 28));
  return Math.max(minHeight, approxLines * lineHeight);
}

/**
 * Address / place field with Photon suggestions.
 * Suggestion menu uses the shared Dropdown overlay contract: transparent Modal +
 * tap-outside backdrop dismiss (inline lists never receive outside presses in sheets).
 */
export function AddressAutofindField({
  value,
  onChange,
  onSuggestionSelect,
  testID,
  placeholder = 'Address',
  stackedLabel,
  icon = 'location',
  iconBackground,
  iconColor,
  fieldBackground,
  fieldBorderColor,
  fieldBorderRadius,
  stackedLabelColor,
  placeholderTextColor,
  accessibilityLabel = 'Address, optional',
}: AddressAutofindFieldProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const { s, spacing: rs } = useResponsive();
  const listId = useId();
  const fieldRef = useRef<View>(null);
  const minHeight = Math.max(stackedLabel ? 56 : 44, s(stackedLabel ? 60 : 48));
  const lineHeight = Math.max(22, s(24));
  const [height, setHeight] = useState(() => approxHeightForText(value, minHeight, lineHeight));
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [anchor, setAnchor] = useState<DropdownAnchor>();
  const requestIdRef = useRef(0);
  /** Invalidates in-flight measureInWindow → setOpen(true) after dismiss. */
  const openGenerationRef = useRef(0);
  /** After tap-outside, stay closed until the user types again. */
  const suppressUntilTypedRef = useRef(false);
  /** Last value we pushed via typing or suggestion pick. */
  const lastLocalValueRef = useRef(value);
  /** True only for the next value effect caused by onChangeText. */
  const userTypedRef = useRef(false);

  const clearSuggestions = () => {
    requestIdRef.current += 1;
    openGenerationRef.current += 1;
    setSuggestions([]);
    setOpen(false);
    setAnchor(undefined);
    setLoading(false);
  };

  const dismissMenu = () => {
    // Cancel debounce/search + any pending measure callback so the menu cannot
    // pop back open for the same field value.
    requestIdRef.current += 1;
    openGenerationRef.current += 1;
    suppressUntilTypedRef.current = true;
    setOpen(false);
    setAnchor(undefined);
    setLoading(false);
    Keyboard.dismiss();
  };

  const measureAndOpen = () => {
    if (suppressUntilTypedRef.current) return;
    const generation = ++openGenerationRef.current;
    fieldRef.current?.measureInWindow((x, y, width, measuredHeight) => {
      if (generation !== openGenerationRef.current) return;
      if (suppressUntilTypedRef.current) return;
      if (width <= 0 || measuredHeight <= 0) return;
      setAnchor({ x, y, width, height: measuredHeight });
      setOpen(true);
    });
  };

  useEffect(() => {
    const fromUserTyping = userTypedRef.current;
    userTypedRef.current = false;

    // Parent/import changed the value out from under us — keep it, no suggestions.
    // (onChangeText always syncs lastLocalValueRef first, so a mismatch means external.)
    if (value !== lastLocalValueRef.current) {
      lastLocalValueRef.current = value;
      suppressUntilTypedRef.current = false;
      clearSuggestions();
      setHeight(approxHeightForText(value, minHeight, lineHeight));
      return;
    }

    if (!fromUserTyping) {
      // Keep a tap-outside dismiss stable — don't wipe suggestions or reopen.
      if (suppressUntilTypedRef.current) return;
      clearSuggestions();
      return;
    }

    const query = value.trim();
    if (query.length < ADDRESS_LOOKUP_MIN_QUERY) {
      clearSuggestions();
      return;
    }

    const requestId = ++requestIdRef.current;
    setLoading(true);
    const timer = setTimeout(() => {
      void searchAddresses(query).then((results) => {
        if (requestId !== requestIdRef.current) return;
        if (suppressUntilTypedRef.current) return;
        setSuggestions(results);
        setLoading(false);
        if (results.length > 0) {
          measureAndOpen();
        } else {
          setOpen(false);
          setAnchor(undefined);
        }
      });
    }, DEBOUNCE_MS);

    return () => {
      clearTimeout(timer);
      if (requestId === requestIdRef.current) setLoading(false);
    };
  }, [value, minHeight, lineHeight]);

  useEffect(() => {
    if (!open) {
      setAnchor(undefined);
      return;
    }
    if (anchor) return;
    const generation = openGenerationRef.current;
    fieldRef.current?.measureInWindow((x, y, width, measuredHeight) => {
      if (generation !== openGenerationRef.current) return;
      if (suppressUntilTypedRef.current) return;
      if (width <= 0 || measuredHeight <= 0) return;
      setAnchor({ x, y, width, height: measuredHeight });
    });
  }, [open, anchor]);

  const applySuggestion = (suggestion: AddressSuggestion) => {
    const next = [suggestion.label, suggestion.secondary]
      .filter(Boolean)
      .join(', ')
      .slice(0, ADDRESS_MAX_LENGTH);
    lastLocalValueRef.current = next;
    userTypedRef.current = false;
    suppressUntilTypedRef.current = false;
    clearSuggestions();
    setHeight(approxHeightForText(next, minHeight, lineHeight));
    onChange(next);
    onSuggestionSelect?.(suggestion);
    Keyboard.dismiss();
  };

  const expanding = value.trim().length > 36 || height > minHeight + 4;
  const contentHeight =
    suggestions.length * Math.max(SUGGESTION_ROW_HEIGHT, s(48)) + MENU_PADDING * 2;
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
      menuMaxHeight: MENU_MAX_HEIGHT,
      gutter: spacing.md,
      gap: spacing.xs,
      matchTriggerWidth: true,
    });

  const menuVisible = Boolean(open && suggestions.length > 0 && anchor && placement);
  const dismissTestID = testID
    ? AgentUiIds.travel.addressSuggestionsDismiss(testID)
    : undefined;
  const dismissAgent = useAgentUiTarget(dismissTestID, {
    label: 'Dismiss address suggestions',
    onPress: dismissMenu,
  });

  return (
    <View ref={fieldRef} collapsable={false} style={styles.wrap}>
      <Input
        testID={testID}
        value={value}
        placeholder={placeholder}
        accessibilityLabel={accessibilityLabel}
        icon={icon}
        stackedLabel={stackedLabel}
        iconBackground={iconBackground}
        iconColor={iconColor}
        fieldBackground={fieldBackground}
        fieldBorderColor={fieldBorderColor}
        fieldBorderRadius={fieldBorderRadius}
        stackedLabelColor={stackedLabelColor}
        placeholderTextColor={placeholderTextColor}
        multiline={expanding}
        scrollEnabled={false}
        maxLength={ADDRESS_MAX_LENGTH}
        textAlignVertical={expanding ? 'top' : 'center'}
        autoCorrect={false}
        autoCapitalize="words"
        returnKeyType="search"
        onChangeText={(next) => {
          const clipped = next.slice(0, ADDRESS_MAX_LENGTH);
          if (!clipped) setHeight(minHeight);
          // Typing is the only signal that may reopen after tap-outside.
          suppressUntilTypedRef.current = false;
          userTypedRef.current = true;
          lastLocalValueRef.current = clipped;
          onChange(clipped);
        }}
        onSubmitEditing={dismissMenu}
        onContentSizeChange={(event) => {
          if (!value.trim()) {
            setHeight(minHeight);
            return;
          }
          const next = Math.ceil(event.nativeEvent.contentSize.height);
          // Cap growth so flex layout can't feed a runaway height loop.
          const measured = Math.min(Math.max(minHeight, next), minHeight + lineHeight * 8);
          setHeight((current) => (measured === current ? current : measured));
        }}
        style={{
          ...(expanding ? { minHeight: Math.max(minHeight, height) } : null),
          paddingRight: loading ? s(44) : undefined,
        }}
        trailing={
          loading ? (
            <LoadingSpinner size={s(18)} color={theme.textTertiary} />
          ) : undefined
        }
      />

      <Modal
        animationType="fade"
        onRequestClose={dismissMenu}
        presentationStyle="overFullScreen"
        statusBarTranslucent
        transparent
        visible={menuVisible}>
        <View style={styles.modalRoot}>
          <Pressable
            ref={dismissAgent.ref}
            onLayout={dismissAgent.onLayout}
            testID={dismissAgent.testID}
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            onPress={dismissMenu}
            style={StyleSheet.absoluteFill}
          />
          {placement ? (
            <Animated.View
              accessibilityLabel={`${stackedLabel ?? accessibilityLabel} suggestions`}
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
                },
              ]}>
              <TravelHomeGlass
                intensity={theme.name === 'dark' ? 40 : 48}
                style={[
                  styles.menuGlass,
                  { maxHeight: placement.maxHeight },
                ]}>
                <ScrollView
                  bounces={contentHeight > MENU_MAX_HEIGHT}
                  keyboardShouldPersistTaps="handled"
                  nestedScrollEnabled
                  showsVerticalScrollIndicator={contentHeight > MENU_MAX_HEIGHT}
                  style={{ maxHeight: placement.maxHeight - MENU_PADDING * 2 }}>
                  {suggestions.map((suggestion, index) => (
                    <SuggestionRow
                      key={`${listId}-${suggestion.id}`}
                      suggestion={suggestion}
                      index={index}
                      fieldTestID={testID}
                      onSelect={() => applySuggestion(suggestion)}
                      separatorColor={
                        theme.name === 'dark'
                          ? 'rgba(255,255,255,0.14)'
                          : 'rgba(17,74,110,0.12)'
                      }
                      pressedBackground={
                        theme.name === 'dark'
                          ? 'rgba(255,255,255,0.08)'
                          : 'rgba(255,255,255,0.45)'
                      }
                      minHeight={Math.max(44, s(48))}
                      paddingHorizontal={rs.lg}
                      paddingVertical={rs.sm}
                    />
                  ))}
                </ScrollView>
              </TravelHomeGlass>
            </Animated.View>
          ) : null}
        </View>
      </Modal>
    </View>
  );
}

function SuggestionRow({
  suggestion,
  index,
  fieldTestID,
  onSelect,
  separatorColor,
  pressedBackground,
  minHeight,
  paddingHorizontal,
  paddingVertical,
}: {
  suggestion: AddressSuggestion;
  index: number;
  fieldTestID?: string;
  onSelect: () => void;
  separatorColor: string;
  pressedBackground: string;
  minHeight: number;
  paddingHorizontal: number;
  paddingVertical: number;
}) {
  const rowTestID = fieldTestID
    ? AgentUiIds.travel.addressSuggestion(fieldTestID, index)
    : undefined;
  const agent = useAgentUiTarget(rowTestID, {
    label: `Use address ${suggestion.label}`,
    onPress: onSelect,
  });

  return (
    <Pressable
      ref={agent.ref}
      onLayout={agent.onLayout}
      testID={agent.testID}
      accessibilityRole="button"
      accessibilityLabel={`Use address ${suggestion.label}`}
      onPress={onSelect}
      style={({ pressed }) => [
        styles.suggestionRow,
        {
          minHeight,
          paddingHorizontal,
          paddingVertical,
          borderTopWidth: index === 0 ? 0 : StyleSheet.hairlineWidth,
          borderTopColor: separatorColor,
          backgroundColor: pressed ? pressedBackground : undefined,
        },
      ]}>
      <View style={styles.suggestionText}>
        <AppText variant="body" numberOfLines={2}>
          {suggestion.label}
        </AppText>
        {suggestion.secondary ? (
          <AppText variant="caption" color="secondary" numberOfLines={1} fit>
            {suggestion.secondary}
          </AppText>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    zIndex: 2,
  },
  modalRoot: {
    flex: 1,
  },
  menu: {
    position: 'absolute',
    overflow: 'hidden',
    borderRadius: radii.lg,
    borderCurve: 'continuous',
  },
  menuGlass: {
    overflow: 'hidden',
    borderRadius: radii.lg,
    borderCurve: 'continuous',
    paddingVertical: MENU_PADDING,
  },
  suggestionRow: {
    justifyContent: 'center',
  },
  suggestionText: {
    flexShrink: 1,
    minWidth: 0,
    gap: 2,
  },
});
