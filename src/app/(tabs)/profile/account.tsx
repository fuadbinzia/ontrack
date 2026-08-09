import { Redirect, useLocalSearchParams } from 'expo-router';

import { isSafeAuthReturnTo } from '@/utils/auth-return-to';

/** Legacy tab path → root `/account` (no bottom nav on sign-in). */
export default function ProfileAccountRedirect() {
  const { returnTo } = useLocalSearchParams<{ returnTo?: string }>();
  if (isSafeAuthReturnTo(returnTo)) {
    return (
      <Redirect
        href={{ pathname: '/account', params: { returnTo } }}
      />
    );
  }
  return <Redirect href="/account" />;
}
