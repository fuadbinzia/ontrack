/** Official consumer credit-score sites — open in browser; never scrape. */
export const FINANCE_CREDIT_PROVIDERS = [
  { id: 'creditkarma', label: 'Credit Karma', url: 'https://www.creditkarma.com' },
  { id: 'chase', label: 'Chase Credit Journey', url: 'https://creditjourney.chase.com' },
  { id: 'discover', label: 'Discover Credit Scorecard', url: 'https://www.discover.com/credit-cards/member-benefits/credit-scorecard/' },
  { id: 'capitalone', label: 'Capital One CreditWise', url: 'https://www.capitalone.com/creditwise/' },
] as const;

export type FinanceCreditProviderId = (typeof FINANCE_CREDIT_PROVIDERS)[number]['id'];
