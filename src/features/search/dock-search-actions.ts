import { companionStatusMessage } from './companion-status';
import { runCompanionMessage } from './companion-runtime';
import { ensureCompanionReady } from './ensure-companion';
import { useDockSearch } from './dock-search-store';

function keepSearchQuery(text: string, reply: string): string {
  const store = useDockSearch.getState();
  store.appendTranscript('system', reply);
  store.setQuery(text);
  return reply;
}

export async function sendDockMessage(
  text: string,
  options: { signedIn: boolean; aiEnabled: boolean },
): Promise<string> {
  const trimmed = text.trim();
  if (!trimmed) return '';
  const store = useDockSearch.getState();
  store.setQuery('');
  store.appendTranscript('user', trimmed);
  if (!options.aiEnabled) {
    return keepSearchQuery(trimmed, 'AI is off in Preferences. Search still works.');
  }
  ensureCompanionReady();
  try {
    const result = await runCompanionMessage(trimmed, { isGuest: !options.signedIn });
    store.appendTranscript('agent', result.text);
    return result.text;
  } catch (error) {
    return keepSearchQuery(trimmed, companionStatusMessage(error));
  }
}
