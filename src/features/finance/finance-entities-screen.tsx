import { useState } from 'react';
import { View } from 'react-native';

import {
  AppText,
  Button,
  Card,
  EmptyState,
  Input,
  Screen,
} from '@/components/primitives';
import { ChipRow } from '@/components/shared';
import { useResponsive } from '@/hooks/use-responsive';
import { createFinanceEntity, useFinance } from '@/store/finance';
import { AgentTestId, AgentUiIds } from '@/utils/agent-ui';

import { FinanceSubpageHeader } from './finance-subpage-header';
import { FINANCE_ENTITY_KINDS, type FinanceEntityKind } from './types';

export function FinanceEntitiesScreen() {
  const { spacing: gap } = useResponsive();
  const entities = useFinance((s) => s.entities);
  const saveEntity = useFinance((s) => s.saveEntity);
  const removeEntity = useFinance((s) => s.removeEntity);

  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [kind, setKind] = useState<FinanceEntityKind>('business');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string>();

  const save = () => {
    if (!name.trim()) {
      setError('Give this a name so you can find it later.');
      return;
    }
    saveEntity(
      createFinanceEntity({
        kind,
        name: name.trim(),
        notes: notes.trim() || undefined,
      }),
    );
    setShowForm(false);
    setName('');
    setNotes('');
    setError(undefined);
  };

  return (
    <Screen refresh={false}>
      <AgentTestId testID={AgentUiIds.finance.entities.screen} label="Entities">
        <View style={{ gap: gap.md }}>
          <FinanceSubpageHeader
            title="Entities"
            subtitle="Separate personal, business, and property spending for books and tax prep."
            trailing={
              <Button
                size="sm"
                onPress={() => setShowForm((v) => !v)}
                testID={AgentUiIds.finance.entities.add}>
                Add
              </Button>
            }
          />

          {showForm ? (
            <Card>
              <View style={{ gap: gap.md }}>
                <Input
                  label="Name"
                  value={name}
                  onChangeText={setName}
                  testID={AgentUiIds.finance.entities.name}
                />
                <ChipRow
                  options={FINANCE_ENTITY_KINDS.map((k) => ({ value: k, label: k }))}
                  selected={kind}
                  onSelect={setKind}
                  testIDForOption={(k) => AgentUiIds.finance.entities.kind(k)}
                />
                <Input label="Notes" value={notes} onChangeText={setNotes} />
                {error ? (
                  <AppText variant="caption" color="danger">
                    {error}
                  </AppText>
                ) : null}
                <Button onPress={save} testID={AgentUiIds.finance.entities.save}>
                  Save entity
                </Button>
              </View>
            </Card>
          ) : null}

          {entities.length ? (
            entities.map((entity) => (
              <Card key={entity.id} testID={AgentUiIds.finance.entities.row(entity.id)}>
                <View style={{ gap: gap.sm }}>
                  <AppText variant="callout" fit>
                    {entity.name}
                  </AppText>
                  <AppText variant="caption" color="secondary" fit>
                    {entity.kind}
                    {entity.notes ? ` · ${entity.notes}` : ''}
                  </AppText>
                  {entity.kind !== 'personal' ? (
                    <Button
                      size="sm"
                      variant="ghost"
                      onPress={() => removeEntity(entity.id)}
                    >
                      Delete
                    </Button>
                  ) : null}
                </View>
              </Card>
            ))
          ) : (
            <EmptyState
              icon="finance"
              title="No entities"
              message="Add a business or property to track owner expenses."
            />
          )}
        </View>
      </AgentTestId>
    </Screen>
  );
}
