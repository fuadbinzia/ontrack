import { Pressable, StyleSheet, View } from 'react-native';

import {
    AppText,
    Button,
    CollapsibleBody,
    GlassTonePill,
    IconButton,
    Input,
    Symbol,
} from '@/components/primitives';
import { radii, spacing } from '@/design-system';
import { ProfileAvatar } from '@/features/account/profile-avatar';
import type {
    TravelParticipant,
    TravelTripRosterPerson,
} from '@/features/travel/types';
import { useResponsive } from '@/hooks/use-responsive';
import { useTheme } from '@/hooks/use-theme';
import { AgentTestId, AgentUiIds } from '@/utils/agent-ui';

/** Matches the default trip-roster avatar plate used in static layout styles. */
const AVATAR = 42;

export type TripFriendTarget =
  | { kind: 'host' }
  | { kind: 'roster'; member: TravelTripRosterPerson }
  | { kind: 'participant'; participant: TravelParticipant };

export function tripFriendTargetKey(target: TripFriendTarget): string {
  if (target.kind === 'host') return 'host';
  if (target.kind === 'roster') return `roster:${target.member.userId}`;
  return `participant:${target.participant.id}`;
}

function FriendActionChip({
  label,
  accessibilityLabel,
  danger,
  disabled,
  onPress,
  testID,
}: {
  label: string;
  accessibilityLabel?: string;
  danger?: boolean;
  disabled?: boolean;
  onPress: () => void;
  testID: string;
}) {
  return (
    <Button
      size="sm"
      variant={danger ? 'danger' : 'secondary'}
      disabled={disabled}
      onPress={onPress}
      testID={testID}
      accessibilityLabel={accessibilityLabel ?? label}
      style={styles.chip}>
      {label}
    </Button>
  );
}

