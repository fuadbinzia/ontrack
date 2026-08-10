import {
  isAgentUiUrl,
  parseAgentUiUrl,
} from './handle-agent-ui-parse';
import { handleAgentUiRequest } from './handle-agent-ui-ops';

export type { AgentUiOp, AgentUiRequest, ParsedAgentUiUrl } from './handle-agent-ui-types';
export { isAgentUiUrl, parseAgentUiUrl } from './handle-agent-ui-parse';
export { handleAgentUiRequest } from './handle-agent-ui-ops';

export async function handleAgentUiUrl(url: string): Promise<boolean> {
  const parsed = parseAgentUiUrl(url);
  if (!parsed) return false;
  return handleAgentUiRequest(parsed);
}
