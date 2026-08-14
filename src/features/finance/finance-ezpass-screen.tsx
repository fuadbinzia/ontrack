import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { View } from 'react-native';

import {
  AppText,
  appPrompt,
  Button,
  Card,
  CollapsibleSection,
  EmptyState,
  IconButton,
  Screen,
  SectionHeader,
  fieldTitleCase,
} from '@/components/primitives';
import { ChipRow } from '@/components/shared';
import { PeoplePicker } from '@/features/social/people-picker';
import { formatMoney } from '@/features/travel/expenses/format-money';
import { useEzPassCollaboration } from '@/hooks/use-ezpass-collaboration';
import { useResponsive } from '@/hooks/use-responsive';
import {
  addEzPassFriendMembers,
  tagEzPassSharedTransaction,
} from '@/services/finance/ezpass-collaboration';
import { useFinanceEzPassStatements } from '@/store/finance-ezpass-statements';
import { useFinance } from '@/store/finance';
import { AgentTestId, AgentUiIds } from '@/utils/agent-ui';
import { formatDateLong, formatWeekday } from '@/utils/date';

import {
  ezPassLedgerLabel,
  sharedEzPassActivities,
  type EzPassLedgerActivity,
} from './ezpass-collaboration-model';
import { FinanceEzPassFriendTag } from './finance-ezpass-friend-tag';
import { FinanceEzPassOverviewCard } from './finance-ezpass-overview-card';
import { FinanceEzPassStatementFiles } from './finance-ezpass-statement-files';
import { displayEzPassMerchantName } from './ezpass-locations';
import {
  buildEzPassFinanceSummary,
  buildEzPassMonthlySeries,
  ezPassFriendFilterOptions,
  filterEzPassActivitiesByDriver,
  formatEzPassActivityTime,
  groupEzPassActivitiesByDay,
  type EzPassDriverFilter,
} from './ezpass-model';
import { FinanceSubpageHeader } from './finance-subpage-header';

