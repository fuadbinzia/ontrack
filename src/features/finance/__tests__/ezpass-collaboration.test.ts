import fs from 'node:fs';
import path from 'node:path';

import {
  ezPassLedgerLabel,
  sharedEzPassActivities,
} from '../ezpass-collaboration-model';
import { parseEzPassSharedLedgers } from '@/services/finance/ezpass-collaboration';

const snapshot = [{
  id: 'ledger-synthetic',
  ownerUserId: 'owner-synthetic',
  role: 'member',
  members: [
    { userId: 'owner-synthetic', displayName: 'Alex Rivera', role: 'owner' },
    { userId: 'member-synthetic', displayName: 'Jordan Lee', role: 'member' },
  ],
  transactions: [{
    id: 'transaction-synthetic',
    date: '2026-08-13',
    activityTime: '16:25:15',
    merchant: 'UNI - Union',
    amount: 2.25,
    currency: 'USD',
    activity: 'expense',
    assignedUserId: 'member-synthetic',
    assignedUserName: 'Jordan Lee',
    updatedAt: '2026-08-14T12:00:00.000Z',
  }],
}];

describe('E-ZPass collaboration boundary', () => {
  it('parses only normalized shared ledger fields', () => {
    const [ledger] = parseEzPassSharedLedgers(snapshot);
    expect(ledger.members).toHaveLength(2);
    expect(ledger.transactions[0]).toMatchObject({
      id: 'transaction-synthetic',
      assignedUserName: 'Jordan Lee',
    });
    expect(ledger.transactions[0]).not.toHaveProperty('notes');
    expect(ledger.transactions[0]).not.toHaveProperty('accountId');
  });

  it("labels an owner's ledger and a friend's ledger clearly", () => {
    const [ledger] = parseEzPassSharedLedgers(snapshot);
    expect(ezPassLedgerLabel(ledger, 'member-synthetic')).toBe("Alex's E-ZPass");
    expect(ezPassLedgerLabel({ ...ledger, ownerUserId: 'member-synthetic' }, 'member-synthetic'))
      .toBe('My E-ZPass');
  });

  it('maps shared rows into Finance summaries without exposing private fields', () => {
    const [ledger] = parseEzPassSharedLedgers(snapshot);
    expect(sharedEzPassActivities(ledger)[0]).toMatchObject({
      source: 'ezpass',
      activity: 'expense',
      ezPassLedgerId: 'ledger-synthetic',
      ezPassSharedTransactionId: 'transaction-synthetic',
      ezPassFriendId: 'member-synthetic',
    });
  });

  it('collapses CSV and PDF copies in a shared ledger while preserving assignment', () => {
    const [ledger] = parseEzPassSharedLedgers([{
      ...snapshot[0],
      transactions: [
        { ...snapshot[0].transactions[0], id: 'pdf-copy', merchant: 'Gsp' },
        { ...snapshot[0].transactions[0], id: 'csv-copy', merchant: 'UNI - Union' },
      ],
    }]);
    const activities = sharedEzPassActivities(ledger);
    expect(activities).toHaveLength(1);
    expect(activities[0]).toEqual(expect.objectContaining({
      merchant: 'UNI - Union',
      ezPassFriendId: 'member-synthetic',
    }));
  });

  it('drops malformed ledgers and transaction rows', () => {
    expect(parseEzPassSharedLedgers([{ id: 'missing-owner' }, null])).toEqual([]);
    const [ledger] = parseEzPassSharedLedgers([{ ...snapshot[0], transactions: [{ amount: 'bad' }] }]);
    expect(ledger.transactions).toEqual([]);
  });

  it('enforces connected-friend membership and self-only member tagging in SQL', () => {
    const migration = fs.readFileSync(
      path.resolve(__dirname, '../../../../supabase/migrations/202608140002_ezpass_collaboration.sql'),
      'utf8',
    );
    expect(migration).toContain('public.are_friends(actor, friend_id)');
    expect(migration).toContain("raise exception 'Members can only tag or untag themselves.'");
    expect(migration).toContain("current_assignee <> actor");
    expect(migration).toContain('grant select on public.ezpass_shared_transactions to authenticated');
    expect(migration).not.toContain('receipt_uri');
    expect(migration).not.toContain('account_id');
  });
});
