// Keep the gitignored HMR beacon in the DEV dependency graph so watcher probes
// touch a module Metro already has loaded (scripts/ensure-metro-hmr-beacon.sh,
// scripts/lib/metro-watcher.sh). Relative import: Metro HMR sometimes fails to
// resolve `@/utils/dev/*` for this file. Hosts compare this value on status to
// detect a warm Android bridge running a stale bundle (H20).
export { METRO_HMR_BEACON } from '../dev/metro-hmr-beacon';

export { AgentTestId } from './AgentTestId';
export {
    AgentUiIds,
    tabTestIdForRoute
} from './ids';
export {
    getAgentUiFramesEpoch,
    isAgentUiEnabled,
    registerAgentUiTarget,
    remeasureAllAgentUiFrames,
    subscribeAgentUiFrames,
    unregisterAgentUiTarget,
    type AgentUiEntry,
    type AgentUiFrame
} from './registry';
export { useAgentUiTarget, type AgentUiTarget } from './use-agent-ui-target';
