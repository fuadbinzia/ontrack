import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, TextInput, View, type ModalProps } from 'react-native';

import {
  AppText,
  GlassPlate,
  GlassPrimaryAction,
  SheetScaffold,
} from '@/components/primitives';
import { radii } from '@/design-system';
import { useResponsive } from '@/hooks/use-responsive';
import { useTheme } from '@/hooks/use-theme';
import { type FriendProfile } from '@/services/friends';
import { useFriends } from '@/store/friends';
import { AgentUiIds, useAgentUiTarget } from '@/utils/agent-ui';

export function PeoplePicker({
  visible,
  onClose,
  onConfirm,
  multi = true,
  excludeIds = [],
  title = 'Choose Friends',
  confirmLabel = 'Add',
  headerContent,
  supportedOrientations,
}: {
  visible: boolean;
  onClose: () => void;
  onConfirm: (friends: FriendProfile[]) => void;
  multi?: boolean;
  excludeIds?: string[];
  title?: string;
  confirmLabel?: string;
  headerContent?: ReactNode;
  supportedOrientations?: ModalProps['supportedOrientations'];
}) {
  const theme = useTheme();
  const { spacing, s, typography } = useResponsive();
  const friends = useFriends((state) => state.friends);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    if (!visible) {
      setQuery('');
      setSelected(new Set());
    }
  }, [visible]);

  const available = useMemo(() => {
    const excluded = new Set(excludeIds);
    const needle = query.trim().toLowerCase();
    return friends.filter((friend) => {
      if (excluded.has(friend.userId) || excluded.has(friend.email)) return false;
      if (!needle) return true;
      return (
        friend.displayName.toLowerCase().includes(needle) ||
        friend.email.toLowerCase().includes(needle)
      );
    });
  }, [excludeIds, friends, query]);

  const toggle = useCallback(
    (userId: string) => {
      setSelected((current) => {
        if (!multi) return new Set([userId]);
        const next = new Set(current);
        if (next.has(userId)) next.delete(userId);
        else next.add(userId);
        return next;
      });
    },
    [multi],
  );

  const confirm = () => {
    const picked = friends.filter((friend) => selected.has(friend.userId));
    onConfirm(picked);
    onClose();
  };

  const searchAgent = useAgentUiTarget(AgentUiIds.peoplePicker.search, {
    label: 'Search name or email',
  });
  const confirmText = `${confirmLabel}${selected.size > 0 ? ` (${selected.size})` : ''}`;

  return (
    <SheetScaffold
      visible={visible}
      title={title}
      onClose={onClose}
      closeAccessibilityLabel="Close"
      closeTestID={AgentUiIds.peoplePicker.close}
      supportedOrientations={supportedOrientations}
      surface="glass"
      contentContainerStyle={{ gap: spacing.sm }}
      footer={
        <GlassPrimaryAction
          label={confirmText}
          disabled={selected.size === 0}
          onPress={confirm}
          testID={AgentUiIds.peoplePicker.confirm}
        />
      }>
      {headerContent}
      <GlassPlate
        airy
        style={[
          styles.search,
          {
            minHeight: Math.max(44, s(48)),
            paddingHorizontal: spacing.md,
            marginBottom: spacing.sm,
          },
        ]}>
        <TextInput
          ref={searchAgent.ref as never}
          testID={searchAgent.testID}
          onLayout={searchAgent.onLayout}
          value={query}
          onChangeText={setQuery}
          placeholder="Search name or email"
          placeholderTextColor={theme.textTertiary}
          autoCapitalize="none"
          autoCorrect={false}
          style={[
            styles.searchInput,
            {
              color: theme.textPrimary,
              fontSize: typography.callout.fontSize,
            },
          ]}
        />
      </GlassPlate>

      {available.length === 0 ? (
        <AppText variant="body" color="secondary" style={{ marginTop: spacing.md }}>
          {friends.length === 0
            ? 'Add friends on the Social tab first.'
            : 'No matching friends.'}
        </AppText>
      ) : (
        available.map((friend) => (
          <PeoplePickerFriendRow
            key={friend.userId}
            friend={friend}
            selected={selected.has(friend.userId)}
            accentBorder={theme.accentPrimary}
            idleBorder={theme.separator}
            minHeight={Math.max(52, s(56))}
            paddingHorizontal={spacing.md}
            gap={spacing.md}
            onPress={() => toggle(friend.userId)}
          />
        ))
      )}
    </SheetScaffold>
  );
}

function PeoplePickerFriendRow({
  friend,
  selected,
  accentBorder,
  idleBorder,
  minHeight,
  paddingHorizontal,
  gap,
  onPress,
}: {
  friend: FriendProfile;
  selected: boolean;
  accentBorder: string;
  idleBorder: string;
  minHeight: number;
  paddingHorizontal: number;
  gap: number;
  onPress: () => void;
}) {
  const agent = useAgentUiTarget(AgentUiIds.peoplePicker.friend(friend.userId), {
    label: friend.displayName,
    onPress,
  });
  return (
    <Pressable
      ref={agent.ref}
      testID={agent.testID}
      onLayout={agent.onLayout}
      accessibilityRole="button"
      accessibilityLabel={friend.displayName}
      accessibilityState={{ selected }}
      onPress={onPress}
      style={styles.rowWrap}>
      <GlassPlate
        airy
        style={[
          styles.row,
          {
            minHeight,
            borderWidth: selected ? 2 : 1,
            borderColor: selected ? accentBorder : idleBorder,
            paddingHorizontal,
            gap,
          },
        ]}>
        <View style={styles.rowCopy}>
          <AppText variant="callout" fit>
            {friend.displayName}
          </AppText>
          <AppText variant="caption" color="secondary" fit>
            {friend.email}
          </AppText>
        </View>
        <AppText variant="caption" color={selected ? 'accent' : 'secondary'} fit>
          {selected ? 'Selected' : 'Select'}
        </AppText>
      </GlassPlate>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  search: {
    borderRadius: radii.md,
  },
  searchInput: {
    minWidth: 0,
    flex: 1,
    paddingVertical: 0,
  },
  rowWrap: {
    width: '100%',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radii.md,
  },
  rowCopy: {
    flex: 1,
    flexShrink: 1,
    minWidth: 0,
    gap: 2,
  },
});
