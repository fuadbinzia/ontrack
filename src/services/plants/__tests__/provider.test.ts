jest.mock('@/services/ai/cloudflare-workers-ai', () => ({
  cloudflarePlantAIConfigured: jest.fn(() => true),
  fetchCloudflarePlantJson: jest.fn(),
}));

import { fetchCloudflarePlantJson } from '@/services/ai/cloudflare-workers-ai';
import {
  assertPlantAnalysisEnabled,
  identifyPlantImage,
  validateLocalCarePlan,
} from '@/services/plants/server';

const mockFetchCloudflarePlantJson = jest.mocked(fetchCloudflarePlantJson);

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
});
