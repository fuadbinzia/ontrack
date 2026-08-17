import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, TextInput, View, type ModalProps } from 'react-native';

import {
    AppText,
    Dropdown,
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

export function peoplePickerIdentity(
  friend: Pick<FriendProfile, 'displayName'>,
) {
  const name = friend.displayName.trim();
  return {
    name,
    detail: undefined,
    searchText: name.toLowerCase(),
  };
}

export function PeoplePicker({
  visible,
  onClose,
  onConfirm,
  multi = true,
  excludeIds = [],
  disabledIds = [],
  includeIds,
  title = 'Choose Friends',
  confirmLabel = 'Add',
  disabledLabel = 'Not Sharing',
  headerContent,
  supportedOrientations,
  presentation = 'list',
}: {
  visible: boolean;
  onClose: () => void;
  onConfirm: (friends: FriendProfile[]) => void;
  multi?: boolean;
  excludeIds?: string[];
  /** Shown in the list but not selectable — used when a friend cannot take the action yet. */
  disabledIds?: string[];
  /** Optional allowlist used by collaboration surfaces with an established roster. */
  includeIds?: string[];
  title?: string;
  confirmLabel?: string;
  disabledLabel?: string;
  headerContent?: ReactNode;
  supportedOrientations?: ModalProps['supportedOrientations'];
  presentation?: 'list' | 'searchable-dropdown';
}) {
  const theme = useTheme();
  const { spacing, s, typography } = useResponsive();
  const friends = useFriends((state) => state.friends);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [dropdownOpen, setDropdownOpen] = useState(false);

  useEffect(() => {
    if (!visible) {
      setQuery('');
      setSelected(new Set());
      setDropdownOpen(false);
    }
  }, [visible]);

  const disabled = useMemo(() => new Set(disabledIds), [disabledIds]);
  const available = useMemo(() => {
    const excluded = new Set(excludeIds);
    const included = includeIds ? new Set(includeIds) : undefined;
    const needle = query.trim().toLowerCase();
    return friends.filter((friend) => {
      if (included && !included.has(friend.userId)) return false;
      if (excluded.has(friend.userId)) return false;
      if (!needle) return true;
      return peoplePickerIdentity(friend).searchText.includes(needle);
    });
  }, [excludeIds, friends, includeIds, query]);

  const toggle = useCallback(
    (userId: string) => {
      if (disabled.has(userId)) return;
      setSelected((current) => {
        if (!multi) return new Set([userId]);
        const next = new Set(current);
        if (next.has(userId)) next.delete(userId);
        else next.add(userId);
        return next;
      });
    },
    [disabled, multi],
  );

  const confirm = () => {
    const picked = friends.filter(
      (friend) => selected.has(friend.userId) && !disabled.has(friend.userId),
    );
    onConfirm(picked);
    onClose();
  };

  const searchAgent = useAgentUiTarget(AgentUiIds.peoplePicker.search, {
    label: 'Search names',
  });
  const confirmText = `${confirmLabel}${selected.size > 0 ? ` (${selected.size})` : ''}`;
  const dropdownOptions = useMemo(
    () =>
      available.map((friend) => {
        const identity = peoplePickerIdentity(friend);
        return {
          value: friend.userId,
          label: identity.name,
          description: identity.detail,
          searchText: identity.searchText,
          testID: AgentUiIds.peoplePicker.friend(friend.userId),
        };
      }),
    [available],
  );

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
      }
    >
      {headerContent}
      {presentation === 'searchable-dropdown' ? (
        <Dropdown
          label="Friends"
          placeholder="Select Friends"
          preserveOptionCase
          multiple
          value={[...selected]}
          options={dropdownOptions}
          onChange={(next) => setSelected(new Set(next))}
          open={dropdownOpen}
          onOpenChange={setDropdownOpen}
          searchable
          searchPlaceholder="Search Names"
          searchTestID={AgentUiIds.peoplePicker.search}
          emptyMessage={
            friends.length === 0 ? 'Add Friends On The Social Tab First' : 'No Matching Friends'
          }
          testID={AgentUiIds.peoplePicker.dropdown}
          supportedOrientations={supportedOrientations}
        />
      ) : (
        <>
          <GlassPlate
            airy
            style={[
              styles.search,
              {
                minHeight: Math.max(44, s(48)),
                paddingHorizontal: spacing.md,
                marginBottom: spacing.sm,
              },
            ]}
          >
            <TextInput
              ref={searchAgent.ref as never}
              testID={searchAgent.testID}
              onLayout={searchAgent.onLayout}
              value={query}
              onChangeText={setQuery}
              placeholder="Search names"
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
                disabled={disabled.has(friend.userId)}
                disabledLabel={disabledLabel}
                accentBorder={theme.accentPrimary}
                idleBorder={theme.separator}
                minHeight={Math.max(52, s(56))}
                paddingHorizontal={spacing.md}
                gap={spacing.md}
                onPress={() => toggle(friend.userId)}
              />
            ))
          )}
        </>
      )}
    </SheetScaffold>
  );
}

function PeoplePickerFriendRow({
  friend,
  selected,
  disabled,
  disabledLabel,
  accentBorder,
  idleBorder,
  minHeight,
  paddingHorizontal,
  gap,
  onPress,
}: {
  friend: FriendProfile;
  selected: boolean;
  disabled: boolean;
  disabledLabel: string;
  accentBorder: string;
  idleBorder: string;
  minHeight: number;
  paddingHorizontal: number;
  gap: number;
  onPress: () => void;
}) {
  const agent = useAgentUiTarget(AgentUiIds.peoplePicker.friend(friend.userId), {
    label: friend.displayName,
    onPress: disabled ? undefined : onPress,
  });
  return (
    <Pressable
      ref={agent.ref}
      testID={agent.testID}
      onLayout={agent.onLayout}
      accessibilityRole="button"
      accessibilityLabel={friend.displayName}
      accessibilityState={{ selected, disabled }}
      disabled={disabled}
      onPress={onPress}
      style={[styles.rowWrap, disabled ? styles.rowDisabled : undefined]}
    >
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
        ]}
      >
        <View style={styles.rowCopy}>
          <AppText variant="callout" fit>
            {friend.displayName}
          </AppText>
        </View>
        <AppText
          variant="caption"
          color={disabled ? 'tertiary' : selected ? 'accent' : 'secondary'}
          fit
        >
          {disabled ? disabledLabel : selected ? 'Selected' : 'Select'}
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
  rowDisabled: {
    opacity: 0.62,
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
