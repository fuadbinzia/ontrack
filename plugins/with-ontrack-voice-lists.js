const fs = require('fs');
const path = require('path');
const {
  AndroidConfig,
  IOSConfig,
  withAndroidManifest,
  withDangerousMod,
  withXcodeProject,
} = require('expo/config-plugins');

const SWIFT_INTENT = 'OnTrackVoiceIntents.swift';
const SWIFT_STORE = 'OnTrackVoiceStore.swift';
const SHORTCUTS_FILE = 'ontrack_voice_shortcuts.xml';
const GROUP_NAME = 'OnTrackVoice';

function pluginDir() {
  return path.join(__dirname, 'ontrack-voice-lists');
}

function moduleIosDir() {
  return path.join(__dirname, '..', 'modules', 'ontrack-voice-lists', 'ios');
}

function swiftSources() {
  return [
    { name: SWIFT_STORE, from: path.join(moduleIosDir(), SWIFT_STORE) },
    { name: SWIFT_INTENT, from: path.join(pluginDir(), SWIFT_INTENT) },
  ];
}

function addSwiftSources(config) {
  return withXcodeProject(config, (mod) => {
    const projectName = mod.modRequest.projectName;
    const nativeRoot = mod.modRequest.platformProjectRoot;
    if (!projectName) return mod;

    const groupPath = `${projectName}/${GROUP_NAME}`;
    fs.mkdirSync(path.join(nativeRoot, groupPath), { recursive: true });
    IOSConfig.XcodeUtils.ensureGroupRecursively(mod.modResults, groupPath);

    for (const file of swiftSources()) {
      mod.modResults = IOSConfig.XcodeProjectFile.createBuildSourceFile({
        project: mod.modResults,
        nativeProjectRoot: nativeRoot,
        filePath: `${groupPath}/${file.name}`,
        fileContents: fs.readFileSync(file.from, 'utf8'),
        overwrite: true,
      });
    }
    return mod;
  });
}

function copyAndroidShortcuts(config) {
  return withDangerousMod(config, [
    'android',
    (mod) => {
      const xmlDir = path.join(
        mod.modRequest.platformProjectRoot,
        'app',
        'src',
        'main',
        'res',
        'xml',
      );
      fs.mkdirSync(xmlDir, { recursive: true });
      fs.copyFileSync(
        path.join(pluginDir(), SHORTCUTS_FILE),
        path.join(xmlDir, SHORTCUTS_FILE),
      );
      return mod;
    },
  ]);
}

function addShortcutsMeta(config) {
  return withAndroidManifest(config, (mod) => {
    const mainActivity = AndroidConfig.Manifest.getMainActivityOrThrow(
      mod.modResults,
    );
    mainActivity['meta-data'] = mainActivity['meta-data'] || [];
    const exists = mainActivity['meta-data'].some(
      (item) => item.$?.['android:name'] === 'android.app.shortcuts',
    );
    if (!exists) {
      mainActivity['meta-data'].push({
        $: {
          'android:name': 'android.app.shortcuts',
          'android:resource': '@xml/ontrack_voice_shortcuts',
        },
      });
    }
    return mod;
  });
}

module.exports = function withOnTrackVoiceLists(config) {
  config = addSwiftSources(config);
  config = copyAndroidShortcuts(config);
  config = addShortcutsMeta(config);
  return config;
};
