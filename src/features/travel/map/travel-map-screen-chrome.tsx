import { FlashList, type ListRenderItem } from '@shopify/flash-list';
import { memo, useCallback, useMemo } from 'react';
import { Pressable, StyleSheet, View, type ModalProps } from 'react-native';
import Animated from 'react-native-reanimated';

import {
  AppText,
  Button,
  CollapsibleBody,
  GlassPlate,
  Symbol,
  appPrompt,
} from '@/components/primitives';
import { fadeEntering, fadeExiting, popoverEntering } from '@/design-system';
import type { ProfileAvatarMeta } from '@/features/account/profile-avatar-model';
import { ProfileAvatar } from '@/features/account/profile-avatar';
import { PeoplePicker } from '@/features/social/people-picker';
import { setTravelMapVisibility } from '@/services/travel/travel-map-collaboration';
import { useFriends } from '@/store/friends';
import { useResponsive } from '@/hooks/use-responsive';
import { useTheme } from '@/hooks/use-theme';
import { AgentUiIds, useAgentUiTarget } from '@/utils/agent-ui';

import type { TravelMapRenderedVisit } from './model';
import type { TravelMapPlaceSelection } from './travel-map-canvas';
import {
    travelMapOverlayConfirmIds,
    travelMapOverlayEmptyCopy,
    travelMapOverlayPickerState,
} from './travel-map-overlay-picker';
import { TravelMapPreviewCard } from './travel-map-preview-card';
import { TravelMapSharingRow } from './travel-map-sharing-row';
import type { TravelMapFriendLayer, TravelMapFriendProfile } from './types';

export type TravelMapCountryListCountry = {
  countryCode: string;
  countryName: string;
  pinCount: number;
  visitCount: number;
  contributors: Array<{
    userId: string;
    displayName: string;
    avatar?: ProfileAvatarMeta;
    color: string;
    isSelf: boolean;
    pinCount: number;
  }>;
};

const MAX_COUNTRY_LIST_CONTRIBUTORS = 4;

export function TravelMapCountryList({
  countries,
  expanded,
  selectedCountryCode,
  onSelectCountry,
}: {
  countries: TravelMapCountryListCountry[];
  expanded: boolean;
  selectedCountryCode?: string;
  onSelectCountry: (countryCode: string) => void;
}) {
  const { spacing } = useResponsive();
  const contentStyle = useMemo(
    () => ({ gap: spacing.xs, paddingBottom: spacing.sm }),
    [spacing.xs, spacing.sm],
  );
  const separatorStyle = useMemo(
    () => ({ height: spacing.xs }),
    [spacing.xs],
  );
  const renderSeparator = useCallback(
    () => <View style={separatorStyle} />,
    [separatorStyle],
  );
  const renderCountry = useCallback<ListRenderItem<TravelMapCountryListCountry>>(
    ({ item }) => (
      <TravelMapCountryListRow
        {...item}
        selected={item.countryCode === selectedCountryCode}
        onSelect={onSelectCountry}
      />
    ),
    [selectedCountryCode, onSelectCountry],
  );
  const cityCount = useMemo(
    () => countries.reduce((total, country) => total + country.pinCount, 0),
    [countries],
  );

  if (!countries.length) return null;

  const countryLabel = countries.length === 1 ? 'country' : 'countries';
  const cityLabel = cityCount === 1 ? 'city' : 'cities';
  return (
    <CollapsibleBody expanded={expanded} style={styles.countryListHost}>
      <View>
        <GlassPlate airy style={styles.countryListHostHeader}>
          <AppText variant="callout" style={styles.countryListTitle} fit>
            Visited Countries
          </AppText>
          <AppText variant="caption" color="secondary" numberOfLines={1}>
            {`${countries.length} ${countryLabel} · ${cityCount} ${cityLabel}`}
          </AppText>
        </GlassPlate>
        <View style={styles.countryListPlate}>
          <GlassPlate airy style={styles.countryListPlateContent}>
            <FlashList
              data={countries}
              keyExtractor={(item) => item.countryCode}
              renderItem={renderCountry}
              ItemSeparatorComponent={renderSeparator}
              showsVerticalScrollIndicator={false}
              estimatedItemSize={56}
              contentContainerStyle={contentStyle}
              style={styles.countryList}
              keyboardShouldPersistTaps="handled"
            />
          </GlassPlate>
        </View>
      </View>
    </CollapsibleBody>
  );
}

