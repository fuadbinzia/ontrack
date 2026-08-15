import {
  ESPN_UFC_REQUEST_HEADERS,
  espnUfcScoreboardUrls,
  parseEspnUfcScoreboard,
} from './espn-ufc';
import type { EventSearchResponse } from './types';

/**
 * Read ESPN's public UFC scoreboard on-device. Hosted discovery needs a
 * SportsDB key and an ESPN-capable proxy; the phone needs neither.
 */
export async function searchEspnUfcFromDevice(
  query: string,
  signal?: AbortSignal,
): Promise<EventSearchResponse> {
  const headerSets: Record<string, string>[] = [
    { Accept: 'application/json' },
    { ...ESPN_UFC_REQUEST_HEADERS },
  ];
  let lastError: unknown;
  for (const headers of headerSets) {
    for (const url of espnUfcScoreboardUrls()) {
      try {
        const response = await globalThis.fetch(url, { signal, headers });
        if (!response.ok) {
          lastError = new Error(`HTTP_${response.status}`);
          continue;
        }
        return {
          results: parseEspnUfcScoreboard(await response.json(), query),
          page: 0,
          hasMore: false,
        };
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') throw error;
        lastError = error;
      }
    }
  }
  throw lastError instanceof Error ? lastError : new Error('ESPN_UNAVAILABLE');
}
