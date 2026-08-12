/** Active route + in-app navigation for __DEV__ agent-ui dump/goto/reset. */

type AgentUiNavigate = (href: string) => void;

let currentRoute: string | null = null;
let lastContentRoute: string | null = null;
let navigateFn: AgentUiNavigate | null = null;

/** Stable aliases agents can pass to `op=goto&to=…` or `agent-ui-open.sh`. */
export const AGENT_UI_ROUTE_ALIASES = {
  today: '/',
  home: '/',
  reset: '/',
  calendar: '/calendar',
  checklists: '/to-do',
  todos: '/to-do',
  'to-do': '/to-do',
  social: '/social',
  insights: '/insights',
  profile: '/profile',
  workouts: '/workouts',
  plants: '/plants',
  travel: '/travel',
  visionBoard: '/vision-board',
  'vision-board': '/vision-board',
  visionBoardCategories: '/vision-board/categories',
  'vision-board-categories': '/vision-board/categories',
  games: '/games',
  vehicles: '/vehicles',
  health: '/health',
  finance: '/finance',
  agents: '/agents',
  designSystem: '/design-system',
  'design-system': '/design-system',
  apiUsage: '/integrations',
  'api-usage': '/integrations',
  integrations: '/integrations',
  developer: '/developer',
  'developer-tools': '/developer',
  performance: '/(tabs)/profile/performance',
  'performance-monitor': '/(tabs)/profile/performance',
  nutrition: '/nutrition-profile',
  activityForm: '/activity-form',
  activity: '/activity-form',
  privacy: '/privacy',
  terms: '/terms',
  straiaway: '/(tabs)/profile/straiaway',
  'straiaway-connect': '/(tabs)/profile/straiaway',
} as const;

export type AgentUiRouteAlias = keyof typeof AGENT_UI_ROUTE_ALIASES;

const TRAVEL_ADD_KINDS = new Set([
  'moment',
  'activity',
  'event',
  'flight',
  'transport',
  'stay',
  'rental',
  'timeline',
]);

/**
 * Expand nested agent shortcuts before alias/path resolution.
 * Keeps open/batch/flow args short for multi-tap flows.
 */
