import { useRef } from 'react';
import {
    Keyboard,
    Pressable,
    StyleSheet,
    Text,
    TextInput,
    View,
} from 'react-native';

import { Symbol } from '@/components/primitives';
import { TravelHomeGlass } from '@/features/travel/travel-home-glass';
import {
    travelHomeFontFamily,
    travelHomeTokens,
} from '@/features/travel/travel-home-tokens';
import { useResponsive } from '@/hooks/use-responsive';
import { useTheme } from '@/hooks/use-theme';
import { AgentUiIds, useAgentUiTarget } from '@/utils/agent-ui';

type TravelHomeSectionHeaderProps = {
  /** Placeholder when search is shown; visible title when search is omitted. */
  title: string;
  count?: number;
  searchQuery?: string;
  onSearchQueryChange?: (query: string) => void;
};

/**
 * Full-width “Your Trips” search field — stays open; never collapses to a chip.
 */
export function TravelHomeSectionHeader({
  title,
  count,
  searchQuery = '',
  onSearchQueryChange,
}: TravelHomeSectionHeaderProps) {
  const theme = useTheme();
  const { s, spacing: rs } = useResponsive();
  const inputRef = useRef<TextInput>(null);
  const hasQuery = Boolean(searchQuery.trim());
  const dark = theme.name === 'dark';
  // Theme-native glass: light frost in light mode, dark frost in dark.
  const plateInk = dark ? '#FFFFFF' : travelHomeTokens.colors.ink;
  const fieldInk = plateInk;
  const fieldMuted = dark
    ? 'rgba(255,255,255,0.88)'
    : travelHomeTokens.colors.inkMuted;
  const titleSize = Math.max(18, s(travelHomeTokens.sizes.sectionTitle));
  const searchTextSize = Math.max(15, s(travelHomeTokens.sizes.searchFieldText));
  const showCount = count !== undefined && count > 0;
  const circle = Math.max(22, s(travelHomeTokens.sizes.countCircle));
  const tripsWord = count === 1 ? 'trip' : 'trips';
  const padX = Math.max(12, rs.sm);
  const padY = Math.max(8, s(8));
  const radius = Math.max(14, s(16));
  const fieldHeight = Math.max(36, s(38));
  const searchIconSize = Math.max(14, Math.round(searchTextSize * 0.92));
  const scoopPadL = Math.max(10, s(10));
  const scoopPadR = Math.max(8, s(8));
  const scoopGap = s(6);
  const iconHitW = Math.max(
    travelHomeTokens.sizes.touchTargetMin - 12,
    searchIconSize + s(8),
  );
  const iconHitH = Math.max(
    travelHomeTokens.sizes.touchTargetMin - 12,
    fieldHeight - s(4),
  );
  const iconToTitleGap =
    Math.round((iconHitW - searchIconSize) / 2) + scoopGap;
  const showSearch = typeof onSearchQueryChange === 'function';

  const searchAgent = useAgentUiTarget(AgentUiIds.travel.list.search, {
    label: title,
    value: searchQuery,
  });
  const clearAgent = useAgentUiTarget(
    showSearch && hasQuery ? AgentUiIds.travel.list.searchClear : undefined,
    {
      label: 'Clear trip search',
      onPress: () => onSearchQueryChange?.(''),
    },
  );

  const renderCountBadge = () =>
    showCount ? (
      <TravelHomeGlass
        inverted
        intensity={dark ? 56 : 44}
        accessibilityRole="text"
        accessibilityLabel={`${count} ${tripsWord}`}
        style={[
          styles.badge,
          {
            width: circle,
            height: circle,
            borderRadius: circle / 2,
          },
        ]}>
        <Text
          allowFontScaling
          maxFontSizeMultiplier={1.1}
          numberOfLines={1}
          style={{
            // `inverted` is always a dark plate — white ink on every theme.
            color: '#FFFFFF',
            fontSize: Math.max(11, s(12)),
            fontWeight: '400',
            fontFamily: travelHomeFontFamily,
          }}>
          {count}
        </Text>
      </TravelHomeGlass>
    ) : null;

  const plateStyle = {
    borderRadius: radius,
    paddingHorizontal: padX,
    paddingVertical: padY,
    minHeight: Math.max(40, s(40)),
    gap: s(8),
  };

  const scoopStyle = {
    height: fieldHeight,
    borderRadius: fieldHeight / 2,
    paddingLeft: scoopPadL,
    paddingRight: scoopPadR,
    gap: scoopGap,
  };

  const titleTextStyle = {
    color: fieldMuted,
    fontFamily: travelHomeFontFamily,
    fontSize: searchTextSize,
    lineHeight: Math.round(searchTextSize * 1.2),
    fontWeight: '400' as const,
    letterSpacing: -0.2,
  };

  if (!showSearch) {
    return (
      <TravelHomeGlass
        intensity={dark ? 48 : 44}
        style={[
          styles.plate,
          plateStyle,
          {
            alignSelf: 'stretch',
            width: '100%',
          },
        ]}>
        <Text
          allowFontScaling
          maxFontSizeMultiplier={1.15}
          numberOfLines={1}
          style={{
            flex: 1,
            flexShrink: 1,
            minWidth: 0,
            color: plateInk,
            fontFamily: travelHomeFontFamily,
            fontSize: titleSize,
            lineHeight: titleSize * 1.15,
            fontWeight: '400',
            letterSpacing: -0.3,
          }}>
          {title}
        </Text>
        {renderCountBadge()}
      </TravelHomeGlass>
    );
  }

  return (
    <View style={styles.track}>
      <TravelHomeGlass
        intensity={dark ? 36 : 52}
        style={[styles.search, scoopStyle, styles.searchFill]}>
        <View
          pointerEvents="none"
          style={{
            width: iconHitW,
            height: iconHitH,
            alignItems: 'center',
            justifyContent: 'center',
          }}>
          <Symbol name="search" size={searchIconSize} color={fieldMuted} />
        </View>

        <TextInput
          ref={(node) => {
            inputRef.current = node;
            searchAgent.ref(node as never);
          }}
          testID={searchAgent.testID}
          onLayout={searchAgent.onLayout}
          value={searchQuery}
          onChangeText={onSearchQueryChange}
          placeholder={title}
          placeholderTextColor={fieldMuted}
          accessibilityLabel={title}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
          clearButtonMode="never"
          underlineColorAndroid="transparent"
          onSubmitEditing={() => Keyboard.dismiss()}
          style={[
            titleTextStyle,
            {
              flex: 1,
              flexShrink: 1,
              minWidth: 0,
              paddingVertical: 0,
              color: fieldInk,
            },
          ]}
        />

        {hasQuery ? (
          <Pressable
            ref={clearAgent.ref as never}
            testID={clearAgent.testID}
            onLayout={clearAgent.onLayout}
            accessibilityRole="button"
            accessibilityLabel="Clear trip search"
            hitSlop={8}
            onPress={() => {
              onSearchQueryChange?.('');
              requestAnimationFrame(() => {
                inputRef.current?.focus();
              });
            }}
            style={{
              width: Math.max(22, s(22)),
              height: Math.max(22, s(22)),
              alignItems: 'center',
              justifyContent: 'center',
            }}>
            <Symbol
              name="close"
              size={Math.max(12, s(13))}
              color={fieldMuted}
            />
          </Pressable>
        ) : null}
        {showCount ? (
          <View style={{ marginLeft: iconToTitleGap - scoopGap }}>
            {renderCountBadge()}
          </View>
        ) : null}
      </TravelHomeGlass>
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    width: '100%',
    alignSelf: 'stretch',
  },
  plate: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  searchFill: {
    width: '100%',
  },
  badge: {
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
});
