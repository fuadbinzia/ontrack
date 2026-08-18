import { Linking, Platform } from 'react-native';

import { appPrompt } from '@/components/primitives';
import { promptOpenAppSettings } from '@/utils/prompt-open-settings';

jest.mock('@/components/primitives', () => ({
  appPrompt: { alert: jest.fn() },
}));

const { appPrompt: mockedPrompt } = jest.requireMock('@/components/primitives') as {
  appPrompt: { alert: jest.Mock };
};

describe('promptOpenAppSettings', () => {
  beforeEach(() => {
    mockedPrompt.alert.mockClear();
    jest.spyOn(Linking, 'openSettings').mockResolvedValue(undefined as never);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it.each(['ios', 'android'] as const)(
    'opens the OS app settings page on %s when Open Settings is tapped',
    (os) => {
      Platform.OS = os;
      promptOpenAppSettings(
        'Microphone access needed',
        'Allow microphone access in Settings to use voice. Typing still works.',
      );

      expect(appPrompt.alert).toHaveBeenCalledWith(
        'Microphone access needed',
        'Allow microphone access in Settings to use voice. Typing still works.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Open Settings', onPress: expect.any(Function) },
        ],
      );

      const actions = mockedPrompt.alert.mock.calls[0]?.[2] as {
        text: string;
        onPress?: () => void;
      }[];
      actions.find((action) => action.text === 'Open Settings')?.onPress?.();
      expect(Linking.openSettings).toHaveBeenCalled();
    },
  );
});