const TravelMapCountryListRow = memo(function TravelMapCountryListRow({
  countryCode,
  countryName,
  pinCount,
  visitCount,
  contributors,
  selected,
  onSelect,
}: TravelMapCountryListCountry & {
  selected?: boolean;
  onSelect: (countryCode: string) => void;
}) {
  const onPress = useCallback(() => onSelect(countryCode), [
    countryCode,
    onSelect,
  ]);
  const agent = useAgentUiTarget(AgentUiIds.travel.map.countryListItem(countryCode), {
    label: `${countryName}, open on globe`,
    onPress,
  });
  const visibleContributors = contributors.slice(0, MAX_COUNTRY_LIST_CONTRIBUTORS);
  const hiddenContributors = Math.max(
    0,
    contributors.length - visibleContributors.length,
  );
  const subtitle = `${visitCount} visit${visitCount === 1 ? '' : 's'} · ${pinCount} city${pinCount === 1 ? '' : 's'}`;
  const accessibilitySummary = useMemo(
    () =>
      contributors
        .map(
          (person) =>
            `${person.displayName}: ${person.pinCount} city${person.pinCount === 1 ? '' : 's'}`,
        )
        .concat(
          hiddenContributors > 0
            ? [`+${hiddenContributors} more contributor${hiddenContributors === 1 ? '' : 's'}`]
            : [],
        )
        .join(', '),
    [contributors, hiddenContributors],
  );

  return (
    <Pressable
      ref={agent.ref}
      testID={agent.testID}
      onLayout={agent.onLayout}
      accessibilityRole="button"
      accessibilityLabel={`${countryName}, ${subtitle} ${accessibilitySummary}`}
      accessibilityState={{ selected }}
      onPress={onPress}
    >
      <GlassPlate
        airy
        style={[styles.countryListRow, selected && styles.countryListRowSelected]}
      >
        <View style={styles.countryListRowContent}>
          <View style={styles.countryListText}>
            <AppText
              variant="callout"
              style={styles.countryListName}
              fit
              numberOfLines={1}
            >
              {countryName}
            </AppText>
            <AppText
              variant="caption"
              color="secondary"
              style={styles.countryListSub}
              numberOfLines={1}
            >
              {subtitle}
            </AppText>
          </View>
          <View style={styles.countryListAvatarStack}>
            {visibleContributors.map((person, index) => (
              <View key={person.userId} style={[styles.countryListAvatarWrap, index > 0 && { marginLeft: -8 }]}>
                <ProfileAvatar
                  size={20}
                  borderWidth={2}
                  borderColor={person.color}
                  displayName={person.displayName}
                  userId={person.userId}
                  avatar={person.avatar}
                  isSelf={person.isSelf}
                  accessibilityLabel={`${person.displayName}, ${person.pinCount} city${person.pinCount === 1 ? '' : 's'}`}
                />
              </View>
            ))}
            {hiddenContributors > 0 ? (
                <View style={[styles.countryListAvatarWrap, { marginLeft: -8 }]}>
                <View style={styles.countryListAvatarMore} accessibilityRole="text">
                  <AppText variant="caption" numberOfLines={1}>
                    +{hiddenContributors}
                  </AppText>
                </View>
              </View>
            ) : null}
          </View>
        </View>
      </GlassPlate>
    </Pressable>
  );
});

export function TravelMapPeoplePicker({
  visible,
  authenticated,
  shareWithFriends,
  friendProfiles,
  selectedFriendIds,
  supportedOrientations,
  onClose,
  onChangeSelectedFriendIds,
}: {
  visible: boolean;
  authenticated: boolean;
  shareWithFriends: boolean;
  friendProfiles: TravelMapFriendProfile[];
  selectedFriendIds: string[];
  supportedOrientations: ModalProps['supportedOrientations'];
  onClose: () => void;
  onChangeSelectedFriendIds: (ids: string[]) => void;
}) {
  const friends = useFriends((state) => state.friends);
  const sharingUserIds = friendProfiles.map((profile) => profile.userId);
  const { includeIds, excludeIds, showSearch, emptyKind } =
    travelMapOverlayPickerState({
      friends,
      sharingUserIds,
      selectedFriendIds,
    });

  return (
    <PeoplePicker
      visible={visible}
      onClose={onClose}
      eyebrow="Travel Atlas"
      title="Overlay Friend Maps"
      subtitle="Friends who share their map"
      subtitleIcon="people"
      confirmLabel="Show Maps"
      headerContent={
        <TravelMapSharingRow
          enabled={shareWithFriends}
          disabled={!authenticated}
          onPress={() => {
            if (!authenticated) {
              appPrompt.alert(
                'Sign in to share',
                'Your own pins still work offline. Sign in to share this map with accepted friends.',
              );
              return;
            }
            void setTravelMapVisibility(!shareWithFriends).catch((error) => {
              appPrompt.alert(
                'Map sharing',
                error instanceof Error
                  ? error.message
                  : 'Sharing could not be updated.',
              );
            });
          }}
        />
      }
      supportedOrientations={supportedOrientations}
      includeIds={includeIds}
      excludeIds={excludeIds}
      showSearch={showSearch}
      emptyState={
        emptyKind ? travelMapOverlayEmptyCopy(emptyKind) : undefined
      }
      emptySearchState={travelMapOverlayEmptyCopy('no-search-match')}
      emptyTestID={AgentUiIds.travel.map.overlayEmpty}
      onConfirm={(picked) => {
        onChangeSelectedFriendIds(
          travelMapOverlayConfirmIds(
            picked.map((friend) => friend.userId),
            sharingUserIds,
            selectedFriendIds,
          ),
        );
      }}
    />
  );
}

