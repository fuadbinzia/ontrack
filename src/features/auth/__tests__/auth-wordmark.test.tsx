import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { render, screen } from '@testing-library/react-native';

import { AuthWordmark } from '@/features/auth/auth-wordmark';

const read = (relative: string) =>
  readFileSync(join(process.cwd(), relative), 'utf8');

describe('AuthWordmark', () => {
  it('renders onTrack at natural tracking', () => {
    render(<AuthWordmark />);

    const mark = screen.getByText('onTrack');
    expect(mark).toBeTruthy();
    expect(mark.props.style).toEqual(
      expect.arrayContaining([expect.objectContaining({ letterSpacing: 0 })]),
    );
  });

  it('keeps welcome and upgrade heroes on the shared wordmark', () => {
    const welcome = read('src/features/auth/welcome-onboard-screen.tsx');
    const hero = read('src/features/auth/auth-hero.tsx');

    expect(welcome).toContain('AuthWordmark');
    expect(hero).toContain('AuthWordmark');
    expect(welcome).not.toContain('letterSpacing: s(3.4)');
    expect(hero).not.toContain('letterSpacing: s(3.4)');
  });
});
