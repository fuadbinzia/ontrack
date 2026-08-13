export const FLOW_ANALYTICS_SCHEMA_VERSION = 1 as const;
export const FLOW_SESSION_MAX_ROUTES = 30;
export const FLOW_EVENT_BATCH_MAX = 50;
export const FLOW_ANALYTICS_LIFECYCLES = ['visit', 'complete', 'fail', 'measure', 'heartbeat', 'session-end'] as const;
export const FLOW_PERFORMANCE_METRICS = ['page-load', 'action'] as const;
export const FLOW_ANALYTICS_TAG_IDS = [
  ...FLOW_ANALYTICS_LIFECYCLES.map((lifecycle) => `lifecycle.${lifecycle}`),
  'event.id', 'event.sessionId', 'event.occurredAt', 'event.lifecycle',
  'event.route', 'event.fromRoute', 'event.outcomeId', 'event.path',
  'event.metric', 'event.durationMs',
  'batch.schemaVersion', 'batch.installId', 'batch.platform',
  'batch.environment', 'batch.appVersion', 'batch.events',
] as const;

export type FlowPlatform = 'ios' | 'android' | 'web' | 'unknown';
export type FlowEnvironment = 'production' | 'testflight' | 'preview' | 'development';
export type FlowLifecycle = typeof FLOW_ANALYTICS_LIFECYCLES[number];
export type FlowPerformanceMetric = typeof FLOW_PERFORMANCE_METRICS[number];

export type FlowAnalyticsEvent = {
  id: string;
  sessionId: string;
  occurredAt: string;
  lifecycle: FlowLifecycle;
  route: string;
  fromRoute?: string;
  outcomeId?: string;
  path?: string[];
  metric?: FlowPerformanceMetric;
  durationMs?: number;
};

export type FlowEventBatchV1 = {
  schemaVersion: typeof FLOW_ANALYTICS_SCHEMA_VERSION;
  installId: string;
  platform: FlowPlatform;
  environment: FlowEnvironment;
  appVersion: string;
  events: FlowAnalyticsEvent[];
};

const DYNAMIC_ROUTE_PATTERNS: Array<[RegExp, string]> = [
  [/^\/(?:to-do|todos)\/[^/]+\/recipe-import$/, '/to-do/[id]/recipe-import'],
  [/^\/(?:to-do|todos)\/[^/]+\/settings$/, '/to-do/[id]/settings'],
  [/^\/(?:to-do|todos)\/[^/]+$/, '/to-do/[id]'],
  [/^\/travel\/[^/]+\/(chat|flights|hub|stays|tools)$/, '/travel/[id]/$1'],
  [/^\/travel\/[^/]+$/, '/travel/[id]'],
  [/^\/plants\/[^/]+\/(check-in|edit)$/, '/plants/[id]/$1'],
  [/^\/plants\/[^/]+$/, '/plants/[id]'],
  [/^\/vehicles\/[^/]+\/settings$/, '/vehicles/[id]/settings'],
  [/^\/vehicles\/[^/]+$/, '/vehicles/[id]'],
  [/^\/vision-board\/[^/]+$/, '/vision-board/[id]'],
  [/^\/food\/(ingredients|recipes)\/[^/]+$/, '/food/$1/[id]'],
  [/^\/detail\/(food|generic|gym|gym-active|movie|sleep|work)\/[^/]+$/, '/detail/$1/[id]'],
  [/^\/(c|f|i|j|l|v)\/[^/]+$/, '/$1/[code]'],
];

const SENSITIVE_SEGMENT = /(?:@|%40)|^[0-9a-f]{8}-[0-9a-f-]{20,}$/i;

/** Converts an actual Expo pathname into a stable, content-free route key. */
export function canonicalizeAnalyticsRoute(pathname: string | null | undefined): string {
  const raw = (pathname ?? '/').split(/[?#]/, 1)[0] || '/';
  const normalized = `/${raw}`.replace(/\/{2,}/g, '/').replace(/\/$/, '') || '/';
  for (const [pattern, replacement] of DYNAMIC_ROUTE_PATTERNS) {
    if (pattern.test(normalized)) return normalized.replace(pattern, replacement);
  }
  const segments = normalized.split('/').filter(Boolean).map((segment) =>
    SENSITIVE_SEGMENT.test(segment) || segment.length > 64 ? '[value]' : segment,
  );
  return segments.length ? `/${segments.join('/')}` : '/';
}

export function collapseFlowPath(routes: readonly string[]): string[] {
  const collapsed: string[] = [];
  for (const route of routes) {
    if (collapsed.at(-1) !== route) collapsed.push(route);
  }
  return collapsed.slice(-FLOW_SESSION_MAX_ROUTES);
}

export function isAnalyticsRouteKey(value: unknown): value is string {
  return typeof value === 'string'
    && value.length > 0
    && value.length <= 180
    && value.startsWith('/')
    && !/[?#@\s]/.test(value)
    && canonicalizeAnalyticsRoute(value) === value;
}

const KNOWN_ROUTE_ROOTS = new Set([
  'account', 'activity-form', 'activity-form-assistant', 'agent', 'agents', 'api-usage',
  'auth', 'c', 'calendar', 'checklists', 'design-system', 'detail', 'developer', 'f',
  'finance', 'food', 'games', 'health', 'i', 'insights', 'integrations', 'invite', 'j',
  'l', 'nutrition-profile', 'onboarding', 'overview', 'p', 'partner', 'plants', 'privacy', 'profile',
  'share-event', 'share-import', 'social', 'terms', 'to-do', 'todo-collaborators',
  'todo-invites', 'todos', 'trackers', 'travel', 'travel-map', 'v', 'vehicles',
  'vision-board', 'welcome', 'workouts',
]);

export function isKnownAnalyticsRoute(value: unknown): value is string {
  if (!isAnalyticsRouteKey(value)) return false;
  if (value === '/') return true;
  return KNOWN_ROUTE_ROOTS.has(value.split('/')[1] ?? '');
}

export function isOutcomeId(value: unknown): value is string {
  return typeof value === 'string' && /^[a-z][a-z0-9.-]{2,79}$/.test(value);
}
