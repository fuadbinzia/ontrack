import { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Pressable,
    StyleSheet,
    View,
} from 'react-native';

import {
    AppText,
    Button,
    ErrorMessage,
    GlassPlate,
    GlassPrimaryAction,
    Input,
    SegmentedControl,
    SheetScaffold,
} from '@/components/primitives';
import { glassFieldBackground, glassFieldBorder, radii } from '@/design-system';
import { AvatarColorPicker } from '@/features/account/avatar-color-picker';
import { IconifyIcon } from '@/features/account/iconify-icon';
import { iconifyLabel, searchIconifyIcons } from '@/features/account/iconify-search';
import { ProfileAvatar } from '@/features/account/profile-avatar';
import {
    persistAvatarPhoto,
    uploadProfileAvatarPhoto,
} from '@/features/account/profile-avatar-media';
import {
    DEFAULT_AVATAR_COLOR,
    normalizeAvatarColor,
    normalizeAvatarMeta,
    resolveAvatarColor,
    type ProfileAvatarKind,
    type ProfileAvatarMeta,
} from '@/features/account/profile-avatar-model';
import { resolveSelfDisplayName } from '@/features/account/self-display-name';
import { useAuthSession } from '@/features/auth/auth-provider';
import { useResponsive } from '@/hooks/use-responsive';
import { useTheme } from '@/hooks/use-theme';
import { setProfileAvatar } from '@/services/friends';
import { usePreferences } from '@/store/preferences';
import { AgentUiIds } from '@/utils/agent-ui';
import { haptics } from '@/utils/haptics';
import { pickCameraImage, pickLibraryImage } from '@/utils/pick-image';

type Mode = ProfileAvatarKind;

const MODES: { value: Mode; label: string }[] = [
  { value: 'initials', label: 'Initials' },
  { value: 'icon', label: 'Icon' },
  { value: 'photo', label: 'Photo' },
];

