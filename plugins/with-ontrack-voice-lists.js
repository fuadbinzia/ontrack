const fs = require('fs');
const path = require('path');
const {
  AndroidConfig,
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

function copySwiftIntoIosProject(config) {
  return withDangerousMod(config, [
    'ios',
    (mod) => {
      const projectName = mod.modRequest.projectName;
      if (!projectName) return mod;
      const targetDir = path.join(
        mod.modRequest.platformProjectRoot,
        projectName,
        GROUP_NAME,
      );
      fs.mkdirSync(targetDir, { recursive: true });
      for (const file of swiftSources()) {
        fs.copyFileSync(file.from, path.join(targetDir, file.name));
      }
      return mod;
    },
  ]);
}

function fileAlreadyInProject(project, fileName) {
  const section = project.pbxFileReferenceSection() || {};
  return Object.values(section).some(
    (file) => file && typeof file === 'object' && file.name === fileName,
  );
}

function addSwiftToXcode(config) {
  return withXcodeProject(config, (mod) => {
    const project = mod.modResults;
    const projectName = mod.modRequest.projectName;
    const targetUuid = project.getFirstTarget()?.uuid;
    if (!projectName || !targetUuid) return mod;

    const groupPath = `${projectName}/${GROUP_NAME}`;
    for (const file of swiftSources()) {
      if (fileAlreadyInProject(project, file.name)) continue;
      project.addSourceFile(`${groupPath}/${file.name}`, { target: targetUuid });
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
  config = copySwiftIntoIosProject(config);
  config = addSwiftToXcode(config);
  config = copyAndroidShortcuts(config);
  config = addShortcutsMeta(config);
  return config;
};
