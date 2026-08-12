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
import { formatMoney } from '@/features/travel/expenses/format-money';
import { useResponsive } from '@/hooks/use-responsive';
import { useFinance } from '@/store/finance';
import { AgentTestId, AgentUiIds } from '@/utils/agent-ui';
import { todayKey } from '@/utils/date';
import { parsePositiveNumber } from '@/utils/parse';

import { createFinanceBucket } from './create';
import { FinanceProgressBar } from './finance-progress-bar';
import { FinanceSubpageHeader } from './finance-subpage-header';
import { bucketProgress, bucketSavedAmount } from './model';

export function FinanceBucketsScreen() {
  const { spacing: gap } = useResponsive();
  const buckets = useFinance((s) => s.buckets);
  const baseCurrency = useFinance((s) => s.baseCurrency);
  const saveBucket = useFinance((s) => s.saveBucket);
  const removeBucket = useFinance((s) => s.removeBucket);
  const addBucketContribution = useFinance((s) => s.addBucketContribution);

  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [goal, setGoal] = useState('');
  const [contributeBucketId, setContributeBucketId] = useState<string>();
  const [contributeAmount, setContributeAmount] = useState('');
  const [error, setError] = useState<string>();

  const save = () => {
    const goalAmount = parsePositiveNumber(goal);
    if (!name.trim() || goalAmount === undefined) {
      setError('Name and goal amount are required.');
      return;
    }
    saveBucket(
      createFinanceBucket({
        name: name.trim(),
        goalAmount,
        currency: baseCurrency,
      }),
    );
    setShowForm(false);
    setName('');
    setGoal('');
    setError(undefined);
  };

  const contribute = () => {
    if (!contributeBucketId) return;
    const amount = parsePositiveNumber(contributeAmount);
    if (amount === undefined) {
      setError('Enter a contribution amount.');
      return;
    }
    addBucketContribution(contributeBucketId, {
      amount,
      date: todayKey(),
    });
    setContributeBucketId(undefined);
    setContributeAmount('');
    setError(undefined);
  };

  return (
    <Screen refresh={false}>
      <AgentTestId testID={AgentUiIds.finance.buckets.screen} label="Buckets">
        <View style={{ gap: gap.md }}>
          <FinanceSubpageHeader
            title="Savings Buckets"
            subtitle="Park money for travel and other large purchases."
            trailing={
              <Button
                size="sm"
                onPress={() => setShowForm((v) => !v)}
                testID={AgentUiIds.finance.buckets.add}>
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
                  placeholder="Travel 2027"
                  testID={AgentUiIds.finance.buckets.name}
                />
                <Input
                  label="Goal"
                  value={goal}
                  onChangeText={setGoal}
                  keyboardType="decimal-pad"
                  testID={AgentUiIds.finance.buckets.goal}
                />
                {error && !contributeBucketId ? (
                  <AppText variant="caption" color="danger">
                    {error}
                  </AppText>
                ) : null}
                <Button onPress={save} testID={AgentUiIds.finance.buckets.save}>
                  Save bucket
                </Button>
              </View>
            </Card>
          ) : null}

          {buckets.length ? (
            buckets.map((bucket) => {
              const progress = bucketProgress(bucket);
              return (
                <Card key={bucket.id} testID={AgentUiIds.finance.buckets.row(bucket.id)}>
                  <View style={{ gap: gap.sm }}>
                    <AppText variant="callout" fit>
                      {bucket.name}
                    </AppText>
                    <AppText variant="caption" color="secondary" fit>
                      {formatMoney(bucketSavedAmount(bucket), bucket.currency)} of{' '}
                      {formatMoney(bucket.goalAmount, bucket.currency)}
                      {bucket.targetDate ? ` · by ${bucket.targetDate}` : ''}
                    </AppText>
                    <FinanceProgressBar progress={progress} />
                    {contributeBucketId === bucket.id ? (
                      <View style={{ gap: gap.sm }}>
                        <Input
                          label="Contribution"
                          value={contributeAmount}
                          onChangeText={setContributeAmount}
                          keyboardType="decimal-pad"
                          testID={AgentUiIds.finance.buckets.contributeAmount}
                        />
                        <Button
                          size="sm"
                          onPress={contribute}
                          testID={AgentUiIds.finance.buckets.contribute}>
                          Add contribution
                        </Button>
                      </View>
                    ) : (
                      <View style={{ flexDirection: 'row', gap: gap.sm }}>
                        <Button
                          size="sm"
                          variant="secondary"
                          onPress={() => setContributeBucketId(bucket.id)}
                          testID={AgentUiIds.finance.buckets.contribute}
                        >
                          Contribute
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onPress={() => removeBucket(bucket.id)}
                        >
                          Delete
                        </Button>
                      </View>
                    )}
                  </View>
                </Card>
              );
            })
          ) : (
            <EmptyState
              icon="finance"
              title="No buckets"
              message="Create a bucket for a trip, home project, or big purchase."
            />
          )}
        </View>
      </AgentTestId>
    </Screen>
  );
}
