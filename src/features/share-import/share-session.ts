import type { SharePayload } from 'expo-sharing';

/** Native share payloads are cleared after handoff, while Expo Router may still restore the old route. */
export function hasIncomingSharePayloads(payloads: readonly SharePayload[]): boolean {
  return payloads.length > 0;
}

export function shouldConfirmShareDiscard(
  payloads: readonly SharePayload[],
  allowLeave: boolean,
): boolean {
  return !allowLeave && hasIncomingSharePayloads(payloads);
}

