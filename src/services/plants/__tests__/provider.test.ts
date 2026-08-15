jest.mock('@/services/ai/cloudflare-workers-ai', () => ({
  cloudflarePlantAIConfigured: jest.fn(() => true),
  fetchCloudflarePlantJson: jest.fn(),
}));

jest.mock('@/services/ai/vision-transport', () => ({
  defaultOllamaModel: jest.fn(() => 'qwen3-vl'),
  defaultOpenAIModel: jest.fn(() => 'gpt-4.1'),
  fetchOllamaChatJson: jest.fn(),
  fetchOpenAIResponses: jest.fn(),
  parseOpenAIJsonResponse: jest.fn((body) => body),
}));

import { fetchCloudflarePlantJson } from '@/services/ai/cloudflare-workers-ai';
import { fetchOllamaChatJson } from '@/services/ai/vision-transport';
import {
  assertPlantAnalysisEnabled,
  createCarePlan,
  identifyPlantImage,
  validateLocalCarePlan,
} from '@/services/plants/server';
import { validatePlantCarePlan } from '@/services/plants/validate';
import type { PlantHealthAssessment, PlantIdentity, RoomProfile } from '@/types/models';

const mockFetchCloudflarePlantJson = jest.mocked(fetchCloudflarePlantJson);
const mockFetchOllamaChatJson = jest.mocked(fetchOllamaChatJson);

const careIdentity: PlantIdentity = {
  commonName: 'Swiss Cheese Plant',
  scientificName: 'Monstera deliciosa',
  confidence: 0.9,
  identificationSource: 'user-confirmed',
};

const careHealth: PlantHealthAssessment = {
  status: 'healthy',
  summary: 'Leaves look firm.',
  visibleSigns: ['Glossy leaves'],
  possibleCauses: [],
  actions: ['Keep watching'],
  confidence: 0.88,
  assessedAt: '2026-08-15T12:00:00.000Z',
};

const careRoom: RoomProfile = {
  potDiameterCm: 20,
  drainage: 'yes',
  windowDirection: 'north',
  windowDistanceM: 1,
  directSunHours: 0,
};

const ORIGINAL_ENV = { ...process.env };

describe('plant AI provider selection', () => {
  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  it('reuses the enabled local meal-analysis provider by default', () => {
    delete process.env.PLANT_AI_PROVIDER;
    process.env.MEAL_AI_PROVIDER = 'ollama';
    process.env.LOCAL_MEAL_AI_ENABLED = 'true';
    delete process.env.OPENAI_API_KEY;
    expect(assertPlantAnalysisEnabled()).toBeUndefined();
  });

  it('supports an independently enabled local plant provider', () => {
    process.env.PLANT_AI_PROVIDER = 'ollama';
    process.env.LOCAL_MEAL_AI_ENABLED = 'false';
    process.env.LOCAL_PLANT_AI_ENABLED = 'true';
    expect(assertPlantAnalysisEnabled()).toBeUndefined();
  });

  it('keeps the local provider gated when neither local feature is enabled', () => {
    process.env.PLANT_AI_PROVIDER = 'ollama';
    process.env.LOCAL_MEAL_AI_ENABLED = 'false';
    process.env.LOCAL_PLANT_AI_ENABLED = 'false';
    expect(assertPlantAnalysisEnabled()).toMatchObject({ status: 503 });
  });

  it('enables the free hosted provider without requiring local Ollama', () => {
    process.env.PLANT_AI_PROVIDER = 'cloudflare';
    process.env.PLANT_AI_ENABLED = 'true';
    process.env.LOCAL_MEAL_AI_ENABLED = 'false';
    expect(assertPlantAnalysisEnabled()).toBeUndefined();
  });

  it('uses Cloudflare vision for hosted identification', async () => {
    process.env.PLANT_AI_PROVIDER = 'cloudflare';
    mockFetchCloudflarePlantJson.mockResolvedValue({
      identity: { commonName: 'Snake Plant', scientificName: 'Dracaena trifasciata', confidence: 0.94 },
      health: {
        status: 'healthy', summary: 'Leaves appear firm.', visibleSigns: [], possibleCauses: [],
        actions: ['Continue monitoring.'], confidence: 0.88,
      },
    });

    await expect(identifyPlantImage('data:image/jpeg;base64,AA==')).resolves.toMatchObject({
      identity: { commonName: 'Snake Plant', scientificName: 'Dracaena trifasciata' },
      health: { status: 'healthy' },
    });
    expect(mockFetchCloudflarePlantJson).toHaveBeenCalledWith(expect.objectContaining({
      imageDataUrl: 'data:image/jpeg;base64,AA==',
    }));
  });

  it('still requests another photo when hosted identification is uncertain', async () => {
    process.env.PLANT_AI_PROVIDER = 'cloudflare';
    mockFetchCloudflarePlantJson.mockResolvedValue({
      identity: { commonName: 'Unknown Plant', scientificName: 'Unknown species', confidence: 0.4 },
      health: {
        status: 'watch', summary: 'The image is unclear.', visibleSigns: [], possibleCauses: [],
        actions: ['Retake the photo.'], confidence: 0.4,
      },
    });

    await expect(identifyPlantImage('data:image/jpeg;base64,AA==')).rejects.toThrow('UNCLEAR_IMAGE');
  });

  it('attaches fixed references and normalizes contradictory local pruning output', () => {
    const plan = validateLocalCarePlan({
      watering: { minMl: 200, maxMl: 400, intervalDays: 10, soilCheck: 'Check the top 3 cm.', notes: 'Drain excess.' },
      pruning: { urgency: 'now', reason: 'No pruning is needed for this healthy plant.', steps: [] },
      placement: { light: 'Bright indirect light', location: 'Near the east window', windowDistance: '1 m', avoid: [] },
      soil: {
        soilType: 'Well-draining mix',
        phMin: 6,
        phMax: 7,
        mixNotes: 'Indoor potting mix with perlite.',
        drainageNotes: 'Empty saucers after watering.',
        amendments: ['Perlite'],
      },
      sources: [{ title: 'Model supplied', url: 'https://example.com' }],
      disclaimer: 'Model supplied',
    });
    expect(plan?.pruning.urgency).toBe('not-needed');
    expect(plan?.sources.map((source) => source.title)).toEqual([
      'University of Minnesota Extension — Houseplants',
      'Royal Horticultural Society — Houseplants',
    ]);
  });

  it('falls back to a conservative care plan when the model output is invalid', async () => {
    process.env.PLANT_AI_PROVIDER = 'ollama';
    mockFetchOllamaChatJson.mockResolvedValue({ watering: { minMl: 0 } });

    const plan = await createCarePlan({
      identity: careIdentity,
      health: careHealth,
      room: careRoom,
    });

    expect(validatePlantCarePlan(plan)).toMatchObject({
      watering: { minMl: 200, maxMl: 340, intervalDays: 11 },
      placement: { location: 'Near the north window' },
    });
    expect(plan.disclaimer).toContain('Swiss Cheese Plant');
  });

  it('falls back when hosted care planning is unavailable', async () => {
    process.env.PLANT_AI_PROVIDER = 'cloudflare';
    mockFetchCloudflarePlantJson.mockRejectedValue(new Error('CLOUDFLARE_AI_UNAVAILABLE'));

    const plan = await createCarePlan({
      identity: careIdentity,
      health: careHealth,
      room: careRoom,
    });

    expect(validatePlantCarePlan(plan)).not.toBeNull();
    expect(plan.watering.minMl).toBeGreaterThan(0);
  });
});
