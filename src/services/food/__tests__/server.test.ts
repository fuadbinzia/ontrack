jest.mock('@/services/http/api-gate', () => ({ gatePaidApiRequest: jest.fn() }));
jest.mock('@/services/ai/vision-transport', () => ({
  defaultOllamaModel: (...values: Array<string | undefined>) => values.find(Boolean) ?? 'qwen-test',
  defaultOpenAIModel: (...values: Array<string | undefined>) => values.find(Boolean) ?? 'gpt-test',
  fetchOllamaChatJson: jest.fn(),
  fetchOpenAIResponses: jest.fn(),
  parseOpenAIJsonResponse: (body: { output_text?: string }) => JSON.parse(body.output_text ?? ''),
}));

import { gatePaidApiRequest } from '@/services/http/api-gate';
import { fetchOllamaChatJson, fetchOpenAIResponses } from '@/services/ai/vision-transport';

import {
  analyzeIngredientScan,
  assertFoodAIEnabled,
  assertFoodAuthenticated,
  foodAIProvider,
  foodError,
  foodOptionsResponse,
  generateRecipeIdeas,
  normalizeIngredientScan,
  normalizeRecipeIdeaSuggestions,
  sanitizeRecipeIdeasRequest,
} from '../server';

const mockGatePaidApiRequest = jest.mocked(gatePaidApiRequest);
const mockFetchOllamaChatJson = jest.mocked(fetchOllamaChatJson);
const mockFetchOpenAIResponses = jest.mocked(fetchOpenAIResponses);

const originalEnv = process.env;

function validIdea(overrides: Record<string, unknown> = {}) {
  return {
    title: ' Pantry bowl ',
    whyItFits: ' Uses what is available. ',
    usesFromAvailable: ['rice'],
    missingIngredients: [],
    conflictsAvoided: [],
    substitutions: [],
    ingredients: [{ name: ' rice ', quantityText: ' 1 cup ' }],
    steps: [' Mix and serve. '],
    servings: 1.6,
    totalMinutes: 12.4,
    confidence: 1.5,
    caveat: '',
    ...overrides,
  };
}

describe('food AI server boundaries', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...originalEnv };
    delete process.env.FOOD_AI_PROVIDER;
    delete process.env.MEAL_AI_PROVIDER;
    delete process.env.FOOD_AI_ENABLED;
    delete process.env.LOCAL_FOOD_AI_ENABLED;
    delete process.env.LOCAL_MEAL_AI_ENABLED;
    delete process.env.OPENAI_API_KEY;
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('selects providers and enforces each enablement gate', async () => {
    expect(foodAIProvider()).toBe('openai');
    expect((await assertFoodAIEnabled())?.status).toBe(503);

    process.env.FOOD_AI_ENABLED = 'true';
    expect((await assertFoodAIEnabled())?.status).toBe(503);
    process.env.OPENAI_API_KEY = 'synthetic-key';
    expect(assertFoodAIEnabled()).toBeUndefined();

    process.env.FOOD_AI_PROVIDER = 'ollama';
    expect(foodAIProvider()).toBe('ollama');
    expect(assertFoodAIEnabled()?.status).toBe(503);
    process.env.LOCAL_FOOD_AI_ENABLED = 'true';
    expect(assertFoodAIEnabled()).toBeUndefined();
  });

  it('returns stable CORS and error responses', async () => {
    expect(foodOptionsResponse().status).toBe(204);
    const response = foodError('No access', 'PERMISSION_DENIED', 401);
    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: 'No access', code: 'PERMISSION_DENIED' });
  });

  it('maps authentication and rate-limit gates without hiding allowed requests', async () => {
    mockGatePaidApiRequest.mockResolvedValueOnce('unauthenticated');
    expect((await assertFoodAuthenticated({} as Request))?.status).toBe(401);
    mockGatePaidApiRequest.mockResolvedValueOnce('rate_limited');
    expect((await assertFoodAuthenticated({} as Request))?.status).toBe(429);
    mockGatePaidApiRequest.mockResolvedValueOnce(undefined);
    expect(await assertFoodAuthenticated({} as Request)).toBeUndefined();
  });
});

