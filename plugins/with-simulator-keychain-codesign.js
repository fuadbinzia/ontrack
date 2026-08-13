const { withXcodeProject } = require('@expo/config-plugins');

/**
 * Xcode ad-hoc signs iphonesimulator builds ("Sign to Run Locally"). That signature
 * makes expo-secure-store / expo-notifications Keychain APIs fail with
 * errSecMissingEntitlement. Re-sign the .app with a local trusted identity when present.
 */
const SCRIPT_NAME = '[onTrack] Re-sign simulator app for Keychain';
const DEV_LAUNCHER_SCRIPT_NAME = '[Expo Dev Launcher] Strip Local Network Keys for Release';
const SHARING_EXTENSION_TARGET = 'expo-sharing-extension';

function xcodeName(value) {
  return typeof value === 'string' ? value.replace(/^"|"$/g, '') : value;
}

const SHELL_SCRIPT = `set -e
if [ "\${PLATFORM_NAME}" != "iphonesimulator" ]; then
  exit 0
fi
IDENTITY="Apple Development: onTrack Local"
if ! security find-identity -p codesigning -v | grep -Fq "$IDENTITY"; then
  echo "warning: missing $IDENTITY — run scripts/ensure-ios-simulator-codesign.sh"
  exit 0
fi
APP="\${TARGET_BUILD_DIR}/\${WRAPPER_NAME}"
if [ ! -d "$APP" ]; then
  echo "warning: app bundle missing at $APP"
  exit 0
fi
/usr/bin/find "$APP" \\\\( -name "*.framework" -o -name "*.dylib" \\\\) -print0 2>/dev/null | while IFS= read -r -d '' item; do
  /usr/bin/codesign --force --sign "$IDENTITY" --timestamp=none "$item" 2>/dev/null || true
done
/usr/bin/codesign --force --sign "$IDENTITY" --timestamp=none --generate-entitlement-der "$APP"
echo "Re-signed simulator app with $IDENTITY"
`;

function ensureResignPhase(project) {
  const section = project.hash.project.objects.PBXShellScriptBuildPhase || {};
  let hasResignPhase = false;

  for (const key of Object.keys(section)) {
    const phase = section[key];
    if (
      phase &&
      typeof phase === 'object' &&
      (phase.name === SCRIPT_NAME || phase.name === DEV_LAUNCHER_SCRIPT_NAME)
    ) {
      phase.alwaysOutOfDate = 1;
      if (phase.name === SCRIPT_NAME) {
        hasResignPhase = true;
      }
    }
  }
  if (hasResignPhase) {
    return project;
  }

  const target = project.getFirstTarget();
  if (!target?.uuid) {
    return project;
  }
  const addedPhase = project.addBuildPhase([], 'PBXShellScriptBuildPhase', SCRIPT_NAME, target.uuid, {
    shellPath: '/bin/sh',
    shellScript: SHELL_SCRIPT,
  });
  if (addedPhase?.buildPhase) {
    addedPhase.buildPhase.alwaysOutOfDate = 1;
  }
  return project;
}

function disableCcacheForSharingExtension(project) {
  const objects = project.hash.project.objects;
  const targets = objects.PBXNativeTarget || {};
  const configurationLists = objects.XCConfigurationList || {};
  const configurations = objects.XCBuildConfiguration || {};

  const target = Object.values(targets).find(
    (candidate) =>
      candidate &&
      typeof candidate === 'object' &&
      xcodeName(candidate.name) === SHARING_EXTENSION_TARGET,
  );
  const configurationList = target && configurationLists[target.buildConfigurationList];

  for (const configurationRef of configurationList?.buildConfigurations || []) {
    const configuration = configurations[configurationRef.value];
    if (!configuration?.buildSettings) continue;

    // React Native enables ccache at the project level. Extension targets do not
    // inherit PODS_ROOT, so its compiler wrapper otherwise resolves from `/../../`.
    configuration.buildSettings.CC = 'clang';
    configuration.buildSettings.CXX = '"clang++"';
    configuration.buildSettings.LD = 'clang';
    configuration.buildSettings.LDPLUSPLUS = '"clang++"';
  }

  return project;
}

function syncSharingExtensionVersion(project, version) {
  const objects = project.hash.project.objects;
  const targets = objects.PBXNativeTarget || {};
  const configurationLists = objects.XCConfigurationList || {};
  const configurations = objects.XCBuildConfiguration || {};

  const target = Object.values(targets).find(
    (candidate) =>
      candidate &&
      typeof candidate === 'object' &&
      xcodeName(candidate.name) === SHARING_EXTENSION_TARGET,
  );
  const configurationList = target && configurationLists[target.buildConfigurationList];

  for (const configurationRef of configurationList?.buildConfigurations || []) {
    const configuration = configurations[configurationRef.value];
    if (!configuration?.buildSettings) continue;
    configuration.buildSettings.MARKETING_VERSION = version;
  }

  return project;
}

module.exports = function withSimulatorKeychainCodesign(config) {
  return withXcodeProject(config, (config) => {
    config.modResults = syncSharingExtensionVersion(
      disableCcacheForSharingExtension(ensureResignPhase(config.modResults)),
      config.version,
    );
    return config;
  });
};
