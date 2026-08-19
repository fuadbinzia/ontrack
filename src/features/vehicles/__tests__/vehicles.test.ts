import {
  mergePrivateVehiclesFromCloud,
  normalizeVehicle,
  privateVehiclePayload,
} from '@/features/vehicles/normalize';
import { isMaintenanceDue, nextDueDate, nextDueMiles } from '@/features/vehicles/maintenance-due';
import { buildPartsSearchResults, normalizeNhtsaDecode } from '@/services/vehicles/server';
import { safeHttpsUrl } from '@/utils/safe-url';

describe('vehicle normalize', () => {
  it('normalizes a minimal vehicle and strips shared from private payload', () => {
    const now = '2026-07-31T12:00:00.000Z';
    const vehicle = normalizeVehicle({
      id: '00000000-0000-4000-8000-000000000001',
      nickname: 'Civic',
      year: 2018,
      make: 'Honda',
      model: 'Civic',
      baseCurrency: 'usd',
      mode: 'private',
      role: 'owner',
      maintenanceSchedules: [],
      maintenanceLogs: [],
      mileageLogs: [],
      expenses: [],
      parts: [],
      activity: [],
      members: [],
      invites: [],
      createdAt: now,
      updatedAt: now,
    });
    expect(vehicle?.nickname).toBe('Civic');
    expect(vehicle?.baseCurrency).toBe('USD');
    expect(vehicle?.year).toBe(2018);

    const shared = normalizeVehicle({
      ...vehicle,
      mode: 'shared',
    });
    expect(privateVehiclePayload([vehicle!, shared!])).toHaveLength(1);
    expect(privateVehiclePayload([vehicle!, shared!])[0]?.mode).toBe('private');
  });
});

describe('maintenance due', () => {
  it('flags mileage intervals as due', () => {
    expect(
      isMaintenanceDue(
        {
          id: '1',
          title: 'Oil',
          intervalMiles: 5000,
          lastDoneMiles: 10000,
          createdAt: '',
          updatedAt: '',
        },
        16000,
        '2026-07-31',
      ),
    ).toBe(true);
    expect(nextDueMiles({ intervalMiles: 5000, lastDoneMiles: 10000 })).toBe(15000);
  });

  it('clamps month-end service dates instead of skipping a month', () => {
    expect(
      nextDueDate({
        intervalMonths: 1,
        lastDoneAt: '2026-01-31',
      }),
    ).toBe('2026-02-28');
    expect(
      nextDueDate({
        intervalMonths: 3,
        lastDoneAt: '2026-01-31',
      }),
    ).toBe('2026-04-30');
  });
});

describe('vehicle cloud restore', () => {
  it('does not reinsert a stale private copy of a vehicle that is already shared', () => {
    const now = '2026-07-31T12:00:00.000Z';
    const shared = normalizeVehicle({
      id: '00000000-0000-4000-8000-000000000001',
      nickname: 'Shared Civic',
      year: 2018,
      make: 'Honda',
      model: 'Civic',
      baseCurrency: 'USD',
      mode: 'shared',
      role: 'owner',
      createdAt: now,
      updatedAt: now,
    });
    const other = normalizeVehicle({
      id: '00000000-0000-4000-8000-000000000002',
      nickname: 'Private Fit',
      year: 2012,
      make: 'Honda',
      model: 'Fit',
      baseCurrency: 'USD',
      mode: 'private',
      role: 'owner',
      createdAt: now,
      updatedAt: now,
    });
    const stalePrivate = {
      ...shared,
      nickname: 'Stale Civic',
      mode: 'private',
    };

    const merged = mergePrivateVehiclesFromCloud(
      [shared!, other!],
      [stalePrivate, other],
    );

    expect(merged.filter((vehicle) => vehicle.id === shared!.id)).toHaveLength(1);
    expect(merged.find((vehicle) => vehicle.id === shared!.id)?.mode).toBe('shared');
    expect(merged.find((vehicle) => vehicle.id === shared!.id)?.nickname).toBe('Shared Civic');
    expect(merged.find((vehicle) => vehicle.id === other!.id)?.nickname).toBe('Private Fit');
  });
});

describe('vin decode normalize', () => {
  it('maps NHTSA decode values', () => {
    const result = normalizeNhtsaDecode('1HGBH41JXMN109186', {
      Results: [
        {
          ErrorCode: '0',
          Make: 'HONDA',
          Model: 'Civic',
          ModelYear: '2021',
          Trim: 'EX',
          DisplacementL: '1.5',
          EngineCylinders: '4',
        },
      ],
    });
    expect(result.make).toBe('HONDA');
    expect(result.model).toBe('Civic');
    expect(result.year).toBe(2021);
    expect(result.engine).toContain('1.5L');
  });
});

describe('parts search', () => {
  it('builds fitment-scoped retailer links', () => {
    const results = buildPartsSearchResults({
      year: 2018,
      make: 'Honda',
      model: 'Civic',
      query: 'oil filter',
    });
    expect(results.length).toBeGreaterThan(0);
    expect(results[0]?.fitmentLabel).toContain('Honda');
    expect(results.some((item) => item.vendor === 'RockAuto')).toBe(true);
    expect(results[0]?.url).toContain('http');
  });
});

describe('vehicle vendor link safety', () => {
  it('only retains HTTPS links for saved or synced parts', () => {
    expect(safeHttpsUrl('https://example.com/part')).toBe('https://example.com/part');
    expect(safeHttpsUrl('javascript:alert(1)')).toBeUndefined();
    expect(safeHttpsUrl('ontrack://settings')).toBeUndefined();
  });
});
