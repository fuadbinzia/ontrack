import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { typeConfig } from '@/design-system';
import { useAvatarCache } from '@/features/account/avatar-cache';
import { IconifyIcon } from '@/features/account/iconify-icon';
import {
  initialAvatarPhotoUrl,
  resolveProfileAvatarUrl,
} from '@/features/account/profile-avatar-media';
import {
  avatarIconGlyphSize,
  avatarInitialsFontSize,
  initialsFromName,
  resolveAvatarColor,
  type ProfileAvatarMeta,
} from '@/features/account/profile-avatar-model';
import { useTheme } from '@/hooks/use-theme';
import { usePreferences } from '@/store/preferences';

type ProfileAvatarProps = {
  displayName: string;
  userId?: string;
  size: number;
  /** When set, skips cache / preferences lookup. */
  avatar?: ProfileAvatarMeta;
  /** Treat as the signed-in user (preferences avatar). */
  isSelf?: boolean;
  accessibilityLabel?: string;
  /** Optional border override for contexts with an explicit selection state. */
  borderColor?: string;
  borderWidth?: number;
};

function softFill(color: string): string {
  return `${color}33`;
}

/**
 * Circular profile mark: photo, Iconify icon, or initials.
 *
 * Initials MUST use fixed RN `Text` + {@link avatarInitialsFontSize}.
 * Do not use AppText shrink-to-fit inside the circle — it collapses the letters.
 */
export function ProfileAvatar({
  displayName,
  userId,
  size,
  avatar: avatarOverride,
  isSelf,
  accessibilityLabel,
  borderColor: borderColorOverride,
  borderWidth: borderWidthOverride,
}: ProfileAvatarProps) {
  const theme = useTheme();
  const selfAvatar = usePreferences((s) => s.avatar);
  const cached = useAvatarCache((s) => (userId ? s.byUserId[userId] : undefined));
  const meta = avatarOverride ?? (isSelf ? selfAvatar : cached);
  const color = resolveAvatarColor(meta, theme.accentPrimary);
  const [photoUrl, setPhotoUrl] = useState<string | undefined>(() =>
    initialAvatarPhotoUrl(meta),
  );

  useEffect(() => {
    let cancelled = false;
    if (meta?.kind !== 'photo') {
      setPhotoUrl(undefined);
      return;
    }
    if (meta.localPhotoUri) {
      setPhotoUrl(meta.localPhotoUri);
      return;
    }
    if (!meta.photoPath) {
      setPhotoUrl(undefined);
      return;
    }
    void resolveProfileAvatarUrl(meta.photoPath).then((url) => {
      if (!cancelled) setPhotoUrl(url);
    });
    return () => {
      cancelled = true;
    };
  }, [meta?.kind, meta?.localPhotoUri, meta?.photoPath]);

  const fontSize = avatarInitialsFontSize(size);
  const iconSize = avatarIconGlyphSize(size);

  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={accessibilityLabel ?? displayName}
      style={[
        styles.circle,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor:
            meta?.kind === 'photo' && photoUrl
              ? theme.backgroundSunken
              : softFill(color),
          borderColor: borderColorOverride ?? `${color}55`,
          borderWidth: borderWidthOverride ?? StyleSheet.hairlineWidth,
        },
      ]}>
      {meta?.kind === 'photo' && photoUrl ? (
        <Image
          source={photoUrl}
          style={{ width: size, height: size, borderRadius: size / 2 }}
          contentFit="cover"
          cachePolicy="memory-disk"
          transition={0}
        />
      ) : meta?.kind === 'icon' && meta.iconId ? (
        <IconifyIcon iconId={meta.iconId} color={color} size={iconSize} />
      ) : (
        <Text
          allowFontScaling={false}
          numberOfLines={1}
          style={{
            color,
            fontFamily: typeConfig.fontFamily,
            fontWeight: typeConfig.weight.regular,
            fontSize,
            lineHeight: fontSize,
            textAlign: 'center',
            includeFontPadding: false,
          }}>
          {initialsFromName(displayName)}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  circle: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
  },
});
