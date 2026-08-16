import { Pressable, StyleSheet } from 'react-native';

import { AppText, GlassPlate } from '@/components/primitives';
import { ProfileAvatar } from '@/features/account/profile-avatar';
import { radii } from '@/design-system';
import { useResponsive } from '@/hooks/use-responsive';
import { AgentTestId, AgentUiIds, useAgentUiTarget } from '@/utils/agent-ui';

type ProfileIdentityHeroProps = {
  displayName: string;
  blurb: string;
  onOpenAvatar: () => void;
  onOpenIdentity: () => void;
};

/** Centered glass identity mark — avatar vs name/blurb are distinct actions. */
export function ProfileIdentityHero({
  displayName,
  blurb,
  onOpenAvatar,
  onOpenIdentity,
}: ProfileIdentityHeroProps) {
  const { s, spacing } = useResponsive();
  const avatarSize = Math.max(76, s(84));
  const avatarAgent = useAgentUiTarget(AgentUiIds.profile.avatar, {
    label: 'Customize profile icon',
    onPress: onOpenAvatar,
  });
  const identityAgent = useAgentUiTarget(AgentUiIds.profile.displayName, {
    label: 'Edit name and blurb',
    onPress: onOpenIdentity,
  });

  return (
    <GlassPlate
      style={[
        styles.hero,
        {
          borderRadius: radii.xl,
          paddingHorizontal: spacing.lg,
          paddingVertical: spacing.lg,
          gap: spacing.md,
        },
      ]}>
      <Pressable
        ref={avatarAgent.ref}
        accessibilityRole="button"
        accessibilityLabel="Customize profile icon"
        testID={avatarAgent.testID}
        onLayout={avatarAgent.onLayout}
        onPress={onOpenAvatar}>
        <ProfileAvatar displayName={displayName} size={avatarSize} isSelf />
      </Pressable>
      <Pressable
        ref={identityAgent.ref}
        accessibilityRole="button"
        accessibilityLabel="Edit name and blurb"
        testID={identityAgent.testID}
        onLayout={identityAgent.onLayout}
        onPress={onOpenIdentity}
        style={[styles.copy, { gap: spacing.xxs, minWidth: 0 }]}>
        <AppText variant="title" fit numberOfLines={1} style={styles.name}>
          {displayName}
        </AppText>
        <AgentTestId testID={AgentUiIds.profile.blurb} label="Edit name and blurb">
          <AppText variant="caption" color="secondary" numberOfLines={2} fit style={styles.name}>
            {blurb}
          </AppText>
        </AgentTestId>
      </Pressable>
    </GlassPlate>
  );
}

const styles = StyleSheet.create({
  hero: {
    alignItems: 'center',
    width: '100%',
  },
  copy: {
    alignItems: 'center',
    alignSelf: 'stretch',
  },
  name: {
    textAlign: 'center',
  },
});
