const DUAL_EXIT_PATTERN = /verify-both:\s+ios_exit=(\d+)\s+android_exit=(\d+)/g;

function parseDualPlatformExit(output, commandExitCode) {
  let match;
  let lastMatch;
  while ((match = DUAL_EXIT_PATTERN.exec(output)) !== null) {
    lastMatch = match;
  }
  DUAL_EXIT_PATTERN.lastIndex = 0;

  if (lastMatch) {
    return {
      ios: Number(lastMatch[1]),
      android: Number(lastMatch[2]),
    };
  }

  const fallback = commandExitCode === 0 ? 1 : (commandExitCode ?? 1);
  return { ios: fallback, android: fallback };
}

function failureStepFor(platform, exitCode, output) {
  if (exitCode === 0) return undefined;
  if (exitCode === 3 || /no free agent device slot/i.test(output)) {
    return 'infrastructure:no-device-slot';
  }
  if (platform === 'android' && /Android.*(?:bridge|packager\/app).*(?:quiet|not answering|not ready)|reconnect timed out/is.test(output)) {
    return 'infrastructure:android-bridge';
  }
  if (/emulator failed to become ready|Android emulator is not up and ready/i.test(output)) {
    return 'infrastructure:android-emulator';
  }
  return `flow:${platform}`;
}

module.exports = { failureStepFor, parseDualPlatformExit };
