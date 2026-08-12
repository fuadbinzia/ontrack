const fs = require('fs');
const path = require('path');
const {
  AndroidConfig,
  withAndroidManifest,
  withDangerousMod,
  withXcodeProject,
} = require('expo/config-plugins');

const SWIFT_FILES = ['OnTrackVoiceStore.swift', 'OnTrackVoiceIntents.swift'];
const SHORTCUTS_FILE = 'ontrack_voice_shortcuts.xml';
const GROUP_NAME = 'OnTrackVoice';

function pluginDir() {
  return path.join(__dirname, 'ontrack-voice-lists');
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
      for (const fileName of SWIFT_FILES) {
        fs.copyFileSync(
          path.join(pluginDir(), fileName),
          path.join(targetDir, fileName),
        );
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
    for (const fileName of SWIFT_FILES) {
      if (fileAlreadyInProject(project, fileName)) continue;
      project.addSourceFile(`${groupPath}/${fileName}`, { target: targetUuid });
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
