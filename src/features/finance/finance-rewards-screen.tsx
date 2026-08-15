import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import {
  appPrompt,
  AppText,
  Button,
  Card,
  DateField,
  Dropdown,
  EmptyState,
  PanelTitle,
  Screen,
  SectionHeader,
  StatusBadge,
} from '@/components/primitives';
import { ChipRow } from '@/components/shared';
import { formatMoney } from '@/features/travel/expenses/format-money';
import { useResponsive } from '@/hooks/use-responsive';
import { useFinance } from '@/store/finance';
import { AgentTestId, AgentUiIds } from '@/utils/agent-ui';
import { fromDateKey, toDateKey, todayKey } from '@/utils/date';

import { createFinanceRewardProfile, personalEntityId } from './create';
import { FinanceRewardLinkSheet } from './finance-reward-link-sheet';
import { FinanceRewardProfileSheet } from './finance-reward-profile-sheet';
import { FinanceRewardsCsvSheet } from './finance-rewards-csv-sheet';
import { analyzeFinanceRewards } from './rewards-engine';
import type {
  FinanceRewardCardProfile,
  FinanceRewardProfileDraft,
} from './rewards-types';

type RangeKey = '30d' | '90d' | 'ytd' | '12m' | 'custom';

const RANGE_OPTIONS: { value: RangeKey; label: string }[] = [
  { value: '30d', label: '30 Days' },
  { value: '90d', label: '90 Days' },
  { value: 'ytd', label: 'YTD' },
  { value: '12m', label: '12 Months' },
  { value: 'custom', label: 'Custom' },
];

function subtractDays(key: string, days: number): string {
  const date = fromDateKey(key);
  date.setDate(date.getDate() - days);
  return toDateKey(date);
}

function rangeDates(range: RangeKey, customFrom: string, customTo: string) {
  const to = todayKey();
  if (range === 'custom') return { from: customFrom, to: customTo };
  if (range === '30d') return { from: subtractDays(to, 29), to };
  if (range === '90d') return { from: subtractDays(to, 89), to };
  if (range === 'ytd') return { from: `${to.slice(0, 4)}-01-01`, to };
  return { from: subtractDays(to, 364), to };
}

