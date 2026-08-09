import Constants from 'expo-constants';
import { File, Paths } from 'expo-file-system';
import { Platform } from 'react-native';

import type { AgentUiRequest } from './handle-agent-ui-url';
import type { AgentUiStatusPayload } from './persist';
import {
    applyAgentUiSlotFromUnknown,
    getAgentUiSlot,
} from './slot';

function agentUiPlatformParam(): 'ios' | 'android' {
  return Platform.OS === 'android' ? 'android' : 'ios';
}

/** iOS pin file before bridge mount. Android ignores pins (H17 host port). */
function refreshSlotFromPinFile(): void {
  if (Platform.OS === 'android' || getAgentUiSlot() != null) return;
  try {
    const file = new File(Paths.document, 'agent-ui-pin.json');
    if (!file.exists) return;
    const raw = JSON.parse(String(file.text())) as { slot?: unknown };
    applyAgentUiSlotFromUnknown(raw?.slot);
  } catch {
    /* ignore */
  }
}

const DAEMON_PORT = 8191;
const DIRECT_DAEMON = `http://127.0.0.1:${DAEMON_PORT}`;
const DEFAULT_WAIT_MS = 5000;

let cachedBase: string | null = null;
let activeNonce: number | undefined;

export function setAgentUiActiveNonce(nonce: number | undefined): void {
  activeNonce = nonce;
}

export function getAgentUiActiveNonce(): number | undefined {
  return activeNonce;
}

function hostFromHostUri(hostUri: string): string | null {
  const hostPort = hostUri.split('/')[0]?.trim();
  if (!hostPort) return null;
  const host = hostPort.split(':')[0]?.trim();
  return host || null;
}

/** Dev-only daemon base. Loopback for Simulator; LAN IP for physical devices. */
export function resolveAgentUiHttpBase(): string {
  const override = process.env.EXPO_PUBLIC_AGENT_UI_URL?.trim();
  if (override) return override.replace(/\/+$/, '');

  if (cachedBase) return cachedBase;

  const hostUri =
    Constants.expoConfig?.hostUri ??
    (Constants as { manifest?: { debuggerHost?: string } }).manifest
      ?.debuggerHost ??
    null;

  if (typeof hostUri === 'string' && hostUri.length > 0) {
    const host = hostFromHostUri(hostUri);
    if (host) {
      // Simulator / advertise-127: stay on loopback. Devices use LAN IP:8191.
      cachedBase =
        host === '127.0.0.1' || host === 'localhost'
          ? DIRECT_DAEMON
          : `http://${host}:${DAEMON_PORT}`;
      return cachedBase;
    }
  }

  cachedBase = DIRECT_DAEMON;
  return cachedBase;
}

export function resetAgentUiHttpBaseCache(): void {
  cachedBase = null;
}

