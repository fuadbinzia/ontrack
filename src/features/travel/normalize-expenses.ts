import { isDateKey } from '@/utils/date';
import { asPositiveNumber, asString } from '@/utils/parse';
import { normalizeCurrencyCode } from './expenses/format-money';
import type {
  TravelExpense,
  TravelExpenseCategory,
  TravelParticipant,
  TravelPlan,
} from './types';
import { TRAVEL_EXPENSE_HOST_ID, TRAVEL_EXPENSE_SELF_ID } from './types';

const EXPENSE_CATEGORIES = new Set<TravelExpenseCategory>([
  'flight',
  'stay',
  'food',
  'transport',
  'activity',
  'shopping',
  'other',
]);

export function normalizeTravelParticipants(value: unknown): TravelParticipant[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((candidate) => {
    if (!candidate || typeof candidate !== 'object') return [];
    const participant = candidate as Partial<TravelParticipant>;
    if (
      typeof participant.id !== 'string' ||
      typeof participant.name !== 'string' ||
      !participant.name.trim() ||
      typeof participant.inviteCode !== 'string' ||
      !/^[a-f0-9]{20}$/.test(participant.inviteCode) ||
      typeof participant.invitedAt !== 'string'
    ) {
      return [];
    }
    return [{
      id: participant.id,
      name: participant.name.trim(),
      email: asString(participant.email)?.trim() || undefined,
      inviteCode: participant.inviteCode,
      invitedAt: participant.invitedAt,
      acceptedAt: asString(participant.acceptedAt),
    }];
  });
}

function normalizeExpenseCategory(value: unknown): TravelExpenseCategory | undefined {
  return typeof value === 'string' && EXPENSE_CATEGORIES.has(value as TravelExpenseCategory)
    ? (value as TravelExpenseCategory)
    : undefined;
}

export function normalizeTravelExpense(
  value: unknown,
  participantIds: Set<string>,
): TravelExpense | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const expense = value as Partial<TravelExpense>;
  const amount = asPositiveNumber(expense.amount);
  const category = normalizeExpenseCategory(expense.category);
  const currency = normalizeCurrencyCode(expense.currency, '');
  if (
    typeof expense.id !== 'string' ||
    typeof expense.title !== 'string' ||
    !expense.title.trim() ||
    amount === undefined ||
    !currency ||
    typeof expense.date !== 'string' ||
    !isDateKey(expense.date) ||
    !category ||
    typeof expense.paidById !== 'string'
  ) {
    return undefined;
  }

  const allowedPayer =
    expense.paidById === TRAVEL_EXPENSE_SELF_ID ||
    expense.paidById === TRAVEL_EXPENSE_HOST_ID ||
    expense.paidById.startsWith('member:') ||
    participantIds.has(expense.paidById);
  if (!allowedPayer) return undefined;

  const splitWithIds = Array.isArray(expense.splitWithIds)
    ? expense.splitWithIds.filter(
        (id): id is string =>
          typeof id === 'string' &&
          (id === TRAVEL_EXPENSE_SELF_ID ||
            id === TRAVEL_EXPENSE_HOST_ID ||
            id.startsWith('member:') ||
            participantIds.has(id)),
      )
    : [];
  const resolvedSplit = splitWithIds.length > 0 ? [...new Set(splitWithIds)] : [expense.paidById];
  const fallbackTimestamp = new Date().toISOString();

  return {
    id: expense.id,
    title: expense.title.trim(),
    amount,
    currency,
    date: expense.date,
    category,
    notes: asString(expense.notes)?.trim() || undefined,
    paidById: expense.paidById,
    splitWithIds: resolvedSplit,
    createdAt: asString(expense.createdAt) ?? asString(expense.updatedAt) ?? fallbackTimestamp,
    updatedAt: asString(expense.updatedAt) ?? asString(expense.createdAt) ?? fallbackTimestamp,
    travelItemId: asString(expense.travelItemId)?.trim() || undefined,
  };
}

export function normalizeTravelExpenses(
  value: unknown,
  participants: TravelParticipant[],
  sharedPeople?: { id: string; name: string }[],
): TravelExpense[] {
  if (!Array.isArray(value)) return [];
  const participantIds = new Set(participants.map((p) => p.id));
  for (const person of sharedPeople ?? []) {
    if (person.id) participantIds.add(person.id);
  }
  return value.flatMap((item) => {
    const normalized = normalizeTravelExpense(item, participantIds);
    return normalized ? [normalized] : [];
  });
}

/**
 * True member copies never keep `openJoinCode` (invite decode leaves it empty;
 * host transfer clears it). A plan with both member chat access and a host
 * open-join code was mis-tagged as someone else’s trip — restore host ownership.
 */
export function repairMisattributedTravelHostPlan<T extends Partial<TravelPlan>>(
  plan: T,
): T {
  const openJoin =
    typeof plan.openJoinCode === 'string' &&
    /^[a-f0-9]{20}$/.test(plan.openJoinCode);
  const chat =
    typeof plan.chatAccessCode === 'string' &&
    /^[a-f0-9]{20}$/.test(plan.chatAccessCode);
  if (!openJoin || !chat || typeof plan.id !== 'string') return plan;

  const sharedExpensePeople = Array.isArray(plan.sharedExpensePeople)
    ? plan.sharedExpensePeople.filter(
        (person) => person && typeof person === 'object' && person.id !== 'host',
      )
    : plan.sharedExpensePeople;

  return {
    ...plan,
    chatAccessCode: undefined,
    hostTripId: plan.id,
    hostDisplayName: undefined,
    ...(sharedExpensePeople ? { sharedExpensePeople } : {}),
  };
}
