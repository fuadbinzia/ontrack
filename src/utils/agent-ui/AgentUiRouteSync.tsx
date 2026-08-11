import { File, Paths } from 'expo-file-system';
import { usePathname, useRouter } from 'expo-router';
import { useEffect } from 'react';

import { useAppIsActive } from '@/hooks/use-app-activity';

import {
  handleAgentUiRequest,
  type AgentUiRequest,
} from './handle-agent-ui-url';
import {
  fetchAgentUiCommand,
  probeAgentUiHttp,
  requeueAgentUiCommand,
  setAgentUiActiveNonce,
} from './http-bridge';
import { AGENT_UI_COMMAND_FILENAME } from './persist';
import { isAgentUiEnabled } from './registry';
import { setAgentUiNavigator, setAgentUiRoute } from './route';

const MAX_QUEUED_COMMANDS = 16;

function asNonce(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const n = Number(value);
    return Number.isFinite(n) ? n : undefined;
  }
  return undefined;
}

async function runCommand(request: AgentUiRequest): Promise<void> {
  const nonce = asNonce((request as { nonce?: unknown }).nonce);
  setAgentUiActiveNonce(nonce);
  try {
    await handleAgentUiRequest(request);
  } finally {
    setAgentUiActiveNonce(undefined);
  }
}

/**
 * Keeps agent-ui dump `route` in sync and registers an in-app navigator for
 * `op=goto` / `op=reset` without screenshot coordinates.
 *
 * Prefers HTTP long-poll against the agent-ui daemon (via Metro `/__agent_ui`
 * proxy when available). Falls back to Documents/`agent-ui-command.json` poll.
 */
export function AgentUiRouteSync() {
  const pathname = usePathname();
  const router = useRouter();
  const appIsActive = useAppIsActive();

  useEffect(() => {
    if (!isAgentUiEnabled() || !appIsActive) return;
    setAgentUiRoute(pathname || '/');
    setAgentUiNavigator((href) => {
      router.replace(href as never);
    });
    return () => {
      setAgentUiNavigator(null);
    };
  }, [appIsActive, pathname, router]);

  useEffect(() => {
    if (!isAgentUiEnabled() || !appIsActive) return;

    let cancelled = false;
    let processing = false;
    let httpEnabled = false;
    const pending: AgentUiRequest[] = [];
    const command = new File(Paths.document, AGENT_UI_COMMAND_FILENAME);

    const enqueue = (request: AgentUiRequest) => {
      if (pending.length >= MAX_QUEUED_COMMANDS) {
        pending.shift();
      }
      pending.push(request);
    };

    const takeFileCommand = (): AgentUiRequest | null => {
      if (!command.exists) return null;
      try {
        const request = JSON.parse(command.textSync()) as AgentUiRequest;
        command.delete();
        return request;
      } catch {
        try {
          command.delete();
        } catch {
          /* Ignore a concurrent host rewrite. */
        }
        return null;
      }
    };

    const drain = async () => {
      if (processing) return;
      processing = true;
      try {
        while (!cancelled && pending.length > 0) {
          const next = pending.shift();
          if (next) await runCommand(next);
        }
      } finally {
        processing = false;
        if (!cancelled && pending.length > 0) {
          void drain();
        }
      }
    };

    const accept = (request: AgentUiRequest) => {
      enqueue(request);
      void drain();
    };

    const httpLoop = async () => {
      httpEnabled = await probeAgentUiHttp();
      while (!cancelled) {
        if (!httpEnabled) {
          const request = takeFileCommand();
          if (request) accept(request);
          await new Promise((r) => setTimeout(r, 250));
          httpEnabled = await probeAgentUiHttp();
          continue;
        }
        // Do not long-poll while draining — avoids taking a daemon command that
        // would sit behind a long seed/flow and cause host timeouts.
        if (processing || pending.length > 0) {
          await new Promise((r) => setTimeout(r, 40));
          continue;
        }
        try {
          const request = await fetchAgentUiCommand(5000);
          if (cancelled) {
            // Remount/Strict Mode must not drop a dequeued command.
            if (request) void requeueAgentUiCommand(request);
            break;
          }
          if (request) accept(request);
        } catch {
          httpEnabled = false;
        }
      }
    };

    void httpLoop();

    return () => {
      cancelled = true;
      const dropped = pending.splice(0, pending.length);
      for (const request of dropped) {
        void requeueAgentUiCommand(request);
      }
    };
  }, [appIsActive]);

  return null;
}
