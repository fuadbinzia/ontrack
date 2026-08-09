// Keep the gitignored HMR beacon in the DEV dependency graph so watcher probes
// touch a module Metro already has loaded (scripts/ensure-metro-hmr-beacon.sh,
// scripts/lib/metro-watcher.sh). Relative import: Metro HMR sometimes fails to
// resolve `@/utils/dev/*` for this file. Hosts compare this value on status to
// detect a warm Android bridge running a stale bundle (H20).
export { METRO_HMR_BEACON } from '../dev/metro-hmr-beacon';

export { AgentTestId } from './AgentTestId';
export { AgentUiFabRestoreHost } from './AgentUiFabRestoreHost';
export { AgentUiOverlay } from './AgentUiOverlay';
export { AgentUiRouteSync } from './AgentUiRouteSync';
export {
    dismissAgentUiOverlays,
    isAgentUiDismissTargetId
} from './dismiss-overlays';
export {
    AGENT_UI_DEMO_ACTIVITY_ID, AGENT_UI_DEMO_CHASE_OUTBOUND_ID,
    AGENT_UI_DEMO_CHASE_RETURN_ID,
    AGENT_UI_DEMO_CHECKLIST_LIST_ID,
    AGENT_UI_DEMO_CHECKLIST_TASK_PACK_ID,
    AGENT_UI_DEMO_CHECKLIST_TASK_PLAN_ID,
    AGENT_UI_DEMO_FLIGHT_ID, AGENT_UI_DEMO_FOOD_ACTIVITY_ID, AGENT_UI_DEMO_GROCERY_LIST_ID,
    AGENT_UI_DEMO_GROCERY_RECIPE_ID,
    AGENT_UI_DEMO_GROCERY_TASK_PASTA_ID,
    AGENT_UI_DEMO_GROCERY_TASK_TOMATOES_ID,
    AGENT_UI_DEMO_HEALTH_FACTOR_ID,
    AGENT_UI_DEMO_HEALTH_MOOD_ID,
    AGENT_UI_DEMO_PLANT_ID,
    AGENT_UI_DEMO_PLANT_WATERING_ACTIVITY_ID,
    AGENT_UI_DEMO_TRIP_ID,
    AGENT_UI_DEMO_VEHICLE_ID, AGENT_UI_DEMO_VISION_CATEGORY_ID,
    AGENT_UI_DEMO_VISION_ITEM_ID,
    AGENT_UI_DEMO_WORKOUT_ACTIVITY_ID,
    AGENT_UI_DEMO_WORKOUT_CATALOG_EXERCISE_ID,
    AGENT_UI_DEMO_WORKOUT_EXERCISE_ID,
    AGENT_UI_DEMO_WORKOUT_SET_ID,
    AGENT_UI_FIXTURE_NAMES,
    AGENT_UI_RESERVED_TRIP_IDS,
    buildAgentUiDemoChecklist,
    buildAgentUiDemoGrocery,
    buildAgentUiDemoTrip,
    createIdFromAgentUiItemIds,
    fixtureNameForReservedTripId,
    formatAgentUiSeedDetail,
    isReservedAgentUiTripId,
    leaveReservedAgentUiTravelRouteIfNeeded,
    normalizeFixtureName,
    purgeAgentUiDemoFixtures,
    recoverMissingReservedTravelPlan,
    restoreTravelPlansFromDocuments,
    seedAgentUiFixture,
    type AgentUiFixtureName,
    type AgentUiSeedResult
} from './fixtures';
export {
    AGENT_UI_ANDROID_WAIT_TIMEOUT_MS,
    AGENT_UI_FLOWS,
    AGENT_UI_WAIT_TIMEOUT_MS,
    listAgentUiFlowNames,
    resolveAgentUiFlow,
    type AgentUiFlowName,
    type AgentUiFlowStep
} from './flows';
export {
    handleAgentUiRequest,
    handleAgentUiUrl,
    isAgentUiUrl,
    parseAgentUiUrl
} from './handle-agent-ui-url';
export type { AgentUiOp, AgentUiRequest, ParsedAgentUiUrl } from './handle-agent-ui-url';
export {
    fetchAgentUiCommand,
    postAgentUiStatus,
    probeAgentUiHttp,
    resolveAgentUiHttpBase
} from './http-bridge';
export {
    AgentUiIds,
    tabTestIdForRoute
} from './ids';
export {
    agentUiOverlayRoutePrefixes,
    agentUiOverlayShortLabel,
    dismissAgentUiFab,
    isAgentUiFabVisible,
    isAgentUiOverlayEnabled,
    isAgentUiOverlayPaintTarget,
    restoreAgentUiFab,
    setAgentUiOverlayEnabled,
    subscribeAgentUiOverlay,
    toggleAgentUiOverlay
} from './overlay';
export {
    AGENT_UI_COMMAND_FILENAME, AGENT_UI_DUMP_FILENAME, AGENT_UI_STATUS_FILENAME,
    writeAgentUiDump,
    writeAgentUiStatus
} from './persist';
export type { AgentUiStatusPayload, AgentUiStatusResult } from './persist';
export {
    getAgentUiFramesEpoch,
    getAgentUiTarget,
    hitAgentUiTarget,
    hitAgentUiTargets,
    isAgentUiEnabled,
    listAgentUiTargets,
    registerAgentUiTarget,
    remeasureAllAgentUiFrames,
    resetAgentUiRegistry,
    subscribeAgentUiFrames,
    tapAgentUiTarget,
    unregisterAgentUiTarget,
    type AgentUiEntry,
    type AgentUiFrame
} from './registry';
export {
    AGENT_UI_ROUTE_ALIASES,
    agentUiDeepLinkForDestination,
    agentUiNavigate,
    expandAgentUiShortcuts,
    getAgentUiRoute, getLastAgentUiContentRoute, resolveAgentUiDestination,
    setAgentUiNavigator,
    setAgentUiRoute,
    travelPlanIdFromRoute,
    type AgentUiRouteAlias
} from './route';
export { scrollAgentUiTargetIntoView } from './scroll-into-view';
export { useAgentUiScrollContainer } from './use-agent-ui-scroll-container';
export { useAgentUiTarget, type AgentUiTarget } from './use-agent-ui-target';

