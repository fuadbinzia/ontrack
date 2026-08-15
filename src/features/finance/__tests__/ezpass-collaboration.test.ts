import fs from 'node:fs';
import path from 'node:path';

import {
  ezPassAssignableFriendIds,
  ezPassLedgerLabel,
  ezPassTagPressIntent,
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
  it('shows no assignable friends before anyone is added to the E-ZPass ledger', () => {
    expect(ezPassAssignableFriendIds(undefined)).toEqual([]);
  });

  it('allows assignment only to friends added as E-ZPass members', () => {
    const [ledger] = parseEzPassSharedLedgers(snapshot);
    expect(ezPassAssignableFriendIds(ledger)).toEqual(['member-synthetic']);
  });

  it('keeps a member out of their own assignment-picker roster', () => {
    const [ledger] = parseEzPassSharedLedgers(snapshot);
    const roster = {
      ...ledger,
      members: [
        ...ledger.members,
        {
          userId: 'other-member-synthetic',
          displayName: 'Taylor Morgan',
          role: 'member' as const,
        },
      ],
    };
    expect(ezPassAssignableFriendIds(roster, 'member-synthetic')).toEqual([
      'other-member-synthetic',
    ]);
  });

  it('keeps an established empty E-ZPass roster empty', () => {
    const [ledger] = parseEzPassSharedLedgers([{ ...snapshot[0], members: [] }]);
    expect(ezPassAssignableFriendIds(ledger)).toEqual([]);
  });

  it('lets an added member tag and untag only themselves', () => {
    expect(ezPassTagPressIntent({
      ledgerRole: 'member',
      currentUserId: 'member-synthetic',
      assignedUserId: undefined,
    })).toEqual({ action: 'update', userId: 'member-synthetic' });
    expect(ezPassTagPressIntent({
      ledgerRole: 'member',
      currentUserId: 'member-synthetic',
      assignedUserId: 'member-synthetic',
    })).toEqual({ action: 'update', userId: undefined });
  });

  it('prevents a member from replacing another driver while owners use the picker', () => {
    expect(ezPassTagPressIntent({
      ledgerRole: 'member',
      currentUserId: 'member-synthetic',
      assignedUserId: 'other-member-synthetic',
    })).toEqual({ action: 'blocked' });
    expect(ezPassTagPressIntent({
      ledgerRole: 'owner',
      currentUserId: 'owner-synthetic',
      assignedUserId: undefined,
    })).toEqual({ action: 'open-picker' });
    expect(ezPassTagPressIntent({
      ledgerRole: 'cohost',
      currentUserId: 'member-synthetic',
      assignedUserId: 'other-member-synthetic',
    })).toEqual({ action: 'open-picker' });
  });

  it('parses co-host access for both the viewer and roster', () => {
    const [ledger] = parseEzPassSharedLedgers([{
      ...snapshot[0],
      role: 'cohost',
      members: snapshot[0].members.map((member) =>
        member.userId === 'member-synthetic' ? { ...member, role: 'cohost' } : member),
    }]);
    expect(ledger.role).toBe('cohost');
    expect(ledger.members).toContainEqual(expect.objectContaining({
      userId: 'member-synthetic',
      role: 'cohost',
    }));
  });

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

  it('keeps E-ZPass ledger variables distinct from SQL column names', () => {
    const migration = fs.readFileSync(
      path.resolve(
        __dirname,
        '../../../../supabase/migrations/202608140004_fix_ezpass_ledger_id_ambiguity.sql',
      ),
      'utf8',
    );
    expect(migration).toContain('target_ledger_id uuid;');
    expect(migration).toContain('values (target_ledger_id, actor');
    expect(migration).toContain('values (target_ledger_id, friend_id');
    expect(migration).toContain('activity_row.ledger_id = target_ledger_id');
    expect(migration).not.toMatch(/\n\s*ledger_id uuid;/);
  });

  it('grants co-host administration while protecting the original owner', () => {
    const migration = fs.readFileSync(
      path.resolve(
        __dirname,
        '../../../../supabase/migrations/202608140005_ezpass_cohosts.sql',
      ),
      'utf8',
    );
    expect(migration).toContain("check (role in ('owner', 'cohost', 'member'))");
    expect(migration).toContain("member.role in ('owner', 'cohost')");
    expect(migration).toContain("if actor_role in ('owner', 'cohost') then");
    expect(migration).toContain('public.add_ezpass_ledger_members');
    expect(migration).toContain('public.set_ezpass_member_role');
    expect(migration).toContain('public.remove_ezpass_ledger_member');
    expect(migration).toContain("raise exception 'The E-ZPass owner cannot be changed.'");
    expect(migration).toContain("raise exception 'The E-ZPass owner cannot be removed.'");
    expect(migration).toContain("raise exception 'Hosts cannot change their own access.'");
    expect(migration).toContain("raise exception 'Hosts cannot remove themselves.'");
  });
});
