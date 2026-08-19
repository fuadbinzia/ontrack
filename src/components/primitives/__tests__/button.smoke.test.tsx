import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { fireEvent, render, screen } from '@testing-library/react-native';

import { Button } from '@/components/primitives/button';

const read = (relative: string) =>
  readFileSync(join(process.cwd(), relative), 'utf8');

describe('Button smoke', () => {
  it('fires onPress when enabled', () => {
    const onPress = jest.fn();
    render(
      <Button
        appearance="solid"
        onPress={onPress}
        testID="ontrack.test.button">
        Continue
      </Button>,
    );
    fireEvent.press(screen.getByTestId('ontrack.test.button'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});

describe('IconButton appearance', () => {
  it('defaults to glass and paints no frost disc for ghost', () => {
    const button = read('src/components/primitives/button.tsx');
    const iconButton = button.slice(button.indexOf('interface IconButtonProps'));
    expect(iconButton).toContain("appearance?: 'solid' | 'glass' | 'ghost'");
    expect(iconButton).toContain("appearance = 'glass'");
    expect(iconButton).toContain("const glass = appearance === 'glass'");
    expect(iconButton).toContain("const ghost = appearance === 'ghost'");
    expect(iconButton).toMatch(
      /backgroundColor: glass \|\| ghost\s*\?\s*'transparent'/,
    );
    expect(iconButton).toMatch(/borderWidth: ghost\s*\?\s*0/);
    expect(iconButton).toContain('{glass ? (');
    expect(iconButton).not.toContain('backgroundElevated');
  });
});
