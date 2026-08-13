jest.mock('@/services/http/api-gate', () => ({ gatePaidApiRequest: jest.fn() }));
jest.mock('@/services/http/dependency-guard', () => ({ guardedFetch: jest.fn() }));
jest.mock('../url-safety.server', () => ({ assertPublicDns: jest.fn() }));
jest.mock('@/services/ai/validate', () => ({ validateMealAnalysis: (value: unknown) => value }));
jest.mock('@/services/ai/vision-transport', () => ({
  defaultOllamaModel: (...values: Array<string | undefined>) => values.find(Boolean) ?? 'qwen-test',
  defaultOpenAIModel: (...values: Array<string | undefined>) => values.find(Boolean) ?? 'gpt-test',
  fetchOllamaChatJson: jest.fn(),
  fetchOpenAIResponses: jest.fn(),
  openAIResponseText: (body: { output_text?: string }) => body.output_text,
}));

import { gatePaidApiRequest } from '@/services/http/api-gate';
import { guardedFetch } from '@/services/http/dependency-guard';
import { fetchOllamaChatJson, fetchOpenAIResponses } from '@/services/ai/vision-transport';
import { assertPublicDns } from '../url-safety.server';
import {
  analyzeLinkCandidate,
  analyzePhoto,
  assertAnalysisEnabled,
  assertNutritionAuthenticated,
  enhanceMealImage,
  nutritionError,
  nutritionOptionsResponse,
  resolveLink,
} from '../server';

const mockGatePaidApiRequest = jest.mocked(gatePaidApiRequest);
const mockGuardedFetch = jest.mocked(guardedFetch);
const mockAssertPublicDns = jest.mocked(assertPublicDns);
const mockFetchOllamaChatJson = jest.mocked(fetchOllamaChatJson);
const mockFetchOpenAIResponses = jest.mocked(fetchOpenAIResponses);
const originalEnv = process.env;

const vision = {
  foods: [{
    name: ' Grain bowl ', portion: '', portionGrams: '250', calories: 420,
    proteinG: 28, carbsG: 55, fatG: 12, fiberG: 9, sugarG: 4,
    saturatedFatG: 2, sodiumMg: 500, confidence: 0.92,
  }],
  observations: [' Balanced plate ', '', 4],
  overallConfidence: 0.9,
};

describe('nutrition server gates', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...originalEnv };
    delete process.env.MEAL_AI_PROVIDER;
    delete process.env.LOCAL_MEAL_AI_ENABLED;
    delete process.env.CLINICAL_AI_ENABLED;
    delete process.env.OPENAI_API_KEY;
  });

  afterAll(() => { process.env = originalEnv; });

  it('returns stable preflight and error responses', async () => {
    expect(nutritionOptionsResponse().status).toBe(204);
    const response = nutritionError('No access', 'PERMISSION_DENIED', 401);
    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: 'No access', code: 'PERMISSION_DENIED' });
  });

  it('maps authentication and rate-limit outcomes', async () => {
    mockGatePaidApiRequest.mockResolvedValueOnce('unauthenticated');
    expect((await assertNutritionAuthenticated({} as Request))?.status).toBe(401);
    mockGatePaidApiRequest.mockResolvedValueOnce('rate_limited');
    expect((await assertNutritionAuthenticated({} as Request))?.status).toBe(429);
    mockGatePaidApiRequest.mockResolvedValueOnce(undefined);
    expect(await assertNutritionAuthenticated({} as Request)).toBeUndefined();
  });

  it('enforces local photo and hosted cloud enablement independently', () => {
    process.env.MEAL_AI_PROVIDER = 'ollama';
    expect(assertAnalysisEnabled('photo')?.status).toBe(503);
    process.env.LOCAL_MEAL_AI_ENABLED = 'true';
    expect(assertAnalysisEnabled('photo')).toBeUndefined();

    process.env.MEAL_AI_PROVIDER = 'openai';
    expect(assertAnalysisEnabled()?.status).toBe(503);
    process.env.CLINICAL_AI_ENABLED = 'true';
    expect(assertAnalysisEnabled()?.status).toBe(503);
    process.env.OPENAI_API_KEY = 'synthetic-key';
    expect(assertAnalysisEnabled()).toBeUndefined();
  });
});

