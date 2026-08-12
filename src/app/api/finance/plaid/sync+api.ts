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

/** Refresh recent transactions for a linked item using a stored access token. */
export async function POST(request: Request) {
  if (!plaidConfigured()) {
    return json(
      request,
      { configured: false, error: 'Plaid is not configured on the server.' },
      503,
    );
  }

  let body: { access_token?: string; days?: number; purpose?: string } = {};
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return json(request, { error: 'Invalid JSON body.' }, 400);
  }
  const accessToken = body.access_token?.trim();
  if (!accessToken) {
    return json(request, { error: 'access_token is required.' }, 400);
  }
  const purpose = body.purpose === 'investments' ? 'investments' : 'transactions';

  const days =
    typeof body.days === 'number' && body.days > 0 && body.days <= 90
      ? Math.floor(body.days)
      : 30;
  const env = process.env.PLAID_ENV ?? process.env.EXPO_PUBLIC_PLAID_ENV ?? 'sandbox';
  const clientId = process.env.PLAID_CLIENT_ID!;
  const secret = process.env.PLAID_SECRET!;
  const host = hostForEnv(env);

  const end = new Date();
  const start = new Date();
  start.setDate(end.getDate() - days);
  const asOf = end.toISOString().slice(0, 10);

  try {
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
      const holdBody = (await holdRes.json()) as {
        accounts?: {
          account_id?: string;
          name?: string;
          official_name?: string;
          mask?: string;
          type?: string;
          subtype?: string;
          balances?: { current?: number; iso_currency_code?: string };
        }[];
        holdings?: {
          account_id?: string;
          security_id?: string;
          quantity?: number;
          institution_value?: number;
          iso_currency_code?: string;
        }[];
        securities?: { security_id?: string; ticker_symbol?: string; name?: string }[];
        error_message?: string;
      };
      if (!holdRes.ok) {
        return json(
          request,
          {
            configured: true,
            error: holdBody.error_message ?? 'Holdings sync failed',
          },
          502,
        );
      }
      const securities = holdBody.securities ?? [];
      return json(request, {
        configured: true,
        purpose,
        accounts: (holdBody.accounts ?? []).map((account) => ({
          account_id: account.account_id,
          name: account.official_name || account.name || 'Account',
          mask: account.mask,
          type: account.type,
          subtype: account.subtype,
          balance: account.balances?.current,
          currency: account.balances?.iso_currency_code,
        })),
        holdings: (holdBody.holdings ?? [])
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
        transactions: [],
      });
    }

    const txRes = await fetch(`https://${host}/transactions/get`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: clientId,
        secret,
        access_token: accessToken,
        start_date: start.toISOString().slice(0, 10),
        end_date: end.toISOString().slice(0, 10),
      }),
    });
    const txBody = (await txRes.json()) as {
      transactions?: {
        transaction_id?: string;
        amount?: number;
        date?: string;
        name?: string;
        merchant_name?: string;
        category?: string[];
      }[];
      error_message?: string;
    };
    if (!txRes.ok) {
      return json(
        request,
        {
          configured: true,
          error: txBody.error_message ?? 'Transaction sync failed',
        },
        502,
      );
    }
    return json(request, {
      configured: true,
      purpose,
      holdings: [],
      transactions: (txBody.transactions ?? [])
        .filter((t) => t.transaction_id && t.date && typeof t.amount === 'number')
        .map((t) => ({
          external_id: t.transaction_id,
          amount: Math.abs(t.amount ?? 0),
          date: t.date,
          merchant: t.merchant_name || t.name || 'Transaction',
          category_hint: t.category?.[0],
        })),
    });
  } catch {
    return json(request, { configured: true, error: 'Plaid sync failed' }, 502);
  }
}
