import {
  PlaidServerError,
  plaidApiOptions,
  plaidRequest,
  storePlaidLinkSession,
  withPlaidApiAuth,
} from '@/services/finance/plaid-server';

const METHODS = 'POST, OPTIONS';
const NATIVE_COMPLETION_URI = 'ontrack://plaid/complete';
const DEFAULT_OAUTH_REDIRECT_URI = 'https://ontrack--links.expo.app/p/plaid';

export function OPTIONS(request: Request) {
  return plaidApiOptions(request, METHODS);
}

export async function POST(request: Request) {
  return withPlaidApiAuth(request, async (request, userId) => {
    const body = await request.json().catch(() => ({})) as {
      purpose?: string;
      native?: boolean;
    };
    const purpose = body.purpose === 'investments' ? 'investments' : 'transactions';
    const completionRedirectUri = body.native === false
      ? process.env.PLAID_WEB_COMPLETION_REDIRECT_URI?.trim() ||
        `${new URL(request.url).origin}/finance/accounts?plaid=complete`
      : NATIVE_COMPLETION_URI;
    const redirectUri =
      process.env.PLAID_REDIRECT_URI?.trim() || DEFAULT_OAUTH_REDIRECT_URI;

    const result = await plaidRequest<{
      link_token?: string;
      hosted_link_url?: string;
      expiration?: string;
    }>('/link/token/create', {
      client_name: 'onTrack',
      language: 'en',
      country_codes: ['US'],
      user: { client_user_id: userId },
      products: [purpose],
      redirect_uri: redirectUri,
      hosted_link: {
        completion_redirect_uri: completionRedirectUri,
        is_mobile_app: body.native !== false,
        url_lifetime_seconds: 30 * 60,
      },
      ...(purpose === 'transactions' ? { transactions: { days_requested: 30 } } : {}),
    });
    if (!result.link_token || !result.hosted_link_url || !result.expiration) {
      throw new PlaidServerError('Plaid did not return a Hosted Link session.', 'INVALID_RESPONSE');
    }
    await storePlaidLinkSession({
      linkToken: result.link_token,
      userId,
      purpose,
      expiration: result.expiration,
    });
    return {
      configured: true,
      link_token: result.link_token,
      hosted_link_url: result.hosted_link_url,
      completion_redirect_uri: completionRedirectUri,
    };
  });
}
