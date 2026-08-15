import { defaultSoilRecommendation } from '@/services/plants/soil';
import type {
  PlantCarePlan,
  PlantCareSource,
  PlantHealthAssessment,
  PlantIdentity,
  RoomProfile,
} from '@/types/models';

export const HOUSEPLANT_CARE_SOURCES: PlantCareSource[] = [
  { title: 'University of Minnesota Extension — Houseplants', url: 'https://extension.umn.edu/houseplants' },
  { title: 'Royal Horticultural Society — Houseplants', url: 'https://www.rhs.org.uk/plants/types/houseplants' },
];

export function wateringRangeMl(potDiameterCm: number): { minMl: number; maxMl: number } {
  const diameter = Math.min(80, Math.max(8, potDiameterCm));
  return {
    minMl: Math.round(diameter * diameter * 0.5),
    maxMl: Math.round(diameter * diameter * 0.85),
  };
}

export function wateringIntervalDays(room: RoomProfile, health: PlantHealthAssessment): number {
  let days = 8;
  if (room.directSunHours >= 5) days -= 2;
  else if (room.directSunHours <= 1) days += 2;
  if (room.windowDirection === 'south') days -= 1;
  if (room.windowDirection === 'north') days += 1;
  if (room.drainage === 'no') days -= 1;
  if (health.status === 'urgent') days = Math.min(days, 4);
  if (health.status === 'watch') days = Math.min(days, 6);
  return Math.min(21, Math.max(3, days));
}

function windowLabel(direction: RoomProfile['windowDirection']): string {
  return direction === 'unknown' ? 'nearest' : direction;
}

export function buildFallbackCarePlan(input: {
  identity: PlantIdentity;
  health: PlantHealthAssessment;
  room: RoomProfile;
  generatedAt?: string;
}): PlantCarePlan {
  const { identity, health, room } = input;
  const { minMl, maxMl } = wateringRangeMl(room.potDiameterCm);
  const intervalDays = wateringIntervalDays(room, health);
  const soil = defaultSoilRecommendation();
  const direction = windowLabel(room.windowDirection);

  return {
    watering: {
      minMl,
      maxMl,
      intervalDays,
      soilCheck: 'Water when the top 3 cm of mix feel dry.',
      notes: room.drainage === 'no'
        ? 'Water sparingly. Empty any cachepot after 15 minutes so roots do not sit in runoff.'
        : 'Soak thoroughly, then let the pot drain fully before returning it to its saucer.',
    },
    pruning: health.status === 'urgent'
      ? {
        urgency: 'now',
        reason: 'Visible stress is enough to remove damaged leaves so the plant can recover.',
        steps: ['Use clean shears.', 'Cut yellow or soft leaves at the petiole.'],
      }
      : health.status === 'watch'
        ? {
          urgency: 'soon',
          reason: 'A few leaves look off. Remove only fully yellow or damaged growth.',
          steps: ['Wait until a leaf is fully spent.', 'Cut the petiole close to the stem.'],
        }
        : {
          urgency: 'not-needed',
          reason: 'No damaged growth needs removal right now.',
          steps: ['Use clean shears if a leaf yellows fully.'],
        },
    placement: {
      light: room.directSunHours >= 4
        ? 'Bright light with a few hours of direct sun, filtered if leaves scorch.'
        : room.directSunHours <= 1
          ? 'Bright, indirect light. Avoid a dim corner even if the window faces north.'
          : 'Bright, indirect light for most of the day.',
      location: `Near the ${direction} window`,
      windowDistance: room.windowDistanceM <= 0
        ? 'Close to the glass, watching for chill or scorch.'
        : `About ${room.windowDistanceM} m from the glass`,
      avoid: ['Heating vents', 'Cold drafts', 'Soggy saucers'],
    },
    soil: {
      ...soil,
      drainageNotes: room.drainage === 'no'
        ? 'This pot has no drainage holes. Water sparingly and empty any cachepot after 15 minutes.'
        : soil.drainageNotes,
    },
    sources: HOUSEPLANT_CARE_SOURCES,
    disclaimer:
      `Conservative starting care for ${identity.commonName}. Indoor conditions vary; treat amounts as a range and check the soil before watering.`,
    generatedAt: input.generatedAt ?? new Date().toISOString(),
  };
}
