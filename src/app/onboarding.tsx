import { Redirect, useLocalSearchParams } from 'expo-router';

/** Legacy alias — first-run lives on `/welcome` now. */
export default function OnboardingRedirect() {
  const { returnTo } = useLocalSearchParams<{ returnTo?: string }>();
  if (returnTo) {
    return <Redirect href={{ pathname: '/welcome', params: { returnTo } }} />;
  }
  return <Redirect href="/welcome" />;
}
