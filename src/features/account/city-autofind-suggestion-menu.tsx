import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import Animated, { FadeInDown, FadeOutUp, ReduceMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/primitives';
import {
  placeDropdownMenu,
  type DropdownAnchor,
} from '@/components/primitives/dropdown-layout';
import { GlassPlate } from '@/components/primitives/glass-plate';
import { motion, radii, shadows, spacing } from '@/design-system';
import { useResponsive } from '@/hooks/use-responsive';
import { useTheme } from '@/hooks/use-theme';
import { type CitySuggestion } from '@/utils/city-lookup';
import { AgentUiIds, useAgentUiTarget } from '@/utils/agent-ui';

const SUGGESTION_ROW_HEIGHT = 48;
const MENU_MAX_HEIGHT = 260;
const MENU_PADDING = spacing.xs;

type CityAutofindSuggestionMenuProps = {
  label: string;
  testID: string;
  listId: string;
  suggestions: CitySuggestion[];
  open: boolean;
  anchor: DropdownAnchor | undefined;
  onDismiss: () => void;
  onSelect: (suggestion: CitySuggestion) => void;
};

export function CityAutofindSuggestionMenu({
  label,
  testID,
  listId,
  suggestions,
  open,
  anchor,
  onDismiss,
  onSelect,
}: CityAutofindSuggestionMenuProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const { spacing: rs, s } = useResponsive();

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
  const dismissTestID = AgentUiIds.profile.locationSuggestionsDismiss(testID);
  const dismissAgent = useAgentUiTarget(dismissTestID, {
    label: 'Dismiss city suggestions',
    onPress: onDismiss,
  });

  return (
    <Modal
      animationType="fade"
      onRequestClose={onDismiss}
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
          onPress={onDismiss}
          style={StyleSheet.absoluteFill}
        />
        {placement ? (
          <Animated.View
            accessibilityLabel={`${label} suggestions`}
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
            <GlassPlate
              intensity={theme.name === 'dark' ? 40 : 48}
              style={[styles.menuGlass, { maxHeight: placement.maxHeight }]}>
              <ScrollView
                bounces={contentHeight > MENU_MAX_HEIGHT}
                keyboardShouldPersistTaps="handled"
                nestedScrollEnabled
                showsVerticalScrollIndicator={contentHeight > MENU_MAX_HEIGHT}
                style={{ maxHeight: placement.maxHeight - MENU_PADDING * 2 }}>
                {suggestions.map((suggestion, index) => {
                  const rowTestID = AgentUiIds.profile.locationSuggestion(
                    testID,
                    index,
                  );
                  return (
                    <SuggestionRow
                      key={`${listId}-${suggestion.id}`}
                      suggestion={suggestion}
                      index={index}
                      testID={rowTestID}
                      onSelect={() => onSelect(suggestion)}
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
                  );
                })}
              </ScrollView>
            </GlassPlate>
          </Animated.View>
        ) : null}
      </View>
    </Modal>
  );
}

function SuggestionRow({
  suggestion,
  index,
  testID,
  onSelect,
  separatorColor,
  pressedBackground,
  minHeight,
  paddingHorizontal,
  paddingVertical,
}: {
  suggestion: CitySuggestion;
  index: number;
  testID: string;
  onSelect: () => void;
  separatorColor: string;
  pressedBackground: string;
  minHeight: number;
  paddingHorizontal: number;
  paddingVertical: number;
}) {
  const agent = useAgentUiTarget(testID, {
    label: `Use city ${suggestion.label}`,
    onPress: onSelect,
  });

  return (
    <Pressable
      ref={agent.ref}
      onLayout={agent.onLayout}
      testID={agent.testID}
      accessibilityRole="button"
      accessibilityLabel={`Use city ${suggestion.label}`}
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
      <AppText variant="body" numberOfLines={2} style={styles.suggestionText}>
        {suggestion.label}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
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
  },
});
