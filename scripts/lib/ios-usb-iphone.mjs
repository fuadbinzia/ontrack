#!/usr/bin/env node
/**
 * Pick the USB-connected physical iPhone from `devicectl list devices --json`.
 * Prints the hardware UDID. Prefers a wired + connected tunnel.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export function pickUsbIphoneUdid(payload) {
  const devices = Array.isArray(payload?.result?.devices)
    ? payload.result.devices
    : Array.isArray(payload?.devices)
      ? payload.devices
      : [];
  const phones = devices.filter((device) => {
    const product = String(device?.hardwareProperties?.marketingName ?? '');
    const deviceType = String(device?.deviceProperties?.deviceType ?? '');
    return /iphone/i.test(product) || deviceType === 'iPhone';
  });
  const wired = phones.filter((device) => {
    const connection = device?.connectionProperties ?? {};
    return connection.transportType === 'wired';
  });
  const tunneled = wired.filter((device) => {
    const connection = device?.connectionProperties ?? {};
    return connection.tunnelState === 'connected';
  });
  // Launch acquires the developer tunnel — a wired phone with
  // tunnelState "disconnected" is still the USB target.
  const chosen = tunneled[0] ?? wired[0] ?? phones.find((device) => {
    const connection = device?.connectionProperties ?? {};
    return connection.tunnelState === 'connected';
  });
  const udid = chosen?.hardwareProperties?.udid ?? chosen?.identifier;
  if (!udid) {
    throw new Error('no connected iPhone (plug in USB and unlock)');
  }
  return String(udid);
}

function isCli() {
  try {
    return Boolean(process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]);
  } catch {
    return false;
  }
}

if (isCli()) {
  const raw = readFileSync(0, 'utf8');
  const payload = raw.trim() ? JSON.parse(raw) : {};
  process.stdout.write(pickUsbIphoneUdid(payload));
}