export function expandAgentUiShortcuts(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return trimmed;

  const qIndex = trimmed.indexOf('?');
  const pathPart = qIndex >= 0 ? trimmed.slice(0, qIndex) : trimmed;
  const existingQuery = qIndex >= 0 ? trimmed.slice(qIndex + 1) : '';
  const path = pathPart.replace(/^\/+/, '');

  const withQuery = (base: string) =>
    existingQuery ? `${base}${base.includes('?') ? '&' : '?'}${existingQuery}` : base;

  const addMatch =
    /^travel\/([^/?#]+)\/add\/(moment|activity|flight|transport|stay|rental|timeline)$/i.exec(
      path,
    );
  if (addMatch && TRAVEL_ADD_KINDS.has(addMatch[2].toLowerCase())) {
    const kind = addMatch[2].toLowerCase();
    return withQuery(`/travel/${addMatch[1]}?add=${kind}`);
  }

  const importMatch = /^travel\/([^/?#]+)\/import$/i.exec(path);
  if (importMatch) {
    return withQuery(`/travel/${importMatch[1]}?previewModal=import`);
  }

  const expenseSavedMatch = /^travel\/([^/?#]+)\/expense-saved$/i.exec(path);
  if (expenseSavedMatch) {
    return withQuery(`/travel/${expenseSavedMatch[1]}?previewModal=expense-saved`);
  }

  const expenseMatch = /^travel\/([^/?#]+)\/expense$/i.exec(path);
  if (expenseMatch) {
    return withQuery(`/travel/${expenseMatch[1]}?previewModal=expense`);
  }

  const stayBookingMatch = /^travel\/([^/?#]+)\/stay-booking$/i.exec(path);
  if (stayBookingMatch) {
    return withQuery(`/travel/${stayBookingMatch[1]}?openStayBooking=1`);
  }

  // Cross-domain nested shortcuts
  if (/^health\/mood$/i.test(path)) return withQuery('/health/mood-check-in');
  if (/^health\/settings$/i.test(path)) return withQuery('/health/settings');
  if (/^health\/playbook$/i.test(path)) return withQuery('/health/playbook-editor');
  if (/^health\/factor$/i.test(path)) return withQuery('/health/factor-editor');
  if (/^plants\/new$/i.test(path)) return withQuery('/plants/new');
  if (/^vehicles\/new$/i.test(path)) return withQuery('/vehicles/new');

  const checklistMatch = /^(?:checklists|todos|to-do)\/([^/?#]+)$/i.exec(path);
  if (checklistMatch) {
    return withQuery(`/to-do/${checklistMatch[1]}`);
  }

  const checklistSettingsMatch =
    /^(?:checklists|todos|to-do)\/([^/?#]+)\/settings$/i.exec(path);
  if (checklistSettingsMatch) {
    return withQuery(`/todos/${checklistSettingsMatch[1]}/settings`);
  }

  const recipeImportMatch =
    /^(?:checklists|todos|to-do)\/([^/?#]+)\/recipe-import$/i.exec(path);
  if (recipeImportMatch) {
    return withQuery(`/todos/${recipeImportMatch[1]}/recipe-import`);
  }

  const plantMatch = /^plants\/([^/?#]+)$/i.exec(path);
  if (plantMatch && plantMatch[1].toLowerCase() !== 'new') {
    return withQuery(`/plants/${plantMatch[1]}`);
  }

  const vehicleMatch = /^vehicles\/([^/?#]+)$/i.exec(path);
  if (vehicleMatch && vehicleMatch[1].toLowerCase() !== 'new') {
    return withQuery(`/vehicles/${vehicleMatch[1]}`);
  }

  return trimmed;
}

export function setAgentUiRoute(route: string | null): void {
  currentRoute = route;
  if (route && route !== '/agent/ui') lastContentRoute = route;
}

export function getAgentUiRoute(): string | null {
  return currentRoute;
}

export function getLastAgentUiContentRoute(): string | null {
  return lastContentRoute;
}

export function setAgentUiNavigator(navigate: AgentUiNavigate | null): void {
  navigateFn = navigate;
}

export function agentUiNavigate(href: string): boolean {
  if (!navigateFn || !href) return false;
  navigateFn(href);
  return true;
}

/** Trip id from `/travel/<id>` / `/travel/<id>/hub` (query ignored). */
export function travelPlanIdFromRoute(route: string | null | undefined): string | null {
  if (!route) return null;
  const path = route.trim().split(/[?#]/)[0] ?? '';
  const match = /(?:^|\/)travel\/([^/]+)/i.exec(path);
  const id = match?.[1]?.trim();
  return id || null;
}

/**
 * Resolve an agent destination to an Expo Router href.
 * Accepts aliases (`today`), absolute paths (`/travel/abc`), bare segments
 * (`travel/abc`), query strings, and nested shortcuts (`travel/abc/add/flight`).
 */
export function resolveAgentUiDestination(raw: string | undefined): string | null {
  if (!raw) return null;
  const expanded = expandAgentUiShortcuts(raw);
  const trimmed = expanded.trim();
  if (!trimmed) return null;

  const qIndex = trimmed.indexOf('?');
  const pathPart = qIndex >= 0 ? trimmed.slice(0, qIndex) : trimmed;
  const query = qIndex >= 0 ? trimmed.slice(qIndex) : '';

  const aliasKey = pathPart as AgentUiRouteAlias;
  if (aliasKey in AGENT_UI_ROUTE_ALIASES) {
    return `${AGENT_UI_ROUTE_ALIASES[aliasKey]}${query}`;
  }

  if (pathPart.startsWith('/')) return `${pathPart}${query}`;

  // Bare path: travel/xyz → /travel/xyz
  return `/${pathPart.replace(/^\/+/, '')}${query}`;
}

/** Host deep link for a destination (three-slash form). */
export function agentUiDeepLinkForDestination(raw: string): string | null {
  const href = resolveAgentUiDestination(raw);
  if (!href) return null;
  if (href === '/') return 'ontrack:///';
  return `ontrack:///${href.replace(/^\/+/, '')}`;
}