export function FinanceEzPassScreen() {
  const router = useRouter();
  const { spacing: gap } = useResponsive();
  const transactions = useFinance((state) => state.transactions);
  const baseCurrency = useFinance((state) => state.baseCurrency);
  const saveTransaction = useFinance((state) => state.saveTransaction);
  const repairEzPassDuplicates = useFinance((state) => state.repairEzPassDuplicates);
  const statements = useFinanceEzPassStatements((state) => state.statements);
  const collaboration = useEzPassCollaboration(transactions);
  const [driverFilter, setDriverFilter] = useState<EzPassDriverFilter>('all');
  const [taggingTransactionId, setTaggingTransactionId] = useState<string>();
  const [pickingMembers, setPickingMembers] = useState(false);
  const [requestedLedgerId, setRequestedLedgerId] = useState<string>();
  const [requestedMonthKey, setRequestedMonthKey] = useState<string>();
  const now = useMemo(() => new Date(), []);

  useEffect(() => {
    repairEzPassDuplicates();
  }, [repairEzPassDuplicates]);

  const defaultLedger =
    collaboration.ledgers.find((ledger) => ledger.role === 'owner') ?? collaboration.ledgers[0];
  const activeLedger =
    collaboration.ledgers.find((ledger) => ledger.id === requestedLedgerId) ?? defaultLedger;
  const activeActivities = useMemo<EzPassLedgerActivity[]>(
    () =>
      activeLedger
        ? sharedEzPassActivities(activeLedger)
        : transactions.filter((transaction) => transaction.source === 'ezpass'),
    [activeLedger, transactions],
  );
  const summary = useMemo(
    () => buildEzPassFinanceSummary(activeActivities, now),
    [activeActivities, now],
  );
  const chartAnchor = useMemo(
    () => (summary.activities[0] ? new Date(`${summary.activities[0].date}T12:00:00`) : now),
    [now, summary.activities],
  );
  const driverOptions = useMemo(
    () =>
      ezPassFriendFilterOptions(
        summary.activities,
        activeLedger?.members.filter((member) => member.role === 'member') ?? [],
      ),
    [activeLedger?.members, summary.activities],
  );
  const activeDriverFilter = driverOptions.some((option) => option.value === driverFilter)
    ? driverFilter
    : 'all';
  const filteredActivities = useMemo(
    () =>
      activeLedger?.role === 'member' && activeDriverFilter === 'mine' && collaboration.userId
        ? filterEzPassActivitiesByDriver(summary.activities, `friend:${collaboration.userId}`)
        : filterEzPassActivitiesByDriver(summary.activities, activeDriverFilter),
    [activeDriverFilter, activeLedger?.role, collaboration.userId, summary.activities],
  );
  const filteredSummary = useMemo(
    () => buildEzPassFinanceSummary(filteredActivities, now),
    [filteredActivities, now],
  );
  const monthlySeries = useMemo(
    () => buildEzPassMonthlySeries(filteredActivities, 6, chartAnchor),
    [chartAnchor, filteredActivities],
  );
  const selectedMonth =
    monthlySeries.find((point) => point.key === requestedMonthKey) ?? monthlySeries.at(-1);
  const selectedSummary = useMemo(
    () =>
      buildEzPassFinanceSummary(
        filteredActivities.filter((transaction) =>
          transaction.date.startsWith(selectedMonth?.key ?? ''),
        ),
        chartAnchor,
      ),
    [chartAnchor, filteredActivities, selectedMonth?.key],
  );
  const taggingTransaction = activeActivities.find(
    (transaction) => transaction.id === taggingTransactionId,
  );
  const upload = () => router.push('/(tabs)/finance/ezpass-import');
  const share = () => {
    if (collaboration.authenticated) {
      setPickingMembers(true);
      return;
    }
    router.push({
      pathname: '/account',
      params: { returnTo: '/finance/ezpass' },
    } as never);
  };

  const updateSharedTag = async (transaction: EzPassLedgerActivity, userId?: string) => {
    if (!transaction.ezPassLedgerId || !transaction.ezPassSharedTransactionId) return;
    try {
      await tagEzPassSharedTransaction({
        ledgerId: transaction.ezPassLedgerId,
        transactionId: transaction.ezPassSharedTransactionId,
        userId,
      });
      const local = transactions.find(
        (candidate) => candidate.id === transaction.ezPassSharedTransactionId,
      );
      const member = activeLedger?.members.find((candidate) => candidate.userId === userId);
      if (local && activeLedger?.role === 'owner') {
        saveTransaction({
          ...local,
          ezPassFriendId: userId,
          ezPassFriendName: member?.displayName,
        });
      }
      await collaboration.refresh();
    } catch (caught) {
      appPrompt.alert(
        'Tag Not Saved',
        caught instanceof Error ? caught.message : 'That E-ZPass activity could not be tagged.',
      );
    }
  };

  const openTagging = (transaction: EzPassLedgerActivity) => {
    if (activeLedger?.role !== 'member') {
      setTaggingTransactionId(transaction.id);
      return;
    }
    if (!collaboration.userId) return;
    if (transaction.ezPassFriendId && transaction.ezPassFriendId !== collaboration.userId) {
      appPrompt.alert('Already Tagged', 'That activity belongs to another driver.');
      return;
    }
    void updateSharedTag(
      transaction,
      transaction.ezPassFriendId === collaboration.userId ? undefined : collaboration.userId,
    );
  };

  const clearFriendTag = () => {
    if (!taggingTransaction) return;
    if (taggingTransaction.ezPassLedgerId) {
      void updateSharedTag(taggingTransaction, undefined);
    } else {
      saveTransaction({
        ...taggingTransaction,
        ezPassFriendId: undefined,
        ezPassFriendName: undefined,
      });
    }
    setTaggingTransactionId(undefined);
  };

  const activityRows = (rows: EzPassLedgerActivity[]) => (
    <View style={{ gap: gap.lg }}>
      {groupEzPassActivitiesByDay(rows).map((day) => (
        <View
          key={day.date}
          testID={AgentUiIds.finance.ezpass.day(day.date)}
          style={{ gap: gap.sm }}
        >
          <SectionHeader
            title={`${formatWeekday(day.date)} · ${formatDateLong(day.date)}`}
            detail={`${day.transactions.length} ${day.transactions.length === 1 ? 'activity' : 'activities'}`}
            flush
          />
          <View style={{ gap: gap.md }}>
            {day.transactions.map((transaction) => (
              <View
                key={transaction.id}
                testID={AgentUiIds.finance.ezpass.activityRow(transaction.id)}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: gap.sm,
                }}
              >
                <View style={{ flex: 1, minWidth: 0, gap: gap.xs }}>
                  <AppText variant="callout" fit numberOfLines={1}>
                    {displayEzPassMerchantName(transaction.merchant)}
                  </AppText>
                  {transaction.activityTime ? (
                    <AppText variant="caption" color="secondary" fit titleCase>
                      {formatEzPassActivityTime(transaction.activityTime)}
                    </AppText>
                  ) : null}
                </View>
                <FinanceEzPassFriendTag
                  transaction={transaction}
                  onPress={() => openTagging(transaction)}
                />
                <AppText
                  variant="callout"
                  color={transaction.activity === 'refund' ? 'success' : 'primary'}
                  fit
                >
                  {formatMoney(transaction.amount, transaction.currency)}
                </AppText>
              </View>
            ))}
          </View>
        </View>
      ))}
    </View>
  );

  return (
    <>
      <Screen>
        <AgentTestId testID={AgentUiIds.finance.ezpass.home} label="E-ZPass">
          <View style={{ gap: gap.lg }}>
            <FinanceSubpageHeader
              title="E-ZPass"
              subtitle="Private tolls, refunds, and shared trips—organized by month."
              trailing={
                summary.activities.length ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: gap.sm }}>
                    {activeLedger?.role !== 'member' ? (
                      <IconButton
                        icon="share"
                        accessibilityLabel="Share E-ZPass Ledger"
                        onPress={share}
                        disabled={collaboration.loading}
                        testID={AgentUiIds.finance.ezpass.share}
                      />
                    ) : null}
                    <IconButton
                      icon="upload"
                      accessibilityLabel="Upload E-ZPass Statement"
                      onPress={upload}
                      testID={AgentUiIds.finance.ezpass.upload}
                    />
                  </View>
                ) : undefined
              }
            />

            {collaboration.ledgers.length > 1 ? (
              <Card variant="sunken">
                <View style={{ gap: gap.sm }}>
                  <SectionHeader title="E-ZPass Ledger" detail="Choose Activity" flush />
                  <ChipRow
                    options={collaboration.ledgers.map((ledger) => ({
                      value: ledger.id,
                      label: ezPassLedgerLabel(ledger, collaboration.userId),
                    }))}
                    selected={activeLedger?.id ?? ''}
                    onSelect={setRequestedLedgerId}
                    scrollable
                    testIDForOption={AgentUiIds.finance.ezpass.ledger}
                  />
                </View>
              </Card>
            ) : null}

            {summary.activities.length ? (
              <>
                <FinanceEzPassOverviewCard
                  summary={filteredSummary}
                  currency={baseCurrency}
                  points={monthlySeries}
                  selectedMonthKey={selectedMonth?.key ?? ''}
                  driverOptions={driverOptions}
                  selectedDriver={activeDriverFilter}
                  onSelectDriver={setDriverFilter}
                  onSelectMonth={setRequestedMonthKey}
                  driverHint={
                    activeLedger?.role === 'member'
                      ? 'Tap the person icon on an activity to tag or untag yourself.'
                      : 'Tap the person icon on an activity to assign it to a shared driver.'
                  }
                />
                <ActivitySections
                  summary={selectedSummary}
                  currency={baseCurrency}
                  selectedMonthLabel={selectedMonth?.fullLabel}
                  renderRows={activityRows}
                />
              </>
            ) : (
              <Card>
                <SectionHeader title="Transaction History" flush />
                <EmptyState
                  icon="finance"
                  title="No E-ZPass History Yet"
                  message={
                    activeLedger?.role === 'member'
                      ? 'The owner has not shared any E-ZPass activity yet.'
                      : 'Upload a CSV, spreadsheet, PDF statement, or screenshots to build your road ledger.'
                  }
                  actionLabel={
                    activeLedger?.role === 'member' ? undefined : 'Upload Transaction History'
                  }
                  onAction={activeLedger?.role === 'member' ? undefined : upload}
                  actionTestID={
                    activeLedger?.role === 'member'
                      ? undefined
                      : AgentUiIds.finance.ezpass.emptyUpload
                  }
                />
              </Card>
            )}

            {activeLedger?.role !== 'member' ? (
              <FinanceEzPassStatementFiles statements={statements} />
            ) : null}
          </View>
        </AgentTestId>
      </Screen>

      <PeoplePicker
        visible={Boolean(taggingTransaction)}
        onClose={() => setTaggingTransactionId(undefined)}
        onConfirm={(picked) => {
          const friend = picked[0];
          if (!taggingTransaction || !friend) return;
          if (taggingTransaction.ezPassLedgerId) {
            void updateSharedTag(taggingTransaction, friend.userId);
          } else {
            saveTransaction({
              ...taggingTransaction,
              ezPassFriendId: friend.userId,
              ezPassFriendName: friend.displayName,
            });
          }
        }}
        multi={false}
        includeIds={activeLedger?.members
          .filter((member) => member.role === 'member')
          .map((member) => member.userId)}
        title="Who Used This Pass?"
        confirmLabel="Assign"
        headerContent={
          taggingTransaction?.ezPassFriendId ? (
            <Button
              size="sm"
              variant="secondary"
              onPress={clearFriendTag}
              testID={AgentUiIds.finance.ezpass.friendClear}
            >
              Mark As Mine
            </Button>
          ) : (
            <AppText variant="caption" color="secondary">
              Choose a driver who has access to this E-ZPass ledger.
            </AppText>
          )
        }
      />

      <PeoplePicker
        visible={pickingMembers}
        onClose={() => setPickingMembers(false)}
        onConfirm={(friends) => {
          void (async () => {
            try {
              await addEzPassFriendMembers(friends.map((friend) => friend.userId));
              await collaboration.refresh({ syncOwned: true });
              appPrompt.alert(
                'Friend Added',
                'They can now open this E-ZPass ledger on their own device and tag themselves.',
              );
            } catch (caught) {
              appPrompt.alert(
                'Friend Not Added',
                caught instanceof Error ? caught.message : 'That friend could not be added.',
              );
            }
          })();
        }}
        excludeIds={activeLedger?.members.map((member) => member.userId) ?? []}
        title="Add E-ZPass Friend"
        confirmLabel="Add"
        presentation="searchable-dropdown"
        headerContent={
          <AppText variant="caption" color="secondary">
            Added friends can see this E-ZPass activity on their device and may tag only themselves.
          </AppText>
        }
      />
    </>
  );
}

