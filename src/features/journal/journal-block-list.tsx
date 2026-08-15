import { useEffect, useRef, useState } from 'react';
import { Keyboard, Pressable, StyleSheet, View } from 'react-native';

import {
  ActionChip,
  AppText,
  Card,
  EmptyState,
  GlassIconWell,
  GlassMetaChip,
  IconButton,
  Input,
} from '@/components/primitives';
import { useResponsive } from '@/hooks/use-responsive';
import { useTheme } from '@/hooks/use-theme';
import { AgentTestId, AgentUiIds } from '@/utils/agent-ui';
import { confirmDestructiveAction } from '@/utils/confirm-destructive';
import { haptics } from '@/utils/haptics';
import { loadOptionalExpoAudio } from '@/utils/optional-expo-audio';

import { commitJournalTextEdit, formatVoiceDuration, journalBlockTimeParts } from './model';
import type { JournalBlock, JournalTextBlock } from './types';

const audioApi = loadOptionalExpoAudio();

function VoicePlayControl({ uri, testID }: { uri: string; testID: string }) {
  const player = audioApi!.useAudioPlayer(uri);
  const [playing, setPlaying] = useState(false);

  return (
    <IconButton
      icon={playing ? 'pause' : 'play'}
      accessibilityLabel={playing ? 'Pause Voice Note' : 'Play Voice Note'}
      testID={testID}
      onPress={() => {
        haptics.select();
        if (playing) {
          player.pause();
          setPlaying(false);
          return;
        }
        player.play();
        setPlaying(true);
      }}
    />
  );
}

export function JournalTimeChips({
  createdAt,
  updatedAt,
}: {
  createdAt?: string;
  updatedAt?: string;
}) {
  const { spacing } = useResponsive();
  const { created, updated } = journalBlockTimeParts({ createdAt, updatedAt });
  if (!created) return null;
  return (
    <AppText variant="caption" color="tertiary" style={{ paddingTop: spacing.md }}>
      {updated ? `Created ${created} · Updated ${updated}` : `Created ${created}`}
    </AppText>
  );
}

function JournalBlockDelete({
  blockId,
  onPress,
}: {
  blockId: string;
  onPress: () => void;
}) {
  const theme = useTheme();
  return (
    <IconButton
      icon="delete"
      color={theme.danger}
      accessibilityLabel="Delete Block"
      testID={AgentUiIds.journal.blockDelete(blockId)}
      onPress={onPress}
    />
  );
}

function JournalTextBlockCard({
  block,
  editing,
  showDelete,
  onBeginEdit,
  onEndEdit,
  onSave,
  onRemove,
}: {
  block: JournalTextBlock;
  editing: boolean;
  showDelete: boolean;
  onBeginEdit: () => void;
  onEndEdit: () => void;
  onSave: (text: string) => void;
  onRemove: () => void;
}) {
  const { spacing } = useResponsive();
  const [draft, setDraft] = useState(block.text);
  const draftRef = useRef(draft);
  const onSaveRef = useRef(onSave);
  draftRef.current = draft;
  onSaveRef.current = onSave;

  useEffect(() => {
    if (editing) setDraft(block.text);
  }, [block.text, editing]);

  useEffect(() => {
    if (!editing) return undefined;
    return () => {
      const next = commitJournalTextEdit(draftRef.current, block.text);
      if (next) onSaveRef.current(next);
    };
  }, [block.text, editing]);

  const finish = () => {
    Keyboard.dismiss();
    onEndEdit();
  };

  if (editing) {
    return (
      <Card airy testID={AgentUiIds.journal.block(block.id)}>
        <View style={{ gap: spacing.xs }}>
          <Input
            value={draft}
            onChangeText={setDraft}
            multiline
            autoFocus
            testID={AgentUiIds.journal.blockEdit(block.id)}
            accessibilityLabel="Edit Text"
            containerStyle={styles.editField}
            trailing={
              <IconButton
                icon="check"
                accessibilityLabel="Save Text"
                testID={AgentUiIds.journal.blockSave(block.id)}
                disabled={!draft.trim()}
                onPress={() => {
                  haptics.success();
                  finish();
                }}
              />
            }
          />
          <JournalTimeChips createdAt={block.createdAt} updatedAt={block.updatedAt} />
        </View>
      </Card>
    );
  }

  return (
    <Card airy>
      <View style={{ gap: spacing.xs }}>
        <View style={[styles.textRow, { gap: spacing.xs }]}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Edit Text"
            testID={AgentUiIds.journal.block(block.id)}
            onPress={onBeginEdit}
            style={styles.textCopy}>
            <AppText variant="body">{block.text}</AppText>
          </Pressable>
          {showDelete ? (
            <JournalBlockDelete blockId={block.id} onPress={onRemove} />
          ) : null}
        </View>
        <JournalTimeChips createdAt={block.createdAt} updatedAt={block.updatedAt} />
      </View>
    </Card>
  );
}

