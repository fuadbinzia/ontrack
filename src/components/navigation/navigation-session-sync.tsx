import { usePathname, useRouter } from 'expo-router';
import { useEffect, useRef } from 'react';

import {
    rememberNavigationPathname,
    resolveInitialNavigationPath,
} from '@/utils/navigation-session';

/**
 * Remembers the last in-app route for this JS session and restores it when
 * Fast Refresh remounts the Stack. Cold root launches open Overview.
 */
export function NavigationSessionSync() {
  const pathname = usePathname();
  const router = useRouter();
  const didBootstrapRestore = useRef(false);

  useEffect(() => {
    if (!didBootstrapRestore.current) {
      didBootstrapRestore.current = true;
      const initialPath = resolveInitialNavigationPath(pathname);
      if (initialPath) {
        router.replace(initialPath as never);
        return;
      }
    }
    rememberNavigationPathname(pathname);
  }, [pathname, router]);

  return null;
}
