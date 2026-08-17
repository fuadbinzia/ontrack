import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { render, screen } from '@testing-library/react-native';

import { Button } from '@/components/primitives/button';
import { SettingsToggleRow } from '@/components/primitives/settings-row';

describe('primitive accessibility contract', () => {
  it('announces settings toggles as switches with checked state', () => {
    render(
      <SettingsToggleRow
        label="Usage Analytics"
        value
        onValueChange={() => undefined}
        testID="ontrack.test.toggle"
      />,
    );
    const toggle = screen.getByTestId('ontrack.test.toggle');
    expect(toggle.props.accessibilityRole).toBe('switch');
    expect(toggle.props.accessibilityState).toEqual(
      expect.objectContaining({ checked: true, disabled: false }),
    );
  });

  it('names progress rings and exposes a percent value', () => {
    const source = readFileSync(join(__dirname, '../progress-ring.tsx'), 'utf8');
    expect(source).toContain('accessibilityRole="progressbar"');
    expect(source).toContain('[label, sublabel].filter(Boolean).join(\', \') || \'Progress\'');
    expect(source).toContain('accessibilityValue={{ now: Math.round(clamped * 100), min: 0, max: 100 }}');
  });

  it('keeps disabled buttons readable instead of near-invisible', () => {
    render(
      <Button disabled appearance="solid" testID="ontrack.test.disabled">
        Save
      </Button>,
    );
    const button = screen.getByTestId('ontrack.test.disabled');
    const style = Array.isArray(button.props.style)
      ? Object.assign({}, ...button.props.style)
      : button.props.style;
    expect(style.opacity).toBeGreaterThanOrEqual(0.5);
  });
});