describe('food request and response normalization', () => {
  it('sanitizes recipe input, bounds lists, and rejects empty requests', () => {
    expect(sanitizeRecipeIdeasRequest(null)).toBeUndefined();
    expect(sanitizeRecipeIdeasRequest({ ingredientsText: '   ', pantryIngredients: [] })).toBeUndefined();
    expect(sanitizeRecipeIdeasRequest({
      ingredientsText: '  rice   beans ',
      pantryIngredients: [' salt ', 4, 'pepper'],
      mealType: 'dinner',
      timeframe: 'quick',
      exclusions: { allergens: [' peanuts '], dietary: [' vegan '], avoided: [' olives '] },
    })).toEqual({
      ingredientsText: 'rice beans',
      pantryIngredients: ['salt', 'pepper'],
      mealType: 'dinner',
      timeframe: 'quick',
      exclusions: { allergens: ['peanuts'], dietary: ['vegan'], avoided: ['olives'] },
    });
    expect(sanitizeRecipeIdeasRequest({ ingredientsText: 'rice', mealType: 'supper', timeframe: 'instant' }))
      .toEqual(expect.objectContaining({ mealType: undefined, timeframe: undefined }));
  });

  it('normalizes valid ideas and drops malformed candidates', () => {
    expect(() => normalizeRecipeIdeaSuggestions(null)).toThrow('INVALID_ANALYSIS');
    expect(() => normalizeRecipeIdeaSuggestions({ suggestions: [] })).toThrow('INVALID_ANALYSIS');
    expect(normalizeRecipeIdeaSuggestions({ suggestions: [null, validIdea(), validIdea({ title: '' })] }))
      .toEqual([expect.objectContaining({
        id: 'idea-2', title: 'Pantry bowl', servings: 2, totalMinutes: 12,
        confidence: 1, ingredients: [{ name: 'rice', quantityText: '1 cup' }],
      })]);
  });

  it('normalizes scans, caps local confidence, and requires review at weak boundaries', () => {
    expect(() => normalizeIngredientScan({ ingredients: [] })).toThrow('INVALID_ANALYSIS');
    expect(normalizeIngredientScan({
      productName: ' Granola ', productConfidence: 2,
      ingredients: [{ name: ' Oats ', confidence: 0.9 }, null, { name: '', confidence: 1 }],
      observations: [' Whole grain ', 3], overallConfidence: 0.85,
    })).toEqual(expect.objectContaining({
      productName: 'Granola', productConfidence: 1,
      ingredients: [{ name: 'Oats', confidence: 0.9 }], observations: ['Whole grain'],
      overallConfidence: 0.85, reviewRequired: false,
    }));
    expect(normalizeIngredientScan({
      ingredients: [{ name: 'Oats', confidence: 0.95 }], overallConfidence: 0.95,
    }, { capConfidence: true })).toEqual(expect.objectContaining({
      overallConfidence: 0.75, reviewRequired: true,
      ingredients: [{ name: 'Oats', confidence: 0.75 }],
    }));
  });
});

describe('food provider execution', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...originalEnv, FOOD_AI_ENABLED: 'true', OPENAI_API_KEY: 'synthetic-key' };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('generates normalized OpenAI ideas with exclusions preserved', async () => {
    mockFetchOpenAIResponses.mockResolvedValue({ output_text: JSON.stringify({ suggestions: [validIdea()] }) });
    await expect(generateRecipeIdeas({
      ingredientsText: 'rice', pantryIngredients: [], mealType: 'dinner', timeframe: 'quick',
      exclusions: { allergens: [], dietary: [], avoided: [] },
    })).resolves.toEqual(expect.objectContaining({
      suggestions: [expect.objectContaining({ title: 'Pantry bowl' })],
      exclusionsApplied: { allergens: [], dietary: [], avoided: [] },
    }));
    expect(mockFetchOpenAIResponses).toHaveBeenCalledWith(expect.objectContaining({
      safetyIdentifier: 'ontrack-food-ai', timeoutMs: 60_000,
    }));
  });

  it('rejects invalid scan images before transport and analyzes valid OpenAI images', async () => {
    await expect(analyzeIngredientScan('https://example.com/label.png')).rejects.toThrow('INVALID_IMAGE');
    expect(mockFetchOpenAIResponses).not.toHaveBeenCalled();

    mockFetchOpenAIResponses.mockResolvedValue({ output_text: JSON.stringify({
      productName: 'Granola', productConfidence: 0.9,
      ingredients: [{ name: 'Oats', confidence: 0.9 }], observations: [], overallConfidence: 0.9,
    }) });
    await expect(analyzeIngredientScan('data:image/png;base64,YWJj')).resolves.toEqual(expect.objectContaining({
      productName: 'Granola', reviewRequired: false,
    }));
  });

  it('uses the local provider and caps scan confidence', async () => {
    process.env.FOOD_AI_PROVIDER = 'ollama';
    process.env.LOCAL_FOOD_AI_ENABLED = 'true';
    mockFetchOllamaChatJson.mockResolvedValue({
      productName: 'Granola', productConfidence: 0.99,
      ingredients: [{ name: 'Oats', confidence: 0.99 }], observations: [], overallConfidence: 0.99,
    });
    await expect(analyzeIngredientScan('data:image/jpeg;base64,YWJj')).resolves.toEqual(expect.objectContaining({
      productConfidence: 0.75, overallConfidence: 0.75, reviewRequired: true,
    }));
  });
});
