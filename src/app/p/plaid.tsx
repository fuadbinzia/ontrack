import { Redirect } from 'expo-router';

/** OAuth institutions return here so the Hosted Link auth session can resume. */
export default function PlaidOAuthReturnRoute() {
  return <Redirect href="/(tabs)/finance/accounts" />;
}

