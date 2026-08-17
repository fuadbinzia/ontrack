import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, View, type ModalProps } from 'react-native';

import {
  AppText,
  Dropdown,
  EmptyState,
  GlassPlate,
  GlassPrimaryAction,
  Input,
  SheetScaffold,
} from '@/components/primitives';
import { radii, type AppIconName } from '@/design-system';
import { ProfileAvatar } from '@/features/account/profile-avatar';
import { useResponsive } from '@/hooks/use-responsive';
import { useTheme } from '@/hooks/use-theme';
import { type FriendProfile } from '@/services/friends';
import { useFriends } from '@/store/friends';
import { AgentTestId, AgentUiIds, useAgentUiTarget } from '@/utils/agent-ui';

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
  includeIds,
  title = 'Choose Friends',
  eyebrow,
  subtitle,
  subtitleIcon,
  confirmLabel = 'Add',
  headerContent,
  emptyState,
  emptySearchState,
  emptyTestID,
  showSearch = true,
  supportedOrientations,
  presentation = 'list',
}: {
  visible: boolean;
  onClose: () => void;
  onConfirm: (friends: FriendProfile[]) => void;
  multi?: boolean;
  excludeIds?: string[];
  /** Optional allowlist used by collaboration surfaces with an established roster. */
  includeIds?: string[];
  title?: string;
  eyebrow?: string;
  subtitle?: string;
  subtitleIcon?: AppIconName;
  confirmLabel?: string;
  headerContent?: ReactNode;
  emptyState?: { icon: AppIconName; title: string; message: string };
  emptySearchState?: { icon: AppIconName; title: string; message: string };
  emptyTestID?: string;
  showSearch?: boolean;
  supportedOrientations?: ModalProps['supportedOrientations'];
  presentation?: 'list' | 'searchable-dropdown';
}) {
  const theme = useTheme();
  const { spacing, s } = useResponsive();
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
  const hasQuery = query.trim().length > 0;
  const resolvedEmpty =
    hasQuery
      ? (emptySearchState ?? {
          icon: 'search' as const,
          title: 'No One Matches That',
          message: 'Try a different name.',
        })
      : (emptyState ??
        (friends.length === 0
          ? {
              icon: 'people' as const,
              title: 'Invite a Friend First',
              message: 'Add someone on Social, then you can pick them here.',
            }
          : {
              icon: 'people' as const,
              title: 'No One Matches That',
              message: 'Try a different name.',
            }));

  return (
    <SheetScaffold
      visible={visible}
      eyebrow={eyebrow}
      title={title}
      subtitle={subtitle}
      subtitleIcon={subtitleIcon}
      onClose={onClose}
      closeAccessibilityLabel="Close"
      closeTestID={AgentUiIds.peoplePicker.close}
      supportedOrientations={supportedOrientations}
      surface="glass"
      contentContainerStyle={{ gap: spacing.md }}
      footer={
        available.length === 0 && selected.size === 0 ? undefined : (
          <GlassPrimaryAction
            label={confirmText}
            disabled={selected.size === 0}
            onPress={confirm}
            testID={AgentUiIds.peoplePicker.confirm}
          />
        )
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
            friends.length === 0 ? 'Invite a Friend First' : 'No One Matches That'
          }
          testID={AgentUiIds.peoplePicker.dropdown}
          supportedOrientations={supportedOrientations}
        />
      ) : (
        <>
          {showSearch ? (
            <Input
              icon="search"
              value={query}
              onChangeText={setQuery}
              placeholder="Search names"
              autoCapitalize="none"
              autoCorrect={false}
              testID={AgentUiIds.peoplePicker.search}
              accessibilityLabel="Search names"
            />
          ) : null}

          {available.length === 0 ? (
            <AgentTestId
              testID={emptyTestID ?? AgentUiIds.peoplePicker.empty}
              label={resolvedEmpty.title}
            >
              <EmptyState
                icon={resolvedEmpty.icon}
                title={resolvedEmpty.title}
                message={resolvedEmpty.message}
              />
            </AgentTestId>
          ) : (
            available.map((friend) => (
              <PeoplePickerFriendRow
                key={friend.userId}
                friend={friend}
                selected={selected.has(friend.userId)}
                accentBorder={theme.accentPrimary}
                idleBorder={theme.separator}
                minHeight={Math.max(56, s(60))}
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
      style={styles.rowWrap}
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
        <ProfileAvatar
          displayName={friend.displayName}
          userId={friend.userId}
          avatar={friend.avatar}
          size={36}
        />
        <View style={styles.rowCopy}>
          <AppText variant="callout" fit>
            {friend.displayName}
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
  rowWrap: {
    width: '100%',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radii.lg,
  },
  rowCopy: {
    flex: 1,
    flexShrink: 1,
    minWidth: 0,
    gap: 2,
  },
});
