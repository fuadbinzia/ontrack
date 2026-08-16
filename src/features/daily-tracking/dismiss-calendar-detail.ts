import { useNavigation, useRouter } from 'expo-router';
import { useCallback, useEffect } from 'react';

type DetailNavigation = {
  getState: () => { index: number; key: string } | undefined;
  dispatch: (action: { type: string; target: string }) => void;
};

/** Pop the Today detail stack, or swap a stale direct link back to Today. */
export function dismissCalendarDetail(
  navigation: DetailNavigation,
  router: { dismissTo: (href: '/') => void },
) {
  const state = navigation.getState();
  if (state && state.index > 0) {
    navigation.dispatch({ type: 'POP_TO_TOP', target: state.key });
    return;
  }
  router.dismissTo('/');
}

/** Close a calendar detail sheet, and do it immediately when the activity is gone. */
export function useDismissCalendarDetail(missing: boolean) {
  const router = useRouter();
  const navigation = useNavigation();
  const close = useCallback(
    () => dismissCalendarDetail(navigation, router),
    [navigation, router],
  );

  useEffect(() => {
    if (missing) close();
  }, [close, missing]);

  return close;
}