describe('meal photo analysis', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...originalEnv, CLINICAL_AI_ENABLED: 'true', OPENAI_API_KEY: 'synthetic-key' };
  });

  afterAll(() => { process.env = originalEnv; });

  it('rejects malformed image input before contacting a provider', async () => {
    await expect(analyzePhoto({ imageDataUrl: 'https://example.com/meal.jpg' })).rejects.toThrow('INVALID_IMAGE');
    await expect(enhanceMealImage({ imageDataUrl: 'data:text/plain;base64,YWJj' })).rejects.toThrow('INVALID_IMAGE');
    expect(mockFetchOpenAIResponses).not.toHaveBeenCalled();
  });

  it('normalizes an OpenAI vision result into a reviewed meal analysis', async () => {
    mockFetchOpenAIResponses.mockResolvedValue({ output_text: JSON.stringify(vision) } as never);
    const result = await analyzePhoto({ imageDataUrl: 'data:image/png;base64,YWJj', mealName: 'Lunch' });
    expect(result).toEqual(expect.objectContaining({
      totalCalories: 420, proteinG: 28, overallConfidence: 0.9, reviewRequired: false,
      recommendations: [expect.objectContaining({ id: 'protein-balance' })],
      observations: ['Balanced plate'],
    }));
    expect(result.items[0]).toEqual(expect.objectContaining({ name: 'Grain bowl', portion: '250 g estimated serving' }));
    expect(result.sources).toEqual([expect.objectContaining({ id: 'ai-estimate' })]);
  });

  it('caps local-model confidence and flags the result for review', async () => {
    process.env.MEAL_AI_PROVIDER = 'ollama';
    mockFetchOllamaChatJson.mockResolvedValue(vision as never);
    const result = await analyzePhoto({ imageDataUrl: 'data:image/jpeg;base64,YWJj' });
    expect(result.overallConfidence).toBe(0.75);
    expect(result.items[0]?.confidence).toBe(0.75);
    expect(result.reviewRequired).toBe(true);
  });

  it('returns the enhanced transparent image and rejects missing provider output', async () => {
    mockGuardedFetch.mockResolvedValueOnce(new Response(JSON.stringify({ data: [{ b64_json: 'cG5n' }] }), { status: 200 }) as never);
    await expect(enhanceMealImage({ imageDataUrl: 'data:image/webp;base64,YWJj', mealName: ' Bowl ' }))
      .resolves.toBe('data:image/png;base64,cG5n');

    mockGuardedFetch.mockResolvedValueOnce(new Response(JSON.stringify({ data: [] }), { status: 200 }) as never);
    await expect(enhanceMealImage({ imageDataUrl: 'data:image/png;base64,YWJj' })).rejects.toThrow('INVALID_IMAGE');
  });
});

describe('public meal link analysis', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...originalEnv, OPENAI_API_KEY: 'synthetic-key' };
  });

  afterAll(() => { process.env = originalEnv; });

  it('analyzes a selected candidate and preserves its verified source', async () => {
    mockFetchOpenAIResponses.mockResolvedValue({ output_text: JSON.stringify(vision) } as never);
    const result = await analyzeLinkCandidate({
      id: 'candidate-1', restaurant: 'Example Cafe', itemName: 'Grain bowl', size: 'regular',
      modifiers: [], servings: 1, confidence: 0.95,
      sources: [{ id: 'menu', kind: 'verified-menu', title: 'Menu', url: 'https://example.com/menu' }],
    });
    expect(result.sources).toEqual(expect.arrayContaining([expect.objectContaining({ id: 'menu' })]));
    expect(result.totalCalories).toBe(420);
  });

  it('resolves one high-confidence public candidate without confirmation', async () => {
    mockGuardedFetch.mockResolvedValueOnce(new Response('<html><script>ignore()</script><p>Grain bowl</p></html>', {
      status: 200, headers: { 'content-type': 'text/html' },
    }) as never);
    mockFetchOpenAIResponses.mockResolvedValue({
      output_text: JSON.stringify({ candidates: [{
        restaurant: 'Example Cafe', itemName: 'Grain bowl', size: 'regular', modifiers: [], servings: 1, confidence: 0.9,
      }] }),
      output: [{ action: { sources: [{ title: 'Official nutrition', url: 'https://example.com/nutrition' }] } }],
    } as never);

    const result = await resolveLink('https://example.com/menu');
    expect(mockAssertPublicDns).toHaveBeenCalledWith('example.com');
    expect(result).toEqual(expect.objectContaining({
      sanitizedUrl: 'https://example.com/menu', needsConfirmation: false,
      candidates: [expect.objectContaining({ id: 'candidate-1', itemName: 'Grain bowl' })],
    }));
    expect(result.candidates[0]?.sources).toHaveLength(2);
  });

  it('reports an empty candidate set as needing confirmation', async () => {
    mockGuardedFetch.mockResolvedValueOnce(new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } }) as never);
    mockFetchOpenAIResponses.mockResolvedValue({ output_text: JSON.stringify({ candidates: [] }) } as never);
    await expect(resolveLink('https://example.com/menu')).resolves.toEqual(expect.objectContaining({
      candidates: [], needsConfirmation: true,
      fallbackMessage: 'Paste the menu text or add a screenshot so the meal can be confirmed.',
    }));
  });
});
