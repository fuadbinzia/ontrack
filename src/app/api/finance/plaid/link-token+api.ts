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

/**
 * Creates a Plaid Link token when PLAID_CLIENT_ID / PLAID_SECRET are set.
 * Without credentials, returns configured:false so the app can fall back to manual accounts.
 */
export async function POST(request: Request) {
  if (!plaidConfigured()) {
    return json(
      request,
      {
        configured: false,
        error:
          'Plaid is not configured. Add PLAID_CLIENT_ID and PLAID_SECRET, or add accounts manually.',
      },
      503,
    );
  }

  const env = process.env.PLAID_ENV ?? process.env.EXPO_PUBLIC_PLAID_ENV ?? 'sandbox';
  const clientId = process.env.PLAID_CLIENT_ID!;
  const secret = process.env.PLAID_SECRET!;

  let purpose: 'transactions' | 'investments' = 'transactions';
  try {
    const body = (await request.json()) as { purpose?: string };
    if (body.purpose === 'investments') purpose = 'investments';
  } catch {
    // Empty body is fine — default to transactions.
  }

  try {
    const response = await fetch('https://' + hostForEnv(env) + '/link/token/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: clientId,
        secret,
        client_name: 'onTrack',
        language: 'en',
        country_codes: ['US'],
        user: { client_user_id: 'ontrack-user' },
        products: purpose === 'investments' ? ['investments'] : ['transactions'],
      }),
    });
    const data = (await response.json()) as {
      link_token?: string;
      error_message?: string;
    };
    if (!response.ok || !data.link_token) {
      return json(
        request,
        {
          configured: true,
          error: data.error_message ?? 'Could not create Plaid link token',
        },
        502,
      );
    }
    return json(request, { configured: true, link_token: data.link_token });
  } catch {
    return json(
      request,
      { configured: true, error: 'Plaid link token request failed' },
      502,
    );
  }
}

function hostForEnv(env: string): string {
  if (env === 'production') return 'production.plaid.com';
  if (env === 'development') return 'development.plaid.com';
  return 'sandbox.plaid.com';
}
