import { File, Paths } from 'expo-file-system';
import { Dimensions, PixelRatio, Platform } from 'react-native';

import { METRO_HMR_BEACON } from '../dev/metro-hmr-beacon';
import { getAgentUiActiveNonce, postAgentUiStatus } from './http-bridge';
import { listAgentUiTargets, type AgentUiEntry } from './registry';
import { getAgentUiRoute } from './route';

/** iOS hosts poll Documents; Android materializes dumps from HTTP status only. */
function shouldMirrorDocuments(): boolean {
  return Platform.OS !== 'android';
}

export const AGENT_UI_DUMP_FILENAME = 'agent-ui-dump.json';
export const AGENT_UI_STATUS_FILENAME = 'agent-ui-status.json';
export const AGENT_UI_COMMAND_FILENAME = 'agent-ui-command.json';

export type AgentUiScreenMetrics = {
  width: number;
  height: number;
  scale: number;
};

export type AgentUiDumpPayload = {
  generatedAt: string;
  count: number;
  /** Expo Router pathname when the dump was taken (dev bridge). */
  route: string | null;
  /** Logical window size + native scale for host screenshot sampling. */
  screen: AgentUiScreenMetrics;
  elements: AgentUiEntry[];
};

function agentUiScreenMetrics(): AgentUiScreenMetrics {
  const { width, height } = Dimensions.get('window');
  return { width, height, scale: PixelRatio.get() };
}

export type AgentUiStatusResult = {
  op: string;
  id?: string;
  ok: boolean;
  detail?: string;
  element?: AgentUiEntry;
  count?: number;
  route?: string | null;
  /** Host/daemon correlation id for the active command. */
  nonce?: number;
  screen?: AgentUiScreenMetrics;
};

export type AgentUiStatusPayload = {
  generatedAt: string;
  op: string;
  id?: string;
  ok: boolean;
  detail?: string;
  element?: AgentUiEntry;
  /** Match count for prefix / ready checks (no dump file). */
  count?: number;
  route?: string | null;
  /** Logical window size + native scale for host screenshot sampling. */
  screen?: AgentUiScreenMetrics;
  /** Full dump elements (op=dump) so Android hosts need no Documents pull. */
  elements?: AgentUiEntry[];
  /** Per-step outcomes for `op=batch`. */
  results?: AgentUiStatusResult[];
  /** Host/daemon correlation id for the active command. */
  nonce?: number;
  /**
   * Dev Metro HMR beacon from `metro-hmr-beacon.ts`. Hosts compare this to the
   * on-disk nonce to detect a warm bridge still running a stale JS bundle (H20).
   */
  hmrBeacon?: string;
};

function writeJson(filename: string, payload: unknown): void {
  const file = new File(Paths.document, filename);
  if (!file.exists) {
    file.create({ intermediates: true });
  }
  // Compact JSON — hosts poll this path; pretty-print wasted I/O on every op.
  file.write(JSON.stringify(payload));
}

export function writeAgentUiDump(): AgentUiDumpPayload {
  const elements = listAgentUiTargets();
  const payload: AgentUiDumpPayload = {
    generatedAt: new Date().toISOString(),
    count: elements.length,
    route: getAgentUiRoute(),
    screen: agentUiScreenMetrics(),
    elements,
  };
  // Android hosts never read Documents dumps — skip sync file I/O that can
  // stall the JS thread before the HTTP status POST runs.
  if (shouldMirrorDocuments()) {
    writeJson(AGENT_UI_DUMP_FILENAME, payload);
  }
  return payload;
}

export async function writeAgentUiStatus(
  payload: Omit<AgentUiStatusPayload, 'generatedAt'>,
): Promise<AgentUiStatusPayload> {
  const nonce = payload.nonce ?? getAgentUiActiveNonce();
  const full: AgentUiStatusPayload = {
    generatedAt: new Date().toISOString(),
    route: getAgentUiRoute(),
    ...payload,
    screen: payload.screen ?? agentUiScreenMetrics(),
    ...(nonce !== undefined ? { nonce } : {}),
    ...(typeof __DEV__ !== 'undefined' && __DEV__
      ? { hmrBeacon: METRO_HMR_BEACON }
      : {}),
  };
  // Await HTTP status so the host sees completion before the app accepts the
  // next /next command. Fire-and-forget raced on Android (every-other timeout).
  // Skip Documents mirror on Android — hosts materialize dumps from status.
  if (typeof __DEV__ !== 'undefined' && __DEV__) {
    await postAgentUiStatus(full);
  }
  if (shouldMirrorDocuments()) {
    try {
      writeJson(AGENT_UI_STATUS_FILENAME, full);
    } catch {
      /* File mirror is best-effort; HTTP status already left. */
    }
  }
  return full;
}
