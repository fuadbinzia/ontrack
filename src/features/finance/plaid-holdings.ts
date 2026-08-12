import { mapPlaidAccountKind } from './plaid-account-kind';
import type { FinanceAccountKind } from './types';

export type PlaidLinkedAccount = {
  accountId?: string;
  name: string;
  mask?: string;
  type?: string;
  subtype?: string;
  kind: FinanceAccountKind;
  balance?: number;
  currency?: string;
};

export type PlaidLinkedHolding = {
  accountId?: string;
  externalId: string;
  symbol?: string;
  name: string;
  quantity?: number;
  value: number;
  currency: string;
  asOf: string;
};

type PlaidAccountRow = {
  account_id?: string;
  name?: string;
  official_name?: string;
  mask?: string;
  type?: string;
  subtype?: string;
  balances?: { current?: number; iso_currency_code?: string };
};

type PlaidHoldingRow = {
  account_id?: string;
  security_id?: string;
  quantity?: number;
  institution_value?: number;
  iso_currency_code?: string;
};

type PlaidSecurityRow = {
  security_id?: string;
  ticker_symbol?: string;
  name?: string;
};

export function mapPlaidLinkedAccounts(
  accounts: PlaidAccountRow[] | undefined,
): PlaidLinkedAccount[] {
  return (accounts ?? []).map((account) => {
    const balance = account.balances?.current;
    return {
      accountId: account.account_id,
      name: account.official_name || account.name || 'Account',
      mask: account.mask,
      type: account.type,
      subtype: account.subtype,
      kind: mapPlaidAccountKind(account.type, account.subtype),
      balance: typeof balance === 'number' && Number.isFinite(balance) ? balance : undefined,
      currency: account.balances?.iso_currency_code,
    };
  });
}

export function mapPlaidLinkedHoldings(
  holdings: PlaidHoldingRow[] | undefined,
  securities: PlaidSecurityRow[] | undefined,
  asOf: string,
): PlaidLinkedHolding[] {
  const bySecurity = new Map(
    (securities ?? [])
      .filter((row) => row.security_id)
      .map((row) => [row.security_id!, row]),
  );
  return (holdings ?? [])
    .filter((row) => typeof row.institution_value === 'number')
    .map((row) => {
      const security = row.security_id ? bySecurity.get(row.security_id) : undefined;
      return {
        accountId: row.account_id,
        externalId: `${row.account_id ?? 'acct'}:${row.security_id ?? 'sec'}`,
        symbol: security?.ticker_symbol || undefined,
        name: security?.name || security?.ticker_symbol || 'Holding',
        quantity:
          typeof row.quantity === 'number' && Number.isFinite(row.quantity)
            ? row.quantity
            : undefined,
        value: row.institution_value ?? 0,
        currency: row.iso_currency_code || 'USD',
        asOf,
      };
    });
}
