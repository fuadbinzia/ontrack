/**
 * __DEV__ agent-ui overlay toggle — paints registered frames + short ids on
 * screen so a screenshot carries the reference point for triage.
 */

type Listener = () => void;

let overlayEnabled = false;
/**
 * Floating Overlay FAB — only shown while overlay paint is on.
 * Long-press hides; enabling overlay (Diagnostics / agent-ui-overlay.sh) brings it back.
 */
let fabVisible = true;
const listeners = new Set<Listener>();

function notifyListeners(): void {
  for (const listener of listeners) listener();
}

/** Chrome that stays mounted across tabs / stacks — always safe to paint. */
const OVERLAY_GLOBAL_PREFIXES = [
  'ontrack.tabs.',
  'ontrack.chrome.',
  'ontrack.agentUi.',
  'ontrack.prompt.',
] as const;

/**
 * Map the active path to feature id prefixes. Tab screens stay mounted, so
 * without this filter inactive routes leave ghost boxes on the current screen.
 */
export function agentUiOverlayRoutePrefixes(route: string | null | undefined): string[] {
  const path = (route ?? '').split('?')[0].replace(/\/+$/, '') || '/';
  if (path === '/') return ['today'];
  const seg = path.replace(/^\//, '').split('/')[0]?.toLowerCase() ?? '';
  switch (seg) {
    case 'profile':
    case 'account':
      return ['profile', 'account'];
    case 'to-do':
    case 'todos':
    case 'l':
    case 'c':
      return ['todos', 'todo', 'checklists', 'grocery', 'recipe'];
    case 'vision-board':
      return ['visionBoard', 'vision-board', 'vision'];
    case 'design-system':
      return ['designSystem', 'design-system'];
    case 'nutrition-profile':
      return ['nutrition', 'profile'];
    case 'activity-form':
      return ['activity', 'today'];
    case 'developer':
      return ['developer'];
    case 'integrations':
      return ['integrations', 'apiUsage', 'developer'];
    case 'p':
    case 'partner':
      return ['straiaway', 'profile'];
    case 'travel':
    case 'calendar':
    case 'social':
    case 'insights':
    case 'workouts':
    case 'plants':
    case 'vehicles':
    case 'health':
    case 'finance':
    case 'journal':
    case 'games':
    case 'agents':
    case 'privacy':
    case 'terms':
      return [seg];
    default:
      return seg ? [seg] : [];
  }
}

/** Whether the overlay should paint this testID for the active route. */
export function isAgentUiOverlayPaintTarget(
  testID: string,
  route: string | null | undefined,
): boolean {
  if (!testID) return false;
  if (OVERLAY_GLOBAL_PREFIXES.some((prefix) => testID.startsWith(prefix))) {
    return true;
  }
  return agentUiOverlayRoutePrefixes(route).some(
    (prefix) => testID === `ontrack.${prefix}` || testID.startsWith(`ontrack.${prefix}.`),
  );
}

export function isAgentUiOverlayEnabled(): boolean {
  return overlayEnabled;
}

/** True only when overlay paint is on and the FAB has not been long-press dismissed. */
export function isAgentUiFabVisible(): boolean {
  return overlayEnabled && fabVisible;
}

export function setAgentUiOverlayEnabled(enabled: boolean): void {
  let changed = false;
  if (overlayEnabled !== enabled) {
    overlayEnabled = enabled;
    changed = true;
  }
  // Turning overlay on (diagnostics / script) restores a long-press-dismissed FAB.
  if (enabled && !fabVisible) {
    fabVisible = true;
    changed = true;
  }
  if (changed) notifyListeners();
}

/** Hide the floating Overlay button and turn paint off. */
export function dismissAgentUiFab(): void {
  let changed = false;
  if (fabVisible) {
    fabVisible = false;
    changed = true;
  }
  if (overlayEnabled) {
    overlayEnabled = false;
    changed = true;
  }
  if (changed) notifyListeners();
}

/**
 * Clear a long-press dismiss so the next overlay-on shows the FAB.
 * Does not enable paint by itself — use setAgentUiOverlayEnabled(true) to show it.
 */
export function restoreAgentUiFab(): void {
  if (fabVisible) return;
  fabVisible = true;
  notifyListeners();
}

export function toggleAgentUiOverlay(): boolean {
  setAgentUiOverlayEnabled(!overlayEnabled);
  return overlayEnabled;
}

export function subscribeAgentUiOverlay(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Short label for overlay chips — last 2–3 segments of the wire id. */
export function agentUiOverlayShortLabel(testID: string): string {
  const raw = testID.startsWith('ontrack.') ? testID.slice('ontrack.'.length) : testID;
  const parts = raw.split('.').filter(Boolean);
  if (parts.length <= 3) return parts.join('.') || testID;
  return parts.slice(-3).join('.');
}