export function JournalBlockList({
  blocks,
  editingBlockId,
  onEditingBlockIdChange,
  onOpenLink,
  onRemove,
  onUpdateText,
  showDeletes,
}: {
  blocks: readonly JournalBlock[];
  editingBlockId: string | null;
  onEditingBlockIdChange: (blockId: string | null) => void;
  onOpenLink: (section: string) => void;
  onRemove: (blockId: string) => void;
  onUpdateText: (blockId: string, text: string) => void;
  showDeletes: boolean;
}) {
  const { spacing, s } = useResponsive();

  if (!blocks.length) {
    return (
      <AgentTestId testID={AgentUiIds.journal.empty}>
        <EmptyState
          icon="journal"
          title="Today Is Open"
          message="Type a thought, dictate, or drop a voice note. Link a section when you want to jump."
        />
      </AgentTestId>
    );
  }

  return (
    <View style={{ gap: spacing.sm }}>
      {blocks.map((block) => {
        const remove = () =>
          confirmDestructiveAction({
            title: 'Remove This Block?',
            message: 'It leaves this page only. Nothing else in onTrack changes.',
            confirmTestID: AgentUiIds.journal.blockRemove(block.id),
            onConfirm: () => onRemove(block.id),
          });

        if (block.kind === 'text') {
          return (
            <JournalTextBlockCard
              key={block.id}
              block={block}
              editing={editingBlockId === block.id}
              onBeginEdit={() => onEditingBlockIdChange(block.id)}
              onEndEdit={() => onEditingBlockIdChange(null)}
              onSave={(text) => onUpdateText(block.id, text)}
              onRemove={remove}
              showDelete={showDeletes}
            />
          );
        }

        if (block.kind === 'voice') {
          return (
            <Card
              key={block.id}
              airy
              testID={AgentUiIds.journal.block(block.id)}
              onPress={() => {
                Keyboard.dismiss();
                onEditingBlockIdChange(null);
              }}>
              <View style={{ gap: spacing.xs }}>
                <View style={[styles.voiceRow, { gap: spacing.sm }]}>
                  <GlassIconWell size={Math.max(40, s(40))}>
                    <AppText variant="caption" color="secondary">
                      {formatVoiceDuration(block.durationMs)}
                    </AppText>
                  </GlassIconWell>
                  <View style={styles.voiceCopy}>
                    <AppText variant="callout" fit>
                      Voice Note
                    </AppText>
                    <GlassMetaChip>
                      <AppText variant="caption" color="secondary">
                        {formatVoiceDuration(block.durationMs)}
                      </AppText>
                    </GlassMetaChip>
                  </View>
                  {typeof audioApi?.useAudioPlayer === 'function' ? (
                    <VoicePlayControl
                      uri={block.uri}
                      testID={AgentUiIds.journal.voicePlay(block.id)}
                    />
                  ) : (
                    <AppText variant="caption" color="secondary">
                      Playback needs the latest app build.
                    </AppText>
                  )}
                  {showDeletes ? (
                    <JournalBlockDelete blockId={block.id} onPress={remove} />
                  ) : null}
                </View>
                <JournalTimeChips createdAt={block.createdAt} updatedAt={block.updatedAt} />
              </View>
            </Card>
          );
        }

        return (
          <Card
            key={block.id}
            airy
            testID={AgentUiIds.journal.block(block.id)}
            onPress={() => {
              Keyboard.dismiss();
              onEditingBlockIdChange(null);
            }}>
            <View style={{ gap: spacing.xs }}>
              <View style={[styles.textRow, { gap: spacing.xs }]}>
                <ActionChip
                  label={block.label}
                  icon="link"
                  testID={AgentUiIds.journal.link(block.id)}
                  onPress={() => onOpenLink(block.section)}
                />
                {showDeletes ? (
                  <JournalBlockDelete blockId={block.id} onPress={remove} />
                ) : null}
              </View>
              <JournalTimeChips createdAt={block.createdAt} updatedAt={block.updatedAt} />
            </View>
          </Card>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  voiceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: 0,
  },
  voiceCopy: {
    flex: 1,
    minWidth: 0,
    gap: 6,
  },
  textRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: 0,
  },
  textCopy: {
    flex: 1,
    minWidth: 0,
  },
  editField: {
    width: '100%',
    minWidth: 0,
  },
});
