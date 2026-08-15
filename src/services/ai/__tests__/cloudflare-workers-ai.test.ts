import {
  cloudflarePlantAIConfigured,
  fetchCloudflarePlantJson,
} from '@/services/ai/cloudflare-workers-ai';
import { resetDependencyGuardsForTests } from '@/services/http/dependency-guard';

const ORIGINAL_ENV = { ...process.env };

describe('Cloudflare Workers AI transport', () => {
  beforeEach(() => {
    process.env = {
      ...ORIGINAL_ENV,
      CLOUDFLARE_PLANT_AI_URL: 'https://plant-ai.example.workers.dev',
      CLOUDFLARE_PLANT_AI_SHARED_SECRET: 'synthetic-test-secret',
    };
    resetDependencyGuardsForTests();
    jest.restoreAllMocks();
  });

  afterAll(() => {
    process.env = ORIGINAL_ENV;
  });

  it('sends credentials only to the configured HTTPS gateway and parses fenced JSON', async () => {
    const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue(new Response(JSON.stringify({
      response: '```json\n{"status":"healthy"}\n```',
    }), { status: 200 }));

    await expect(fetchCloudflarePlantJson({
      prompt: 'Assess the plant.',
      schema: { type: 'object' },
      imageDataUrl: 'data:image/jpeg;base64,AA==',
    })).resolves.toEqual({ status: 'healthy' });

    expect(fetchSpy).toHaveBeenCalledWith(
      new URL('https://plant-ai.example.workers.dev/v1/structured'),
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer synthetic-test-secret',
        }),
      }),
    );
  });

  it('refuses insecure gateway configuration before making a request', async () => {
    process.env.CLOUDFLARE_PLANT_AI_URL = 'http://plant-ai.example.workers.dev';
    const fetchSpy = jest.spyOn(global, 'fetch');

    await expect(fetchCloudflarePlantJson({
      prompt: 'Assess the plant.',
      schema: { type: 'object' },
    })).rejects.toThrow('CLOUDFLARE_AI_UNAVAILABLE');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('reports incomplete configuration and maps provider failures', async () => {
    delete process.env.CLOUDFLARE_PLANT_AI_SHARED_SECRET;
    expect(cloudflarePlantAIConfigured()).toBe(false);

    process.env.CLOUDFLARE_PLANT_AI_SHARED_SECRET = 'synthetic-test-secret';
    jest.spyOn(global, 'fetch').mockResolvedValue(new Response(null, { status: 503 }));
    await expect(fetchCloudflarePlantJson({
      prompt: 'Assess the plant.',
      schema: { type: 'object' },
    })).rejects.toThrow('CLOUDFLARE_AI_UNAVAILABLE');
  });

  it('extracts the first complete JSON object when a model adds trailing prose', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue(new Response(JSON.stringify({
      response: '{"summary":"A brace } inside text is safe."}\nExtra explanation',
    }), { status: 200 }));

    await expect(fetchCloudflarePlantJson({
      prompt: 'Assess the plant.',
      schema: { type: 'object' },
    })).resolves.toEqual({ summary: 'A brace } inside text is safe.' });
  });
});
