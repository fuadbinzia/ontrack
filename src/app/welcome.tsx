import { useAuthSession } from '@/features/auth/auth-provider';
import { AuthScreen } from '@/features/auth/auth-screen';
import { WelcomeOnboardScreen } from '@/features/auth/welcome-onboard-screen';

export default function WelcomeScreen() {
  const { phase } = useAuthSession();
  if (phase === 'locked') {
    return <AuthScreen variant="locked" />;
  }
  return <WelcomeOnboardScreen />;
}