export function TravelMapSelectionPreview({
  selection,
  landscape,
  bottomInset,
  onClose,
  onUnpin,
  onOpenTrip,
}: {
  selection: TravelMapPlaceSelection;
  landscape: boolean;
  bottomInset: number;
  onClose: () => void;
  onUnpin?: () => void;
  onOpenTrip?: () => void;
}) {
  return (
    <Animated.View
      entering={popoverEntering()}
      exiting={fadeExiting()}
      style={
        landscape
          ? styles.previewRail
          : [styles.previewBottom, { bottom: Math.max(14, bottomInset + 8) }]
      }
    >
      <TravelMapPreviewCard
        landscape={landscape}
        selection={selection}
        onClose={onClose}
        onUnpin={onUnpin}
        onOpenTrip={onOpenTrip}
      />
    </Animated.View>
  );
}

export function TravelMapLayerControls({
  self,
  friendLayers,
  selectedFriendIds,
  onChangeSelectedFriendIds,
  onOpenPeoplePicker,
}: {
  self: TravelMapRenderedVisit['person'];
  friendLayers: TravelMapFriendLayer[];
  selectedFriendIds: string[];
  onChangeSelectedFriendIds: (ids: string[]) => void;
  onOpenPeoplePicker: () => void;
}) {
  return (
    <View style={styles.layerRow}>
      <GlassPlate intensity={65} style={styles.peoplePlate}>
        <TravelMapPersonChip person={self} />
        {friendLayers.map((layer) => (
          <TravelMapPersonChip
            key={layer.person.userId}
            person={layer.person}
            onPress={() =>
              onChangeSelectedFriendIds(
                selectedFriendIds.filter((id) => id !== layer.person.userId),
              )
            }
          />
        ))}
        <TravelMapIconButton
          compact
          testID={AgentUiIds.travel.map.people}
          label="Choose friend maps"
          icon="people"
          onPress={onOpenPeoplePicker}
        />
      </GlassPlate>
    </View>
  );
}

export function TravelMapSuggestionCard({
  title,
  locationLabel,
  landscape,
  bottom,
  onSkip,
  onConfirm,
}: {
  title: string;
  locationLabel: string;
  landscape: boolean;
  bottom: number;
  onSkip: () => void;
  onConfirm: () => void;
}) {
  return (
    <Animated.View
      entering={popoverEntering()}
      exiting={fadeExiting()}
      style={[
        styles.suggestionHost,
        landscape
          ? [styles.suggestionLandscape, { bottom }]
          : styles.suggestionPortrait,
      ]}
    >
      <GlassPlate intensity={76} style={styles.suggestion}>
        <View style={styles.suggestionCopy}>
          <AppText variant="callout" numberOfLines={1}>
            Pin {title}?
          </AppText>
          <AppText variant="caption" color="secondary" numberOfLines={1}>
            {locationLabel}
          </AppText>
        </View>
        <Button
          size="sm"
          variant="secondary"
          testID={AgentUiIds.travel.map.suggestionSkip}
          onPress={onSkip}
        >
          Skip
        </Button>
        <Button
          size="sm"
          testID={AgentUiIds.travel.map.suggestionConfirm}
          onPress={onConfirm}
        >
          Review & Pin
        </Button>
      </GlassPlate>
    </Animated.View>
  );
}

