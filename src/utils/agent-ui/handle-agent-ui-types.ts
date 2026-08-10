/** Agent-ui deep-link / daemon request types. */

export type AgentUiOp =
  | 'dump'
  | 'tap'
  | 'scroll'
  | 'exists'
  | 'prefix'
  | 'route'
  | 'goto'
  | 'reset'
  | 'batch'
  | 'wait'
  | 'seed'
  | 'flow'
  | 'assert'
  | 'hit'
  | 'overlay'
  | 'devmode'
  | 'dismiss'
  | 'login';

export type AgentUiRequest = {
  op?: string | string[];
  id?: string | string[];
  to?: string | string[];
  path?: string | string[];
  prefix?: string | string[];
  /** Logical window X for `op=hit` (points, not screenshot pixels). */
  x?: number | string | string[];
  /** Logical window Y for `op=hit` (points, not screenshot pixels). */
  y?: number | string | string[];
  /** Pure settle delay (ms) before wait polling / as standalone delay. */
  ms?: number | string | string[];
  /** Max poll window for wait (ms). Default 2000 iOS / 4000 Android. */
  timeoutMs?: number | string | string[];
  /** Assert: label must contain this substring (case-insensitive). */
  contains?: string | string[];
  /** Assert: id must be absent when true. */
  missing?: boolean | string | string[];
  /** Batch / flow steps. */
  ops?: AgentUiRequest[];
  /** When true on tap/goto, also rewrite the dump file (default false). */
  refreshDump?: boolean | string | string[];
  /** Host/daemon correlation id (echoed on status). */
  nonce?: number | string | string[];
  /** Agent account sign-in (`op=login`), daemon body only — never a deep link. */
  email?: string | string[];
  password?: string | string[];
  /** Host pin: ios | android (daemon routes per platform). */
  platform?: string | string[];
  /** Agent device pool slot (daemon routes per slot). */
  slot?: number | string | string[];
};

export type ParsedAgentUiUrl = {
  op: AgentUiOp;
  id?: string;
  to?: string;
  prefix?: string;
  x?: string;
  y?: string;
  slot?: string;
};

export const AGENT_UI_PATH = /(?:^|\/)agent\/ui\/?$/i;
export const AGENT_UI_OPS = new Set<AgentUiOp>([
  'dump',
  'tap',
  'scroll',
  'exists',
  'prefix',
  'route',
  'goto',
  'reset',
  'batch',
  'wait',
  'seed',
  'flow',
  'assert',
  'hit',
  'overlay',
  'devmode',
  'dismiss',
  'login',
]);
