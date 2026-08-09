import { render, screen } from '@testing-library/react-native';

import { AppBootLoader } from '@/features/auth/app-boot-loader';

jest.mock('@/hooks/use-performance-tier', () => ({
  usePerformanceTier: () => ({
    allowsLoopMotion: false,
    allowsBlur: false,
    allowsSensors: false,
    allowsSharedElement: false,
    particleScale: 0,
    tier: 'static',
    capability: 'static',
    degrade: jest.fn(),
  }),
}));

describe('AppBootLoader', () => {
  it('leads with the brand and exposes a Loading onTrack progress label', () => {
    render(<AppBootLoader />);
    expect(screen.getByText('onTrack')).toBeTruthy();
    expect(screen.getByLabelText('Loading onTrack…')).toBeTruthy();
    expect(screen.getByText('Loading onTrack…')).toBeTruthy();
  });
});