export function TravelMapIconButton({
  testID,
  label,
  icon,
  onPress,
  compact,
  selected,
  dimWhenInactive,
}: {
  testID: string;
  label: string;
  icon:
    | 'chevron-left'
    | 'close'
    | 'search'
    | 'people'
    | 'list'
    | 'tip';
  onPress: () => void;
  compact?: boolean;
  selected?: boolean;
  dimWhenInactive?: boolean;
}) {
  const theme = useTheme();
  const agent = useAgentUiTarget(testID, { label, onPress });
  const size = compact ? 36 : 46;
  const isSelected = Boolean(selected);
  const isDimmed = Boolean(dimWhenInactive && !isSelected);
  return (
    <Pressable
      ref={agent.ref}
      testID={agent.testID}
      onLayout={agent.onLayout}
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [
        pressed ? styles.iconButtonPressed : undefined,
        isDimmed ? styles.iconButtonDimmed : undefined,
      ]}
    >
      <GlassPlate
        intensity={isSelected || !isDimmed ? 70 : 58}
        style={[
          styles.iconButton,
          { width: size, height: size, borderRadius: size / 2 },
        ]}
      >
        <Symbol
          name={icon}
          size={compact ? 18 : 21}
          color={
            isSelected
              ? theme.accentPrimary
              : isDimmed
                ? theme.textTertiary
                : theme.textPrimary
          }
        />
      </GlassPlate>
    </Pressable>
  );
}

function TravelMapPersonChip({
  person,
  onPress,
}: {
  person: TravelMapRenderedVisit['person'];
  onPress?: () => void;
}) {
  const agent = useAgentUiTarget(AgentUiIds.travel.map.person(person.userId), {
    label: `${person.displayName} map layer${onPress ? ', double tap to remove' : ''}`,
    onPress,
  });
  const avatar = (
    <ProfileAvatar
      displayName={person.displayName}
      userId={person.userId}
      avatar={person.avatar}
      isSelf={person.isSelf}
      size={34}
      borderColor={person.color}
      borderWidth={3}
      accessibilityLabel={`${person.displayName}, ${person.color} map pins`}
    />
  );
  if (!onPress)
    return (
      <View accessibilityLabel={`${person.displayName} map layer`}>
        {avatar}
      </View>
    );
  return (
    <Pressable
      ref={agent.ref}
      testID={agent.testID}
      onLayout={agent.onLayout}
      accessibilityRole="button"
      accessibilityLabel={`${person.displayName} map layer, double tap to remove`}
      onPress={onPress}
      style={({ pressed }) => (pressed ? styles.chipPressed : undefined)}
    >
      {avatar}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  layerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  peoplePlate: {
    minHeight: 46,
    borderRadius: 23,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 6,
  },
  iconButton: { alignItems: 'center', justifyContent: 'center' },
  iconButtonDimmed: { opacity: 0.56 },
  iconButtonPressed: { opacity: 0.72, transform: [{ scale: 0.94 }] },
  chipPressed: { opacity: 0.72 },
  suggestionHost: {
    position: 'absolute',
    left: 14,
    right: 14,
  },
  suggestion: {
    borderRadius: 22,
    padding: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  suggestionPortrait: { top: 116 },
  suggestionLandscape: { right: 318 },
  suggestionCopy: { flex: 1, minWidth: 0 },
  previewBottom: { position: 'absolute', left: 12, right: 12 },
  previewRail: {
    position: 'absolute',
    top: 10,
    right: 10,
    bottom: 10,
    width: 292,
  },
  countryListHost: { gap: 6, overflow: 'hidden' },
  countryListHostHeader: {
    minHeight: 48,
    borderRadius: 22,
    paddingHorizontal: 14,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  countryListTitle: { flex: 1, minWidth: 0, gap: 2 },
  countryList: { maxHeight: 220 },
  countryListPlate: {
    overflow: 'hidden',
  },
  countryListPlateContent: {
    borderRadius: 16,
    paddingHorizontal: 6,
    paddingTop: 4,
  },
  countryListRow: {
    minHeight: 52,
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 8,
    flexDirection: 'row',
    gap: 4,
  },
  countryListRowSelected: {
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.4)',
  },
  countryListRowContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 10,
    minWidth: 0,
  },
  countryListText: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  countryListSub: { flexShrink: 1, minWidth: 0 },
  countryListName: { flexShrink: 1, minWidth: 0 },
  countryListAvatarStack: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  countryListAvatarWrap: {
    borderRadius: 999,
  },
  countryListAvatarMore: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.45)',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
});