export function TripFriendRow({
  displayName,
  userId,
  isSelf,
  badge,
  busy,
  canOpenMenu,
  expanded,
  showDivider,
  showMakeHost,
  showMakeCohost,
  showRemoveCohost,
  showResend,
  showRemove,
  selfOnlyMenu,
  renaming,
  renameDraft,
  onRenameDraftChange,
  onPress,
  onUpdateName,
  onMakeHost,
  onMakeCohost,
  onRemoveCohost,
  onResend,
  onRemove,
  onSaveRename,
  onCancelRename,
  testIDBase,
}: {
  displayName: string;
  userId?: string;
  isSelf?: boolean;
  badge?: 'host' | 'cohost' | 'pending';
  busy?: boolean;
  canOpenMenu: boolean;
  expanded?: boolean;
  showDivider?: boolean;
  showMakeHost?: boolean;
  showMakeCohost?: boolean;
  showRemoveCohost?: boolean;
  showResend?: boolean;
  showRemove?: boolean;
  /** Only Rename — used when the row is you but you can’t manage the trip. */
  selfOnlyMenu?: boolean;
  renaming?: boolean;
  renameDraft?: string;
  onRenameDraftChange?: (value: string) => void;
  onPress?: () => void;
  onUpdateName?: () => void;
  onMakeHost?: () => void;
  onMakeCohost?: () => void;
  onRemoveCohost?: () => void;
  onResend?: () => void;
  onRemove?: () => void;
  onSaveRename?: () => void;
  onCancelRename?: () => void;
  testIDBase: string;
}) {
  const theme = useTheme();
  const { s, spacing: rs } = useResponsive();
  const avatarLabel = (renaming ? renameDraft : displayName)?.trim() || displayName;
  // "(You)" is chrome on the name row — never feed it to initials.
  const avatarName =
    avatarLabel.replace(/\s*\(You\)\s*$/i, '').trim() || avatarLabel;
  const avatarSize = Math.max(40, s(42));
  const roleBadgeWidth = Math.max(72, s(72));
  const roleBadgeLabel =
    badge === 'host' ? 'Host' : badge === 'cohost' ? 'Co-host' : 'Pending';
  const header = (
    <View
      style={[
        styles.personHeader,
        renaming ? styles.personHeaderEditing : null,
      ]}>
      <ProfileAvatar
        displayName={avatarName}
        userId={userId}
        isSelf={isSelf}
        size={avatarSize}
      />
      {renaming ? (
        <View style={styles.renameRow}>
          <View style={styles.renameField}>
            <Input
              testID={AgentUiIds.travel.friendRow.action(testIDBase, 'renameInput')}
              value={renameDraft ?? ''}
              onChangeText={onRenameDraftChange}
              placeholder="Friend’s name"
              autoCapitalize="words"
              autoFocus
              returnKeyType="done"
              onSubmitEditing={() => {
                if (renameDraft?.trim()) onSaveRename?.();
              }}
              accessibilityLabel="Friend name"
              style={{
                minHeight: Math.max(44, s(44)),
                paddingVertical: rs.sm,
                paddingHorizontal: rs.md,
                borderRadius: radii.md,
              }}
            />
            <View style={styles.renameActions}>
              <Button
                size="sm"
                testID={AgentUiIds.travel.friendRow.action(testIDBase, 'saveRename')}
                accessibilityLabel="Save name"
                disabled={busy || !renameDraft?.trim()}
                onPress={() => onSaveRename?.()}
                style={styles.renameAction}>
                Save
              </Button>
              <IconButton
                icon="close"
                testID={AgentUiIds.travel.friendRow.action(testIDBase, 'cancelRename')}
                accessibilityLabel="Cancel rename"
                disabled={busy}
                onPress={() => onCancelRename?.()}
              />
            </View>
          </View>
        </View>
      ) : (
        <>
          <View style={styles.nameColumn}>
            <AppText variant="subheading" fit numberOfLines={1} style={styles.friendName}>
              {displayName}
            </AppText>
          </View>
          {badge ? (
            <GlassTonePill
              label={roleBadgeLabel}
              toneColor={
                badge === 'host' ? theme.accentPrimary : theme.textSecondary
              }
              showDot={false}
              style={{ width: roleBadgeWidth, alignSelf: 'center' }}
            />
          ) : null}
          {canOpenMenu ? (
            <Symbol name="chevron-right" size="sm" color={theme.textTertiary} />
          ) : null}
        </>
      )}
    </View>
  );

  return (
    <View
      style={[
        styles.person,
        showDivider
          ? {
              borderBottomWidth: StyleSheet.hairlineWidth,
              borderBottomColor: theme.separator,
            }
          : null,
      ]}>
      {canOpenMenu && onPress && !renaming ? (
        <AgentTestId
          testID={AgentUiIds.travel.friendRow.action(testIDBase, 'manage')}
          label={`${displayName}, manage`}
          onPress={onPress}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${displayName}, manage`}
            accessibilityState={{ expanded: Boolean(expanded) }}
            disabled={busy}
            onPress={onPress}
            style={({ pressed }) => [{ opacity: busy ? 0.5 : pressed ? 0.72 : 1 }]}>
            {header}
          </Pressable>
        </AgentTestId>
      ) : (
        header
      )}

      <CollapsibleBody expanded={Boolean(expanded) && !renaming}>
        <View style={styles.inlineActions}>
          <FriendActionChip
            label="Rename"
            accessibilityLabel="Update name"
            disabled={busy}
            testID={AgentUiIds.travel.friendRow.action(testIDBase, 'rename')}
            onPress={() => onUpdateName?.()}
          />
          {!selfOnlyMenu && showMakeCohost ? (
            <FriendActionChip
              label="Co-host"
              accessibilityLabel="Make co-host"
              disabled={busy}
              testID={AgentUiIds.travel.friendRow.action(testIDBase, 'makeCohost')}
              onPress={() => onMakeCohost?.()}
            />
          ) : null}
          {!selfOnlyMenu && showRemoveCohost ? (
            <FriendActionChip
              label="Demote"
              accessibilityLabel="Remove co-host"
              disabled={busy}
              testID={AgentUiIds.travel.friendRow.action(testIDBase, 'removeCohost')}
              onPress={() => onRemoveCohost?.()}
            />
          ) : null}
          {!selfOnlyMenu && showMakeHost ? (
            <FriendActionChip
              label="Host"
              accessibilityLabel="Make host"
              disabled={busy}
              testID={AgentUiIds.travel.friendRow.action(testIDBase, 'makeHost')}
              onPress={() => onMakeHost?.()}
            />
          ) : null}
          {!selfOnlyMenu && showResend ? (
            <FriendActionChip
              label="Resend"
              disabled={busy}
              testID={AgentUiIds.travel.friendRow.action(testIDBase, 'resend')}
              onPress={() => onResend?.()}
            />
          ) : null}
          {!selfOnlyMenu && showRemove ? (
            <FriendActionChip
              label="Remove"
              danger
              disabled={busy}
              testID={AgentUiIds.travel.friendRow.action(testIDBase, 'remove')}
              onPress={() => onRemove?.()}
            />
          ) : null}
        </View>
      </CollapsibleBody>
    </View>
  );
}


const styles = StyleSheet.create({
  chip: {
    flexGrow: 1,
    flexBasis: 0,
    minWidth: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  friendName: {
    width: '100%',
  },
  inlineActions: {
    flexDirection: 'row',
    flexWrap: 'nowrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.xs,
    paddingBottom: spacing.xs,
    width: '100%',
  },
  nameColumn: {
    flex: 1,
    minWidth: 0,
    flexShrink: 1,
    height: AVATAR,
    justifyContent: 'center',
  },
  person: {
    gap: spacing.xs,
  },
  personHeader: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  personHeaderEditing: {
    alignItems: 'flex-start',
  },
  renameAction: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.pill,
    flexShrink: 0,
  },
  renameActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    flexWrap: 'nowrap',
    gap: spacing.sm,
    width: '100%',
  },
  renameField: {
    flex: 1,
    minWidth: 0,
    flexShrink: 1,
    gap: spacing.sm,
  },
  renameRow: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
});
