import { AuthScreen } from '@/features/auth/auth-screen';
import { useAuthSession } from '@/features/auth/auth-provider';
import { useShouldShowWelcome } from '@/features/auth/welcome-preview';
import { WelcomeOnboardScreen } from '@/features/auth/welcome-onboard-screen';
import { usePreferences } from '@/store/preferences';

export default function WelcomeScreen() {
  const { phase } = useAuthSession();
  const hasOnboarded = usePreferences((state) => state.hasOnboarded);
  const showWelcome = useShouldShowWelcome(hasOnboarded);

  if (phase === 'locked') {
    return <AuthScreen variant="locked" />;
  }
  // First-run (or force-preview) keeps the name/goal canvas. After sign-out
  // with force-preview off, land on the SSO / guest shell instead.
  if (showWelcome) {
    return <WelcomeOnboardScreen />;
  }
  return <AuthScreen variant="welcome" />;
}
