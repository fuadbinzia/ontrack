import { validatePlantCarePlan } from '@/services/plants/validate';
import type { PlantHealthAssessment, PlantIdentity, RoomProfile } from '@/types/models';
import {
  buildFallbackCarePlan,
  wateringIntervalDays,
  wateringRangeMl,
} from '../fallback-care';

const identity: PlantIdentity = {
  commonName: 'Swiss Cheese Plant',
  scientificName: 'Monstera deliciosa',
  confidence: 0.9,
  identificationSource: 'user-confirmed',
};

const healthy: PlantHealthAssessment = {
  status: 'healthy',
  summary: 'Leaves look firm.',
  visibleSigns: ['Glossy leaves'],
  possibleCauses: [],
  actions: ['Keep watching'],
  confidence: 0.88,
  assessedAt: '2026-08-15T12:00:00.000Z',
};

const northRoom: RoomProfile = {
  potDiameterCm: 20,
  drainage: 'yes',
  windowDirection: 'north',
  windowDistanceM: 1,
  directSunHours: 0,
};

describe('fallback plant care plan', () => {
  it('builds a valid care plan for a north window with no direct sun', () => {
    const plan = buildFallbackCarePlan({
      identity,
      health: healthy,
      room: northRoom,
      generatedAt: '2026-08-15T12:00:00.000Z',
    });

    expect(validatePlantCarePlan(plan)).toMatchObject({
      watering: { minMl: 200, maxMl: 340, intervalDays: 11 },
      placement: {
        location: 'Near the north window',
        windowDistance: 'About 1 m from the glass',
      },
    });
    expect(plan.sources.length).toBeGreaterThan(0);
    expect(plan.sources.every((source) => source.url.startsWith('https:'))).toBe(true);
    expect(plan.disclaimer).toContain('Swiss Cheese Plant');
  });

  it('scales watering with pot size and keeps amounts inside the care schema', () => {
    expect(wateringRangeMl(8)).toEqual({ minMl: 32, maxMl: 54 });
    expect(wateringRangeMl(20)).toEqual({ minMl: 200, maxMl: 340 });
    expect(wateringRangeMl(80)).toEqual({ minMl: 3200, maxMl: 5440 });
    expect(wateringRangeMl(3).minMl).toBe(32);
    expect(wateringRangeMl(200).maxMl).toBe(5440);
  });

  it('shortens the interval for a sunny south window and urgent health', () => {
    const sunnySouth: RoomProfile = {
      potDiameterCm: 20,
      drainage: 'yes',
      windowDirection: 'south',
      windowDistanceM: 0.5,
      directSunHours: 6,
    };
    expect(wateringIntervalDays(sunnySouth, healthy)).toBe(5);
    expect(wateringIntervalDays(sunnySouth, { ...healthy, status: 'urgent' })).toBe(4);
    expect(wateringIntervalDays(northRoom, { ...healthy, status: 'watch' })).toBe(6);
  });

  it('warns when the pot has no drainage holes', () => {
    const plan = buildFallbackCarePlan({
      identity,
      health: healthy,
      room: { ...northRoom, drainage: 'no' },
    });

    expect(plan.watering.notes).toMatch(/sparingly/i);
    expect(plan.soil.drainageNotes).toMatch(/no drainage holes/i);
    expect(validatePlantCarePlan(plan)).not.toBeNull();
  });
});
