import { Pressable, StyleSheet, View, type ModalProps } from 'react-native';

import {
  AppText,
  Button,
  GlassPlate,
  Symbol,
  appPrompt,
} from '@/components/primitives';
import { ProfileAvatar } from '@/features/account/profile-avatar';
import { PeoplePicker } from '@/features/social/people-picker';
import { setTravelMapVisibility } from '@/services/travel/travel-map-collaboration';
import { useFriends } from '@/store/friends';
import { AgentUiIds, useAgentUiTarget } from '@/utils/agent-ui';

import type { TravelMapRenderedVisit } from './model';
import type { TravelMapPlaceSelection } from './travel-map-canvas';
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
  const visibleFriendIds = new Set(
    friendProfiles.map((profile) => profile.userId),
  );
  const excludeIds = friends
    .filter(
      (friend) =>
        !visibleFriendIds.has(friend.userId) ||
        selectedFriendIds.includes(friend.userId),
    )
    .map((friend) => friend.userId);

  return (
    <PeoplePicker
      visible={visible}
      onClose={onClose}
      title="Overlay Friend Maps"
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
      excludeIds={excludeIds}
      onConfirm={(picked) => {
        const allowed = picked
          .map((friend) => friend.userId)
          .filter((id) => visibleFriendIds.has(id));
        onChangeSelectedFriendIds([...selectedFriendIds, ...allowed]);
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
    <View
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
    </View>
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
    <GlassPlate
      intensity={76}
      style={[
        styles.suggestion,
        landscape
          ? [styles.suggestionLandscape, { bottom }]
          : styles.suggestionPortrait,
      ]}
    >
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
  suggestion: {
    position: 'absolute',
    left: 14,
    right: 14,
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
