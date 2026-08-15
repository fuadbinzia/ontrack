import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import {
  ActionChip,
  Button,
  Input,
  SheetScaffold,
} from '@/components/primitives';
import { useResponsive } from '@/hooks/use-responsive';
import { AgentUiIds } from '@/utils/agent-ui';

import {
  dayAddSheetCopy,
  type DayAddComposeKind,
} from './day-add-sheet-copy';

export function DayAddSheet({
  visible,
  onClose,
  onEvent,
  onMeal,
  onChecklist,
  onJournal,
  mealEnabled,
  journalEnabled,
}: {
  visible: boolean;
  onClose: () => void;
  onEvent: () => void;
  onMeal: () => void;
  onChecklist: (title: string) => void;
  onJournal: (text: string) => void;
  mealEnabled: boolean;
  journalEnabled: boolean;
}) {
  const { spacing } = useResponsive();
  const [compose, setCompose] = useState<DayAddComposeKind>(null);
  const [draft, setDraft] = useState('');
  const copy = dayAddSheetCopy(compose);

  const reset = () => {
    setCompose(null);
    setDraft('');
  };

  const close = () => {
    reset();
    onClose();
  };

  const submit = () => {
    const text = draft.trim();
    if (!text || !compose) return;
    if (compose === 'checklist') onChecklist(text);
    else onJournal(text);
    reset();
    onClose();
  };

  return (
    <SheetScaffold
      visible={visible}
      title={copy.title}
      subtitle={copy.subtitle}
      onClose={close}
      closeTestID={AgentUiIds.today.addSheet.close}
      backdropTestID={AgentUiIds.today.addSheet.sheet}
      fitContent
    >
      {compose ? (
        <View style={{ gap: spacing.sm }}>
          <Input
            value={draft}
            onChangeText={setDraft}
            placeholder={compose === 'checklist' ? 'Item' : 'What is on your mind?'}
            testID={AgentUiIds.today.addSheet.field}
            autoFocus
            returnKeyType="done"
            onSubmitEditing={submit}
          />
          <Button
            testID={AgentUiIds.today.addSheet.submit}
            onPress={submit}
            disabled={!draft.trim()}
          >
            Save
          </Button>
        </View>
      ) : (
        <View style={[styles.wrap, { gap: spacing.sm }]}>
          <ActionChip
            label="Event"
            testID={AgentUiIds.today.addEvent}
            onPress={() => {
              close();
              onEvent();
            }}
          />
          {mealEnabled ? (
            <ActionChip
              label="Meal"
              testID={AgentUiIds.today.addMeal}
              onPress={() => {
                close();
                onMeal();
              }}
            />
          ) : null}
          <ActionChip
            label="Checklist Item"
            testID={AgentUiIds.today.addChecklist}
            onPress={() => setCompose('checklist')}
          />
          {journalEnabled ? (
            <ActionChip
              label="Journal Line"
              testID={AgentUiIds.today.addJournal}
              onPress={() => setCompose('journal')}
            />
          ) : null}
        </View>
      )}
    </SheetScaffold>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
});