export function ProfileAvatarEditorSheet({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const theme = useTheme();
  const { spacing, s } = useResponsive();
  const { user } = useAuthSession();
  const name = usePreferences((state) => state.name);
  const setAvatar = usePreferences((state) => state.setAvatar);

  const [draft, setDraft] = useState<ProfileAvatarMeta>(() =>
    normalizeAvatarMeta(usePreferences.getState().avatar),
  );
  const [query, setQuery] = useState('');
  const [icons, setIcons] = useState<string[]>([]);
  const [searching, setSearching] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();
  const [scrollEnabled, setScrollEnabled] = useState(true);

  useEffect(() => {
    if (!visible) return;
    // Seed once when the sheet opens — keep any saved tint; default to app accent.
    const next = normalizeAvatarMeta(usePreferences.getState().avatar);
    setDraft({
      ...next,
      color:
        next.color ??
        normalizeAvatarColor(theme.accentPrimary) ??
        DEFAULT_AVATAR_COLOR,
    });
    setQuery('');
    setError(undefined);
    setSaving(false);
    setScrollEnabled(true);
  }, [theme.accentPrimary, visible]);

  useEffect(() => {
    if (!visible || draft.kind !== 'icon') return;
    let cancelled = false;
    const handle = setTimeout(() => {
      setSearching(true);
      void searchIconifyIcons(query)
        .then((results) => {
          if (!cancelled) setIcons(results);
        })
        .finally(() => {
          if (!cancelled) setSearching(false);
        });
    }, query.trim() ? 280 : 0);
    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [draft.kind, query, visible]);

  const previewName = resolveSelfDisplayName({ preferencesName: name, user });
  const titleName = previewName.split(/\s+/)[0] || previewName;
  const color = resolveAvatarColor(draft, theme.accentPrimary);
  const previewSize = Math.max(88, s(96));
  const iconCell = Math.max(52, s(56));

  const mode = draft.kind;

  const setMode = (next: Mode) => {
    setDraft((current) => {
      if (next === 'initials') {
        return { kind: 'initials', color: current.color };
      }
      if (next === 'icon') {
        return {
          kind: 'icon',
          color: current.color,
          iconId: current.iconId ?? 'mdi:account',
        };
      }
      return {
        kind: 'photo',
        color: current.color,
        photoPath: current.photoPath,
        localPhotoUri: current.localPhotoUri,
      };
    });
  };

  const pickPhoto = async (source: 'camera' | 'library') => {
    setError(undefined);
    const uri =
      source === 'camera'
        ? await pickCameraImage({
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.9,
          })
        : await pickLibraryImage({
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.9,
          });
    if (!uri) return;
    try {
      const localUri = await persistAvatarPhoto(uri);
      setDraft((current) => ({
        kind: 'photo',
        color: current.color,
        localPhotoUri: localUri,
        photoPath: current.photoPath,
      }));
      haptics.success();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : 'That photo could not be saved.',
      );
    }
  };

  const save = async () => {
    setSaving(true);
    setError(undefined);
    try {
      let next = normalizeAvatarMeta({
        ...draft,
        // Always persist the resolved tint the user is looking at.
        color: resolveAvatarColor(draft, theme.accentPrimary),
      });
      if (next.kind === 'icon' && !next.iconId) {
        setError('Pick an icon to continue.');
        setSaving(false);
        return;
      }
      if (next.kind === 'photo') {
        if (!next.localPhotoUri && !next.photoPath) {
          setError('Choose a photo to continue.');
          setSaving(false);
          return;
        }
        if (user?.id && next.localPhotoUri) {
          const photoPath = await uploadProfileAvatarPhoto(user.id, next.localPhotoUri);
          next = { ...next, photoPath };
        }
      }

      setAvatar(next);

      if (user) {
        const synced = await setProfileAvatar(next);
        setAvatar({
          ...synced,
          color: synced.color ?? next.color,
          ...(next.localPhotoUri ? { localPhotoUri: next.localPhotoUri } : {}),
        });
      }

      haptics.success();
      onClose();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : 'Your avatar could not be saved.',
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <SheetScaffold
      visible={visible}
      eyebrow="Profile"
      title={`${titleName}’s Icon`}
      onClose={onClose}
      closeAccessibilityLabel="Close avatar editor"
      closeTestID={AgentUiIds.profile.avatarEditor.close}
      surface="glass"
      scrollEnabled={scrollEnabled}
      scrollKey={mode}
      contentContainerStyle={{ gap: spacing.lg }}
      footer={
        <GlassPrimaryAction
          label={saving ? 'Saving…' : 'Save'}
          onPress={() => void save()}
          disabled={saving}
          testID={AgentUiIds.profile.avatarEditor.save}
        />
      }>
      <View style={styles.previewBlock}>
        <ProfileAvatar
          displayName={previewName}
          size={previewSize}
          avatar={draft}
          isSelf
        />
        <AppText variant="callout" color="secondary" fit>
          {previewName}
        </AppText>
      </View>

      <SegmentedControl
        value={mode}
        onChange={setMode}
        options={MODES.map((item) => ({
          value: item.value,
          label: item.label,
          testID: AgentUiIds.profile.avatarEditor.mode(item.value),
        }))}
      />

      {mode === 'icon' ? (
        <View style={{ gap: spacing.md }}>
          <Input
            icon="search"
            value={query}
            onChangeText={setQuery}
            placeholder="Search icons"
            autoCapitalize="none"
            autoCorrect={false}
            accessibilityLabel="Search icons"
            testID={AgentUiIds.profile.avatarEditor.searchIcons}
            fieldBackground={glassFieldBackground(theme.name)}
            fieldBorderColor={glassFieldBorder(theme.name)}
            fieldBorderRadius={radii.md}
          />
          {searching ? (
            <ActivityIndicator color={theme.accentPrimary} />
          ) : (
            <View style={styles.iconGrid}>
              {icons.map((iconId) => {
                const selected = draft.iconId === iconId;
                return (
                  <Pressable
                    key={iconId}
                    accessibilityRole="button"
                    accessibilityLabel={iconifyLabel(iconId)}
                    accessibilityState={{ selected }}
                    onPress={() => {
                      haptics.tap();
                      setDraft((current) => ({
                        ...current,
                        kind: 'icon',
                        iconId,
                      }));
                    }}
                    style={{ width: iconCell, height: iconCell }}>
                    <GlassPlate
                      mist={selected}
                      airy={!selected}
                      style={[
                        styles.iconCell,
                        {
                          width: iconCell,
                          height: iconCell,
                          borderRadius: radii.md,
                          borderColor: selected
                            ? theme.accentPrimary
                            : theme.separator,
                        },
                      ]}>
                      <IconifyIcon
                        iconId={iconId}
                        color={color}
                        size={Math.round(iconCell * 0.5)}
                      />
                    </GlassPlate>
                  </Pressable>
                );
              })}
            </View>
          )}
        </View>
      ) : null}

      {mode === 'photo' ? (
        <View style={{ gap: spacing.sm }}>
          <Button
            variant="secondary"
            icon="camera"
            onPress={() => void pickPhoto('camera')}
            accessibilityLabel="Take avatar photo"
            testID={AgentUiIds.profile.avatarEditor.takePhoto}>
            Take photo
          </Button>
          <Button
            variant="secondary"
            icon="photo"
            onPress={() => void pickPhoto('library')}
            accessibilityLabel="Choose avatar photo"
            testID={AgentUiIds.profile.avatarEditor.chooseLibrary}>
            Choose from library
          </Button>
          {!user ? (
            <AppText variant="caption" color="secondary">
              Photo stays on this device until you sign in. Then it syncs for friends.
            </AppText>
          ) : null}
        </View>
      ) : null}

      {mode !== 'photo' ? (
        <AvatarColorPicker
          key={visible ? `avatar-color-${mode}` : 'closed'}
          color={color}
          onChange={(hex) => {
            setDraft((current) => ({ ...current, color: hex }));
          }}
          onDragStart={() => setScrollEnabled(false)}
          onDragEnd={() => setScrollEnabled(true)}
        />
      ) : null}

      {error ? <ErrorMessage message={error} /> : null}
    </SheetScaffold>
  );
}

const styles = StyleSheet.create({
  previewBlock: { alignItems: 'center', gap: 10 },
  iconGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  iconCell: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
});