async function parseJson(res: Response): Promise<unknown> {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

function candidateBases(): string[] {
  const primary = resolveAgentUiHttpBase();
  const bases = [primary];
  if (primary !== DIRECT_DAEMON) bases.push(DIRECT_DAEMON);
  // Android: no Metro proxy (erases H17 host-port slot).
  if (Platform.OS !== 'android') {
    const hostUri = Constants.expoConfig?.hostUri;
    if (typeof hostUri === 'string' && hostUri.includes(':')) {
      const hostPort = hostUri.split('/')[0];
      if (hostPort) bases.push(`http://${hostPort}/__agent_ui`);
    }
  }
  return [...new Set(bases)];
}

/** Long-poll the next host command. Returns null on timeout / daemon down. */
export async function fetchAgentUiCommand(
  waitMs = DEFAULT_WAIT_MS,
): Promise<AgentUiRequest | null> {
  const platform = agentUiPlatformParam();
  refreshSlotFromPinFile();
  const slot = getAgentUiSlot();
  const slotQuery =
    slot != null && slot >= 1 ? `&slot=${encodeURIComponent(String(slot))}` : '';
  // Identify the device so the daemon hands us only our own commands — a pool
  // slot and the user's headed simulator otherwise race for the same queue.
  const ownDeviceName = Constants.deviceName;
  const deviceQuery =
    typeof ownDeviceName === 'string' && ownDeviceName.length > 0
      ? `&device=${encodeURIComponent(ownDeviceName)}`
      : '';
  // Prefer the cached working base first so we do not open parallel /next
  // waits against Metro proxy + daemon (was a source of dropped commands).
  const bases = candidateBases();
  if (cachedBase) {
    const rest = bases.filter((b) => b !== cachedBase);
    bases.splice(0, bases.length, cachedBase, ...rest);
  }
  for (const base of bases) {
    const url = `${base}/next?waitMs=${Math.max(0, waitMs)}&platform=${platform}${slotQuery}${deviceQuery}`;
    try {
      const res = await fetch(url, {
        method: 'GET',
        headers: { Accept: 'application/json' },
      });
      if (res.status === 204) {
        cachedBase = base;
        return null;
      }
      if (!res.ok) continue;
      const body = await parseJson(res);
      if (!body || typeof body !== 'object') continue;
      const request = body as AgentUiRequest;
      const pinned = (request as { platform?: string }).platform;
      // Defensive: never run a command stamped for the other OS — but put it
      // back on the queue so the peer platform can still take it.
      if (
        typeof pinned === 'string' &&
        pinned.length > 0 &&
        pinned !== platform
      ) {
        void requeueAgentUiCommand(request);
        continue;
      }
      // iOS commands are addressed to the leased sim by name — several sims
      // share one daemon, so a foreign device must not run (or adopt the slot
      // of) another device's command. No name stamped = accept (legacy host).
      const wantDevice = (request as { iosDeviceName?: unknown }).iosDeviceName;
      const ownDevice = Constants.deviceName;
      if (
        platform === 'ios' &&
        typeof wantDevice === 'string' &&
        wantDevice.length > 0 &&
        typeof ownDevice === 'string' &&
        ownDevice.length > 0 &&
        wantDevice !== ownDevice
      ) {
        void requeueAgentUiCommand(request);
        continue;
      }
      const cmdSlot = (request as { slot?: unknown }).slot;
      applyAgentUiSlotFromUnknown(cmdSlot);
      if (
        slot != null &&
        cmdSlot != null &&
        String(cmdSlot) !== String(slot)
      ) {
        void requeueAgentUiCommand(request);
        continue;
      }
      cachedBase = base;
      return request;
    } catch {
      /* try next base */
    }
  }
  return null;
}

/** Re-queue a command the app dequeued but cannot run (unmount / cancel). */
export async function requeueAgentUiCommand(
  request: AgentUiRequest,
): Promise<void> {
  const body = JSON.stringify(request);
  for (const base of candidateBases()) {
    try {
      const res = await fetch(`${base}/command`, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body,
      });
      if (res.ok) {
        cachedBase = base;
        return;
      }
    } catch {
      /* try next */
    }
  }
}

/** Push status to the daemon so the host can wait without Documents polling. */
export async function postAgentUiStatus(
  status: AgentUiStatusPayload,
): Promise<void> {
  const payload = {
    ...status,
    nonce: status.nonce ?? activeNonce,
  };
  const body = JSON.stringify(payload);
  for (const base of candidateBases()) {
    try {
      const res = await fetch(`${base}/status`, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body,
      });
      if (res.ok) {
        cachedBase = base;
        return;
      }
    } catch {
      /* try next */
    }
  }
}

export async function probeAgentUiHttp(): Promise<boolean> {
  for (const base of candidateBases()) {
    try {
      const res = await fetch(`${base}/health`, {
        method: 'GET',
        headers: { Accept: 'application/json' },
      });
      if (!res.ok) continue;
      const body = (await parseJson(res)) as { ok?: boolean; service?: string } | null;
      if (body?.ok) {
        cachedBase = base;
        return true;
      }
    } catch {
      /* try next */
    }
  }
  return false;
}
