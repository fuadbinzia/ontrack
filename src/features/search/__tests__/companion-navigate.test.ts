import { Platform } from 'react-native';

import { openDeviceAssistant, wazeHttpsNavigateUrl, wazeNavigateUrl } from '../companion-navigate';

describe('companion navigate_to', () => {
  it('builds Waze deep links as an explicit maps handoff', () => {
    expect(wazeNavigateUrl('Next stop')).toBe('waze://?q=Next%20stop&navigate=yes');
    expect(wazeHttpsNavigateUrl('Next stop')).toBe(
      'https://waze.com/ul?q=Next%20stop&navigate=yes',
    );
  });

  it('does not claim Siri can be launched from iOS', async () => {
    const previous = Platform.OS;
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'ios' });
    try {
      await expect(openDeviceAssistant()).resolves.toEqual({
        opened: false,
        reason: 'Siri cannot be started from onTrack. Ask me to do that instead.',
      });
    } finally {
      Object.defineProperty(Platform, 'OS', { configurable: true, value: previous });
    }
  });
});
