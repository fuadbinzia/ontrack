/**
 * Shell state the root navigator guards on. `locked` is the cold-start
 * sign-in gate: a stored session exists but must be re-confirmed.
 */
export type AuthPhase =
  | 'loading'
  | 'welcome'
  | 'guest'
  | 'authenticating'
  | 'resolving-data'
  | 'authenticated'
  | 'locked'
  | 'error';
