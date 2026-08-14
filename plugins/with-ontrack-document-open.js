const { withAppDelegate } = require('@expo/config-plugins');

const SHORT_CIRCUITED_LINKING =
  'return super.application(app, open: url, options: options) || RCTLinkingManager.application(app, open: url, options: options)';
const FORWARDED_LINKING = `// Always notify React Native. \`super\` can report the URL as handled by an
    // Expo subscriber, and placing it first in an \`||\` expression would then
    // short-circuit the event that JavaScript is listening for.
    let linkingResult = RCTLinkingManager.application(app, open: url, options: options)
    let expoResult = super.application(app, open: url, options: options)
    return expoResult || linkingResult`;

function patchAppDelegate(contents) {
  if (contents.includes('let linkingResult = RCTLinkingManager.application(app, open: url')) {
    return contents;
  }
  if (!contents.includes(SHORT_CIRCUITED_LINKING)) {
    throw new Error('Could not find the Expo AppDelegate linking handler to patch.');
  }
  return contents.replace(SHORT_CIRCUITED_LINKING, FORWARDED_LINKING);
}

function withOnTrackDocumentOpen(config) {
  return withAppDelegate(config, (mod) => {
    if (mod.modResults.language !== 'swift') {
      throw new Error('onTrack document opening requires a Swift AppDelegate.');
    }
    mod.modResults.contents = patchAppDelegate(mod.modResults.contents);
    return mod;
  });
}

module.exports = withOnTrackDocumentOpen;
module.exports.patchAppDelegate = patchAppDelegate;