function ActivitySections({
  summary,
  currency,
  selectedMonthLabel,
  renderRows,
}: {
  summary: ReturnType<typeof buildEzPassFinanceSummary>;
  currency: string;
  selectedMonthLabel?: string;
  renderRows: (rows: EzPassLedgerActivity[]) => ReactNode;
}) {
  const sections = [
    {
      title: 'Tolls & Refunds',
      rows: summary.roadActivities,
      total: summary.spendTotal,
      id: AgentUiIds.finance.ezpass.roadActivity,
    },
    {
      title: 'Replenishments',
      rows: summary.replenishments,
      total: summary.replenishmentTotal,
      id: AgentUiIds.finance.ezpass.replenishments,
    },
  ];
  return (
    <>
      {sections.map((section) =>
        section.rows.length ? (
          <Card key={section.title} variant="sunken">
            <CollapsibleSection
              title={section.title}
              defaultExpanded
              detail={formatMoney(section.total, currency)}
              description={fieldTitleCase(
                `${formatMoney(section.total, currency)} · ${section.rows.length} ${section.rows.length === 1 ? 'activity' : 'activities'}`,
              )}
              testID={section.id}
            >
              {renderRows(section.rows as EzPassLedgerActivity[])}
            </CollapsibleSection>
          </Card>
        ) : null,
      )}
      {!summary.activities.length && selectedMonthLabel ? (
        <Card>
          <EmptyState
            icon="finance"
            title={`No Activity In ${selectedMonthLabel}`}
            message="Tap another month in the graph to view its E-ZPass activity."
          />
        </Card>
      ) : null}
    </>
  );
}
