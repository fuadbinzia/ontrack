import { resolvePerformancePressureCap } from '../use-performance-tier';

describe('performance pressure caps', () => {
  it('uses a reversible minimal cap for low power and serious heat', () => {
    expect(resolvePerformancePressureCap({ lowPowerMode: true, thermalState: 'nominal' })).toBe('minimal');
    expect(resolvePerformancePressureCap({ lowPowerMode: false, thermalState: 'serious' })).toBe('minimal');
  });

  it('uses static for critical heat and clears when pressure recovers', () => {
    expect(resolvePerformancePressureCap({ lowPowerMode: false, thermalState: 'critical' })).toBe('static');
    expect(resolvePerformancePressureCap({ lowPowerMode: false, thermalState: 'fair' })).toBeNull();
  });
});
