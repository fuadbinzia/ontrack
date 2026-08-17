import { Pressable, StyleSheet, View, type ModalProps } from 'react-native';
import Animated from 'react-native-reanimated';

import {
    AppText,
    Button,
    GlassPlate,
    Symbol,
    appPrompt,
} from '@/components/primitives';
import { fadeExiting, popoverEntering } from '@/design-system';
import { ProfileAvatar } from '@/features/account/profile-avatar';
import { PeoplePicker } from '@/features/social/people-picker';
import { setTravelMapVisibility } from '@/services/travel/travel-map-collaboration';
import { useFriends } from '@/store/friends';
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
}: {
  testID: string;
  label: string;
  icon: 'chevron-left' | 'close' | 'search' | 'people';
  onPress: () => void;
  compact?: boolean;
}) {
  const agent = useAgentUiTarget(testID, { label, onPress });
  const size = compact ? 36 : 46;
  return (
    <Pressable
      ref={agent.ref}
      testID={agent.testID}
      onLayout={agent.onLayout}
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => (pressed ? styles.iconButtonPressed : undefined)}
    >
      <GlassPlate
        intensity={70}
        style={[
          styles.iconButton,
          { width: size, height: size, borderRadius: size / 2 },
        ]}
      >
        <Symbol name={icon} size={compact ? 18 : 21} />
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
});
