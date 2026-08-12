import type { Session, User } from '@supabase/supabase-js';
import { createContext, useContext } from 'react';

import type { AuthProvider } from '@/services/cloud/account';
import type {
    AccountSyncResolution,
    DataChoiceVariant,
} from '@/services/cloud/sync';

import type {
    DeleteAccountResult,
    ResetAccountDataResult,
    SignOutResult,
} from './auth-account-exit';
import type { AuthPhase } from './auth-phase';

export type DataResolution = AccountSyncResolution | 'cancel';
export type { DataChoiceVariant };

export interface AuthContextValue {
  phase: AuthPhase;
  session: Session | null;
  user: User | null;
  isGuest: boolean;
  /** Account waiting behind the cold-start sign-in gate (`locked` phase). */
  lockedEmail?: string;
  /** Set while `phase === 'resolving-data'` — new vs existing account chooser. */
  dataChoiceVariant?: DataChoiceVariant;
  workingProvider?: AuthProvider;
  error?: string;
  continueWithProvider: (provider: AuthProvider, returnTo?: string) => Promise<void>;
  continueAsGuest: () => Promise<void>;
  completeOAuthCallback: (url: string) => Promise<void>;
  resolveDataConflict: (choice: DataResolution) => Promise<void>;
  signOutCurrentDevice: (force?: boolean) => Promise<SignOutResult>;
  resetAccountData: () => Promise<ResetAccountDataResult>;
  deleteAccount: () => Promise<DeleteAccountResult>;
  lockSession: () => void;
  clearError: () => void;
}

/**
 * Own module so Fast Refresh of `auth-provider.tsx` does not recreate the
 * context object (which leaves mounted consumers reading a null context).
 */
export const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuthSession() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuthSession must be used inside AuthSessionProvider.');
  return value;
}
