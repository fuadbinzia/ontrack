import { render, screen } from '@testing-library/react-native';

import { AppText } from '@/components/primitives/app-text';

describe('AppText smoke', () => {
  it('renders chrome label text', () => {
    render(
      <AppText variant="callout" fit>
        Save trip
      </AppText>,
    );
    expect(screen.getByText('Save trip')).toBeTruthy();
    expect(screen.getByText('Save trip').props.adjustsFontSizeToFit).toBe(true);
  });

  it('does not fit-shrink multiline body copy', () => {
    render(
      <AppText variant="body" numberOfLines={5} adjustsFontSizeToFit>
        Sign in to protect your plans and keep them in step across your devices.
      </AppText>,
    );
    expect(
      screen.getByText(
        'Sign in to protect your plans and keep them in step across your devices.',
      ).props.adjustsFontSizeToFit,
    ).toBe(false);
  });
});