export function FinanceRewardsScreen() {
  const { spacing, s } = useResponsive();
  const accounts = useFinance((state) => state.accounts);
  const transactions = useFinance((state) => state.transactions);
  const profiles = useFinance((state) => state.rewardProfiles);
  const entities = useFinance((state) => state.entities);
  const baseCurrency = useFinance((state) => state.baseCurrency);
  const saveRewardProfile = useFinance((state) => state.saveRewardProfile);
  const saveTransactions = useFinance((state) => state.saveTransactions);
  const [range, setRange] = useState<RangeKey>('12m');
  const [customFrom, setCustomFrom] = useState(subtractDays(todayKey(), 364));
  const [customTo, setCustomTo] = useState(todayKey());
  const [profileOpen, setProfileOpen] = useState(false);
  const [linkOpen, setLinkOpen] = useState(false);
  const [csvOpen, setCsvOpen] = useState(false);
  const [profileInput, setProfileInput] = useState<FinanceRewardCardProfile | FinanceRewardProfileDraft>();
  const [compareLeft, setCompareLeft] = useState('');
  const [compareRight, setCompareRight] = useState('');
  const dates = rangeDates(range, customFrom, customTo);
  const analysis = useMemo(() => analyzeFinanceRewards({
    accounts,
    transactions,
    profiles,
    from: dates.from,
    to: dates.to,
    currency: 'USD',
  }), [accounts, dates.from, dates.to, profiles, transactions]);
  const results = useMemo(
    () => new Map(analysis.profileResults.map((result) => [result.profileId, result])),
    [analysis.profileResults],
  );
  const profileById = useMemo(
    () => new Map(profiles.map((profile) => [profile.id, profile])),
    [profiles],
  );
  const accountProfile = useMemo(
    () => new Map(accounts.flatMap((account) =>
      account.rewardProfileId ? [[account.id, account.rewardProfileId] as const] : [],
    )),
    [accounts],
  );
  const opportunities = useMemo(() => transactions
    .filter((transaction) =>
      transaction.date >= dates.from &&
      transaction.date <= dates.to &&
      transaction.currency === 'USD' &&
      (transaction.activity ?? 'expense') === 'expense',
    )
    .flatMap((transaction) => {
      const actualProfileId = transaction.accountId
        ? accountProfile.get(transaction.accountId)
        : undefined;
      const actual = actualProfileId
        ? results.get(actualProfileId)?.transactionResults.find(
            (row) => row.transactionId === transaction.id,
          )
        : undefined;
      const best = profiles
        .filter((profile) => profile.ownership === 'owned')
        .flatMap((profile) => {
          const row = results.get(profile.id)?.transactionResults.find(
            (candidate) => candidate.transactionId === transaction.id,
          );
          return row ? [{ profile, row }] : [];
        })
        .sort((a, b) => b.row.value - a.row.value)[0];
      if (!best) return [];
      return [{
        transaction,
        actual,
        best,
        missed: Math.max(0, best.row.value - (actual?.value ?? 0)),
      }];
    })
    .sort((a, b) => b.missed - a.missed)
    .slice(0, 8), [accountProfile, dates.from, dates.to, profiles, results, transactions]);
  const left = compareLeft ? results.get(compareLeft) : undefined;
  const right = compareRight ? results.get(compareRight) : undefined;
  const bestAlternative = Math.max(analysis.missedWalletValue, analysis.missedMarketValue);

  const openManual = () => {
    setProfileInput(undefined);
    setProfileOpen(true);
  };

  const saveProfile = (draft: FinanceRewardProfileDraft, id?: string) => {
    const existing = id ? profileById.get(id) : undefined;
    saveRewardProfile(existing
      ? { ...existing, ...draft, id: existing.id, createdAt: existing.createdAt, updatedAt: new Date().toISOString() }
      : createFinanceRewardProfile(draft));
    setProfileOpen(false);
    setProfileInput(undefined);
  };

  const cardOptions = profiles.map((profile) => ({
    value: profile.id,
    label: `${profile.name} · ${profile.ownership === 'owned' ? 'Wallet' : 'Market'}`,
  }));

  return (
    <Screen>
      <AgentTestId testID={AgentUiIds.finance.rewards.screen} label="Rewards Optimizer">
        <View style={{ gap: spacing.lg }}>
          <View style={{ gap: spacing.xs }}>
            <AppText variant="title" fit>Rewards Optimizer</AppText>
            <AppText variant="caption" color="secondary">
              See what each purchase earned—and what another card could have returned.
            </AppText>
          </View>

          <AgentTestId testID={AgentUiIds.finance.rewards.hero} label="Rewards Opportunity">
            <Card>
              <View style={{ gap: spacing.sm }}>
                <AppText variant="overline" color="accent" fit>Potential Value Left Behind</AppText>
                <AppText variant="display" fit>{formatMoney(bestAlternative, baseCurrency)}</AppText>
                <AppText variant="caption" color="secondary">
                  Your estimated earned value is {formatMoney(analysis.actualValue, baseCurrency)}.
                  Results depend on merchant coding and the assumptions in each card profile.
                </AppText>
                <View style={styles.metricRow}>
                  <StatusBadge
                    label={`Wallet +${formatMoney(analysis.missedWalletValue, baseCurrency)}`}
                    tone={analysis.missedWalletValue > 0 ? 'success' : 'neutral'}
                  />
                  <StatusBadge
                    label={`Market +${formatMoney(analysis.missedMarketValue, baseCurrency)}`}
                    tone={analysis.missedMarketValue > 0 ? 'warning' : 'neutral'}
                  />
                </View>
              </View>
            </Card>
          </AgentTestId>

          <View style={{ gap: spacing.sm }}>
            <AppText variant="overline" color="secondary" fit>Analysis Window</AppText>
            <ChipRow
              options={RANGE_OPTIONS}
              selected={range}
              onSelect={setRange}
              scrollable
              testIDForOption={(value) => AgentUiIds.finance.rewards.range(value)}
            />
            {range === 'custom' ? (
              <View style={[styles.metricRow, { gap: spacing.sm }]}>
                <View style={styles.flex}>
                  <DateField
                    stackedLabel="From"
                    value={customFrom}
                    maximumDate={customTo}
                    onChange={setCustomFrom}
                    testID={AgentUiIds.finance.rewards.customFrom}
                  />
                </View>
                <View style={styles.flex}>
                  <DateField
                    stackedLabel="To"
                    value={customTo}
                    minimumDate={customFrom}
                    maximumDate={todayKey()}
                    onChange={setCustomTo}
                    testID={AgentUiIds.finance.rewards.customTo}
                  />
                </View>
              </View>
            ) : null}
          </View>

          <View style={[styles.actionRow, { gap: spacing.sm }]}>
            <Button size="sm" icon="add" onPress={openManual} testID={AgentUiIds.finance.rewards.addManual}>
              Add Card
            </Button>
            <Button
              size="sm"
              icon="link"
              variant="secondary"
              onPress={() => setLinkOpen(true)}
              testID={AgentUiIds.finance.rewards.createFromLink}>
              Create From Link
            </Button>
            <Button
              size="sm"
              icon="upload"
              variant="secondary"
              onPress={() => setCsvOpen(true)}
              testID={AgentUiIds.finance.rewards.importCsv}>
              Import CSV
            </Button>
          </View>

          <AgentTestId testID={AgentUiIds.finance.rewards.profilesSection} label="Reward Profiles">
            <View style={{ gap: spacing.sm }}>
              <SectionHeader title="Cards In The Model" flush />
              {profiles.length ? profiles.map((profile) => {
                const result = results.get(profile.id);
                return (
                  <Card
                    key={profile.id}
                    onPress={() => {
                      setProfileInput(profile);
                      setProfileOpen(true);
                    }}
                    accessibilityLabel={`Edit ${profile.name}`}
                    testID={AgentUiIds.finance.rewards.profile(profile.id)}>
                    <View style={[styles.metricRow, { gap: spacing.sm }]}>
                      <View style={styles.flex}>
                        <PanelTitle>{profile.name}</PanelTitle>
                        <AppText variant="caption" color="secondary" fit numberOfLines={1}>
                          {profile.issuer} · {profile.baseMultiplier}x base · {profile.pointValueCents}¢/{profile.rewardCurrency}
                        </AppText>
                      </View>
                      <View style={{ alignItems: 'flex-end', gap: spacing.xs }}>
                        <AppText variant="callout" fit>{formatMoney(result?.value ?? 0, baseCurrency)}</AppText>
                        <StatusBadge
                          label={profile.ownership === 'owned' ? 'Wallet' : 'Market'}
                          tone={profile.ownership === 'owned' ? 'success' : 'neutral'}
                        />
                      </View>
                    </View>
                  </Card>
                );
              }) : (
                <EmptyState
                  icon="finance"
                  title="No Reward Profiles"
                  message="Add a card manually or create one from a public card link."
                />
              )}
            </View>
          </AgentTestId>

          {opportunities.length ? (
            <AgentTestId
              testID={AgentUiIds.finance.rewards.transactionsSection}
              label="Transaction Reward Explanations">
              <Card>
                <View style={{ gap: spacing.md }}>
                  <SectionHeader title="Purchase-Level Opportunities" flush />
                  {opportunities.map(({ transaction, actual, best, missed }) => (
                    <AgentTestId
                      key={transaction.id}
                      testID={AgentUiIds.finance.rewards.transaction(transaction.id)}
                      label={`${transaction.merchant} reward comparison`}>
                      <View style={[styles.metricRow, { gap: spacing.sm }]}>
                        <View style={styles.flex}>
                          <AppText variant="callout" fit numberOfLines={1}>{transaction.merchant}</AppText>
                          <AppText variant="caption" color="secondary" numberOfLines={2}>
                            Used: {actual ? `${actual.multiplier}x · ${formatMoney(actual.value, baseCurrency)}` : 'no linked profile'}
                            {' · '}Best: {best.profile.name} at {best.row.multiplier}x
                            {' · '}{best.row.confidence} confidence
                          </AppText>
                        </View>
                        <AppText
                          variant="callout"
                          color={missed > 0 ? 'accent' : 'secondary'}
                          fit>
                          +{formatMoney(missed, baseCurrency)}
                        </AppText>
                      </View>
                    </AgentTestId>
                  ))}
                </View>
              </Card>
            </AgentTestId>
          ) : null}

          {profiles.length >= 2 ? (
            <AgentTestId testID={AgentUiIds.finance.rewards.compareSection} label="Compare Two Cards">
              <Card>
                <View style={{ gap: spacing.md }}>
                  <SectionHeader title="Compare Two Cards" flush />
                  <Dropdown
                    label="First Card"
                    icon="finance"
                    value={compareLeft}
                    options={cardOptions}
                    onChange={setCompareLeft}
                    testID={AgentUiIds.finance.rewards.compareLeft}
                  />
                  <Dropdown
                    label="Second Card"
                    icon="finance"
                    value={compareRight}
                    options={cardOptions.filter((option) => option.value !== compareLeft)}
                    onChange={setCompareRight}
                    testID={AgentUiIds.finance.rewards.compareRight}
                  />
                  {left && right ? (
                    <View style={[styles.metricRow, { gap: spacing.md }]}>
                      {[left, right].map((result) => (
                        <View key={result.profileId} style={[styles.flex, { gap: spacing.xs }]}>
                          <AppText variant="callout" fit numberOfLines={1}>
                            {profileById.get(result.profileId)?.name}
                          </AppText>
                          <AppText variant="heading" fit>{formatMoney(result.value, baseCurrency)}</AppText>
                          <AppText variant="caption" color="secondary" fit>
                            {formatMoney(result.annualValue, baseCurrency)} ongoing annual value
                          </AppText>
                        </View>
                      ))}
                    </View>
                  ) : (
                    <AppText variant="caption" color="secondary">Choose two cards to compare.</AppText>
                  )}
                </View>
              </Card>
            </AgentTestId>
          ) : null}

          {analysis.skippedTransactionIds.length ? (
            <Card airy>
              <AppText variant="caption" color="danger">
                {analysis.skippedTransactionIds.length} non-USD transaction(s) were excluded.
              </AppText>
            </Card>
          ) : null}

          <AppText variant="caption" color="secondary" style={{ textAlign: 'center', paddingHorizontal: s(8) }}>
            Educational estimates only—not personalized financial advice. Welcome offers are shown in
            card details but never change ongoing rankings.
          </AppText>
        </View>
      </AgentTestId>

      <FinanceRewardLinkSheet
        visible={linkOpen}
        onClose={() => setLinkOpen(false)}
        onDraft={(draft) => {
          setLinkOpen(false);
          setProfileInput(draft);
          setProfileOpen(true);
        }}
      />
      <FinanceRewardProfileSheet
        visible={profileOpen}
        initial={profileInput}
        onClose={() => {
          setProfileOpen(false);
          setProfileInput(undefined);
        }}
        onSave={saveProfile}
      />
      <FinanceRewardsCsvSheet
        visible={csvOpen}
        accounts={accounts}
        entityId={personalEntityId(entities)}
        transactions={transactions}
        onClose={() => setCsvOpen(false)}
        onImport={(rows, message) => {
          saveTransactions(rows);
          setCsvOpen(false);
          appPrompt.alert('Statement Imported', message);
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  metricRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  flex: {
    flex: 1,
    minWidth: 0,
  },
});
