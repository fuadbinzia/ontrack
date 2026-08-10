/** Parse agent-ui deep links into structured requests. */

import { applyAgentUiSlotFromUnknown } from './slot';
import {
  AGENT_UI_OPS,
  AGENT_UI_PATH,
  type AgentUiOp,
  type ParsedAgentUiUrl,
} from './handle-agent-ui-types';

export function parseOp(raw: string): AgentUiOp {
  const op = raw.toLowerCase() as AgentUiOp;
  return AGENT_UI_OPS.has(op) ? op : 'dump';
}

export function isAgentUiUrl(url: string): boolean {
  if (!url) return false;
  if (/agent\/ui/i.test(url)) return true;
  try {
    const parsed = new URL(url);
    const path = parsed.pathname.replace(/\/+$/, '') || '/';
    if (AGENT_UI_PATH.test(path) || path === '/agent/ui') return true;
    if (parsed.host === 'agent' && (parsed.pathname === '/ui' || parsed.pathname === '/ui/')) {
      return true;
    }
    return false;
  } catch {
    return /agent\/ui/i.test(url);
  }
}

export function parseAgentUiUrl(url: string): ParsedAgentUiUrl | null {
  if (!isAgentUiUrl(url)) return null;
  try {
    const normalized = /^[a-z][a-z0-9+.-]*:/i.test(url)
      ? url
      : `ontrack:///${url.replace(/^\/+/, '')}`;
    const parsed = new URL(normalized);
    const op = parseOp(parsed.searchParams.get('op') ?? 'dump');
    const id = parsed.searchParams.get('id') ?? undefined;
    const to =
      parsed.searchParams.get('to') ??
      parsed.searchParams.get('path') ??
      undefined;
    const prefix = parsed.searchParams.get('prefix') ?? undefined;
    const x = parsed.searchParams.get('x') ?? undefined;
    const y = parsed.searchParams.get('y') ?? undefined;
    const slot = parsed.searchParams.get('slot') ?? undefined;
    applyAgentUiSlotFromUnknown(slot);
    return {
      op,
      ...(id ? { id } : {}),
      ...(to ? { to } : {}),
      ...(prefix ? { prefix } : {}),
      ...(x ? { x } : {}),
      ...(y ? { y } : {}),
      ...(slot ? { slot } : {}),
    };
  } catch {
    const opMatch = /[?&]op=([^&]+)/i.exec(url);
    const idMatch = /[?&]id=([^&]+)/i.exec(url);
    const toMatch = /[?&](?:to|path)=([^&]+)/i.exec(url);
    const prefixMatch = /[?&]prefix=([^&]+)/i.exec(url);
    const xMatch = /[?&]x=([^&]+)/i.exec(url);
    const yMatch = /[?&]y=([^&]+)/i.exec(url);
    const slotMatch = /[?&]slot=([^&]+)/i.exec(url);
    const id = idMatch?.[1] ? decodeURIComponent(idMatch[1]) : undefined;
    const to = toMatch?.[1] ? decodeURIComponent(toMatch[1]) : undefined;
    const prefix = prefixMatch?.[1]
      ? decodeURIComponent(prefixMatch[1])
      : undefined;
    const x = xMatch?.[1] ? decodeURIComponent(xMatch[1]) : undefined;
    const y = yMatch?.[1] ? decodeURIComponent(yMatch[1]) : undefined;
    const slot = slotMatch?.[1]
      ? decodeURIComponent(slotMatch[1])
      : undefined;
    applyAgentUiSlotFromUnknown(slot);
    return {
      op: parseOp(opMatch?.[1] ?? 'dump'),
      ...(id ? { id } : {}),
      ...(to ? { to } : {}),
      ...(prefix ? { prefix } : {}),
      ...(x ? { x } : {}),
      ...(y ? { y } : {}),
      ...(slot ? { slot } : {}),
    };
  }
}
