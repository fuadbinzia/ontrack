import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import {
    GlassPrimaryAction,
    Input,
    SheetScaffold,
} from '@/components/primitives';
import { glassFieldBackground, glassFieldBorder, radii } from '@/design-system';
import { resolveSelfDisplayName } from '@/features/account/self-display-name';
import { useAuthSession } from '@/features/auth/auth-provider';
import { useResponsive } from '@/hooks/use-responsive';
import { useTheme } from '@/hooks/use-theme';
import { ensureFriendProfile } from '@/services/friends';
import { usePreferences } from '@/store/preferences';
import { AgentUiIds } from '@/utils/agent-ui';
import { haptics } from '@/utils/haptics';

export function ProfileIdentityEditorSheet({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const theme = useTheme();
  const { spacing } = useResponsive();
  const { user } = useAuthSession();
  const storedName = usePreferences((state) => state.name);
  const storedGoal = usePreferences((state) => state.goal);
  const setName = usePreferences((state) => state.setName);
  const setGoal = usePreferences((state) => state.setGoal);

  const [nameDraft, setNameDraft] = useState('');
  const [goalDraft, setGoalDraft] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!visible) return;
    const displayName = resolveSelfDisplayName({
      preferencesName: usePreferences.getState().name,
      user,
    });
    setNameDraft(displayName);
    setGoalDraft(usePreferences.getState().goal);
    setSaving(false);
  }, [storedGoal, storedName, user, visible]);

  const save = async () => {
    setSaving(true);
    try {
      const nextName = nameDraft.trim();
      const nextGoal = goalDraft.trim();
      setName(nextName);
      setGoal(nextGoal);
      if (user) {
        await ensureFriendProfile({ displayName: nextName || 'Guest' }).catch(
          () => undefined,
        );
      }
      haptics.success();
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <SheetScaffold
      visible={visible}
      eyebrow="Profile"
      title="Name & blurb"
      onClose={onClose}
      closeAccessibilityLabel="Close name editor"
      closeTestID={AgentUiIds.profile.identityEditor.close}
      surface="glass"
      contentContainerStyle={{ gap: spacing.md }}
      footer={
        <GlassPrimaryAction
          label={saving ? 'Saving…' : 'Save'}
          onPress={() => void save()}
          disabled={saving}
          testID={AgentUiIds.profile.identityEditor.save}
        />
      }>
      <View style={[styles.fields, { gap: spacing.md }]}>
        <Input
          label="Name"
          icon="profile"
          value={nameDraft}
          onChangeText={setNameDraft}
          placeholder="Your name"
          autoCapitalize="words"
          autoCorrect={false}
          returnKeyType="next"
          editable={!saving}
          testID={AgentUiIds.profile.identityEditor.name}
          accessibilityLabel="Display name"
          fieldBackground={glassFieldBackground(theme.name)}
          fieldBorderColor={glassFieldBorder(theme.name)}
          fieldBorderRadius={radii.md}
        />
        <Input
          label="Blurb"
          icon="target"
          value={goalDraft}
          onChangeText={setGoalDraft}
          placeholder="Live intentionally"
          autoCapitalize="sentences"
          returnKeyType="done"
          editable={!saving}
          testID={AgentUiIds.profile.identityEditor.goal}
          accessibilityLabel="Profile blurb"
          fieldBackground={glassFieldBackground(theme.name)}
          fieldBorderColor={glassFieldBorder(theme.name)}
          fieldBorderRadius={radii.md}
        />
      </View>
    </SheetScaffold>
  );
}

const styles = StyleSheet.create({
  fields: {
    width: '100%',
  },
});
