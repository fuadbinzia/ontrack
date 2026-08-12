function json(request: Request, body: unknown, status = 200) {
  const origin = request.headers.get('origin') ?? '*';
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
    },
  });
}

export function OPTIONS(request: Request) {
  return json(request, {});
}

function plaidConfigured() {
  return Boolean(process.env.PLAID_CLIENT_ID && process.env.PLAID_SECRET);
}

function hostForEnv(env: string): string {
  if (env === 'production') return 'production.plaid.com';
  if (env === 'development') return 'development.plaid.com';
  return 'sandbox.plaid.com';
}

/**
 * Exchanges a Plaid public_token for an item + recent transactions.
 * Access tokens stay server-side only (not returned to the client).
 */
export async function POST(request: Request) {
  if (!plaidConfigured()) {
    return json(
      request,
      {
        configured: false,
        error: 'Plaid is not configured on the server.',
      },
      503,
    );
  }

  let body: { public_token?: string; purpose?: string } = {};
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return json(request, { error: 'Invalid JSON body.' }, 400);
  }
  const publicToken = body.public_token?.trim();
  if (!publicToken) {
    return json(request, { error: 'public_token is required.' }, 400);
  }
  const purpose = body.purpose === 'investments' ? 'investments' : 'transactions';

  const env = process.env.PLAID_ENV ?? process.env.EXPO_PUBLIC_PLAID_ENV ?? 'sandbox';
  const clientId = process.env.PLAID_CLIENT_ID!;
  const secret = process.env.PLAID_SECRET!;
  const host = hostForEnv(env);

  try {
    const exchangeRes = await fetch(`https://${host}/item/public_token/exchange`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: clientId,
        secret,
        public_token: publicToken,
      }),
    });
    const exchange = (await exchangeRes.json()) as {
      access_token?: string;
      item_id?: string;
      error_message?: string;
    };
    if (!exchangeRes.ok || !exchange.access_token || !exchange.item_id) {
      return json(
        request,
        {
          configured: true,
          error: exchange.error_message ?? 'Token exchange failed',
        },
        502,
      );
    }

    const accessToken = exchange.access_token;
    const itemId = exchange.item_id;

    const accountsRes = await fetch(`https://${host}/accounts/get`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: clientId,
        secret,
        access_token: accessToken,
      }),
    });
    const accountsBody = (await accountsRes.json()) as {
      accounts?: {
        account_id?: string;
        name?: string;
        official_name?: string;
        mask?: string;
        type?: string;
        subtype?: string;
        balances?: { current?: number; iso_currency_code?: string };
      }[];
      item?: { institution_id?: string };
    };

    const asOf = new Date().toISOString().slice(0, 10);
    let holdings: {
      account_id?: string;
      security_id?: string;
      quantity?: number;
      institution_value?: number;
      iso_currency_code?: string;
    }[] = [];
    let securities: {
      security_id?: string;
      ticker_symbol?: string;
      name?: string;
    }[] = [];

    if (purpose === 'investments') {
      const holdRes = await fetch(`https://${host}/investments/holdings/get`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: clientId,
          secret,
          access_token: accessToken,
        }),
      });
      if (holdRes.ok) {
        const holdBody = (await holdRes.json()) as {
          holdings?: typeof holdings;
          securities?: typeof securities;
          accounts?: typeof accountsBody.accounts;
        };
        holdings = holdBody.holdings ?? [];
        securities = holdBody.securities ?? [];
        if (holdBody.accounts?.length) {
          accountsBody.accounts = holdBody.accounts;
        }
      }
    }

    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - 30);
    const startKey = start.toISOString().slice(0, 10);
    const endKey = end.toISOString().slice(0, 10);

    let transactions: {
      transaction_id?: string;
      amount?: number;
      date?: string;
      name?: string;
      merchant_name?: string;
      category?: string[];
    }[] = [];

    if (purpose === 'transactions') {
      const txRes = await fetch(`https://${host}/transactions/get`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: clientId,
          secret,
          access_token: accessToken,
          start_date: startKey,
          end_date: endKey,
        }),
      });
      const txBody = (await txRes.json()) as { transactions?: typeof transactions };
      transactions = txBody.transactions ?? [];
    }

    return json(request, {
      configured: true,
      item_id: itemId,
      // Returned once for device SecureStore so later sync can refresh txns.
      // Prefer a server vault in production when available.
      access_token: accessToken,
      institution_name: accountsBody.item?.institution_id,
      purpose,
      accounts: (accountsBody.accounts ?? []).map((account) => ({
        account_id: account.account_id,
        name: account.official_name || account.name || 'Account',
        mask: account.mask,
        type: account.type,
        subtype: account.subtype,
        balance: account.balances?.current,
        currency: account.balances?.iso_currency_code,
      })),
      holdings: holdings
        .filter((h) => typeof h.institution_value === 'number')
        .map((h) => {
          const security = securities.find((s) => s.security_id === h.security_id);
          return {
            account_id: h.account_id,
            external_id: `${h.account_id ?? 'acct'}:${h.security_id ?? 'sec'}`,
            symbol: security?.ticker_symbol,
            name: security?.name || security?.ticker_symbol || 'Holding',
            quantity: h.quantity,
            value: h.institution_value,
            currency: h.iso_currency_code || 'USD',
            as_of: asOf,
          };
        }),
      transactions: transactions
        .filter((t) => t.transaction_id && t.date && typeof t.amount === 'number')
        .map((t) => ({
          external_id: t.transaction_id,
          // Plaid: positive amount = money out for depository; keep as spend magnitude.
          amount: Math.abs(t.amount ?? 0),
          date: t.date,
          merchant: t.merchant_name || t.name || 'Transaction',
          category_hint: t.category?.[0],
        })),
    });
  } catch {
    return json(
      request,
      { configured: true, error: 'Plaid exchange failed' },
      502,
    );
  }
}
