import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect } from 'react';

import { useAuthSession } from '@/features/auth/auth-provider';
import { AuthScreen } from '@/features/auth/auth-screen';
import { isSafeAuthReturnTo } from '@/utils/auth-return-to';

/** Guest upgrade / sign-in — root stack so the tab dock never shows. */
export default function AccountUpgradeScreen() {
  const router = useRouter();
  const { returnTo } = useLocalSearchParams<{ returnTo?: string }>();
  const { user } = useAuthSession();

  useEffect(() => {
    if (!user) return;
    // Already signed in — never offer a second OAuth bind that could upload
    // this device's local graph into a different account.
    router.replace((isSafeAuthReturnTo(returnTo) ? returnTo : '/profile') as never);
  }, [returnTo, router, user]);

  if (user) return null;

  return <AuthScreen variant="upgrade" returnTo={returnTo} />;
}
