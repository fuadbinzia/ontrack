import {
  defaultOllamaModel,
  defaultOpenAIModel,
  fetchOllamaChatJson,
  fetchOpenAIResponses,
  parseOpenAIJsonResponse,
} from '@/services/ai/vision-transport';
import {
  cloudflarePlantAIConfigured,
  fetchCloudflarePlantJson,
} from '@/services/ai/cloudflare-workers-ai';
import { gatePaidApiRequest } from '@/services/http/api-gate';
import { apiCorsHeaders } from '@/services/http/cors';
import type { PlantCarePlan, PlantHealthAssessment, PlantIdentity, RoomProfile } from '@/types/models';
import type { PlantServiceErrorCode } from './types';
import { buildFallbackCarePlan, HOUSEPLANT_CARE_SOURCES } from './fallback-care';
import { hasConfidentPlantIdentity, validatePlantCarePlan, validatePlantHealth, validatePlantIdentity } from './validate';

const MAX_IMAGE_LENGTH = 5_500_000;
type PlantAIProvider = 'cloudflare' | 'ollama' | 'openai';

function plantAIProvider(): PlantAIProvider {
  const configured = process.env.PLANT_AI_PROVIDER ?? process.env.MEAL_AI_PROVIDER;
  if (configured === 'cloudflare') return 'cloudflare';
  return configured === 'openai' ? 'openai' : 'ollama';
}

function openAIResponse(payload: Record<string, unknown>) {
  return fetchOpenAIResponses({
    model: defaultOpenAIModel(process.env.OPENAI_PLANT_MODEL),
    safetyIdentifier: 'ontrack-plant-analysis',
    payload,
    timeoutMs: 60_000,
  });
}

function ollamaStructuredResponse(
  prompt: string,
  schema: Record<string, unknown>,
  imageDataUrls: string[] = [],
) {
  return fetchOllamaChatJson({
    model: defaultOllamaModel(
      process.env.OLLAMA_PLANT_MODEL,
      process.env.OLLAMA_MEAL_MODEL,
    ),
    prompt,
    schema,
    imageDataUrls,
    appendNoThink: true,
    numPredict: 1800,
  });
}

function parseBody(body: Record<string, unknown>) {
  return parseOpenAIJsonResponse(body);
}

export const plantCorsHeaders = apiCorsHeaders();

export function plantOptionsResponse(request?: Request) {
  return new Response(null, { status: 204, headers: apiCorsHeaders(request) });
}

export function plantError(error: string, code: PlantServiceErrorCode, status: number) {
  return Response.json({ error, code }, { status, headers: plantCorsHeaders });
}

export async function assertPlantAuthenticated(request: Request) {
  const gate = await gatePaidApiRequest(request, 'plant');
  if (gate === 'unauthenticated') {
    return plantError('Sign in to use plant analysis.', 'PERMISSION_DENIED', 401);
  }
  if (gate === 'rate_limited') {
    return plantError('Too many plant analysis requests. Try again later.', 'RATE_LIMITED', 429);
  }
  return undefined;
}

export function assertPlantAnalysisEnabled() {
  if (plantAIProvider() === 'cloudflare') {
    if (process.env.PLANT_AI_ENABLED !== 'true') {
      return plantError('Cloud plant analysis is disabled for this environment.', 'NOT_CONFIGURED', 503);
    }
    if (!cloudflarePlantAIConfigured()) {
      return plantError('Cloudflare plant analysis is not configured.', 'NOT_CONFIGURED', 503);
    }
    return undefined;
  }
  if (plantAIProvider() === 'ollama') {
    if (process.env.LOCAL_PLANT_AI_ENABLED !== 'true' && process.env.LOCAL_MEAL_AI_ENABLED !== 'true') {
      return plantError(
        'Local plant analysis is disabled. Set LOCAL_PLANT_AI_ENABLED=true or enable the existing local meal analyzer.',
        'NOT_CONFIGURED',
        503,
      );
    }
    return undefined;
  }
  if (process.env.PLANT_AI_ENABLED !== 'true') {
    return plantError('Cloud plant analysis is disabled for this environment.', 'NOT_CONFIGURED', 503);
  }
  if (!process.env.OPENAI_API_KEY) {
    return plantError('OpenAI is not configured.', 'NOT_CONFIGURED', 503);
  }
  return undefined;
}

export function validImageDataUrl(value: unknown): value is string {
  return typeof value === 'string' &&
    /^data:image\/(jpeg|png|webp);base64,/.test(value) &&
    value.length <= MAX_IMAGE_LENGTH;
}

export function validRoomProfile(value: unknown): value is RoomProfile {
  if (typeof value !== 'object' || value === null) return false;
  const room = value as Record<string, unknown>;
  return typeof room.potDiameterCm === 'number' && Number.isFinite(room.potDiameterCm) && room.potDiameterCm > 0 &&
    ['yes', 'no', 'unknown'].includes(String(room.drainage)) &&
    ['north', 'east', 'south', 'west', 'unknown'].includes(String(room.windowDirection)) &&
    typeof room.windowDistanceM === 'number' && Number.isFinite(room.windowDistanceM) && room.windowDistanceM >= 0 &&
    typeof room.directSunHours === 'number' && Number.isFinite(room.directSunHours) && room.directSunHours >= 0 && room.directSunHours <= 24;
}

const HEALTH_SCHEMA = {
  type: 'object', additionalProperties: false,
  required: ['status', 'summary', 'visibleSigns', 'possibleCauses', 'actions', 'confidence'],
  properties: {
    status: { type: 'string', enum: ['healthy', 'watch', 'urgent'] },
    summary: { type: 'string' },
    visibleSigns: { type: 'array', maxItems: 6, items: { type: 'string' } },
    possibleCauses: { type: 'array', maxItems: 5, items: { type: 'string' } },
    actions: { type: 'array', maxItems: 6, items: { type: 'string' } },
    confidence: { type: 'number', minimum: 0, maximum: 1 },
  },
} as const;

const CARE_SCHEMA = {
  type: 'object', additionalProperties: false,
  required: ['watering', 'pruning', 'placement', 'soil', 'sources', 'disclaimer'],
  properties: {
    watering: {
      type: 'object', additionalProperties: false,
      required: ['minMl', 'maxMl', 'intervalDays', 'soilCheck', 'notes'],
      properties: {
        minMl: { type: 'number', minimum: 1, maximum: 20000 },
        maxMl: { type: 'number', minimum: 1, maximum: 20000 },
        intervalDays: { type: 'number', minimum: 1, maximum: 365 },
        soilCheck: { type: 'string' }, notes: { type: 'string' },
      },
    },
    pruning: {
      type: 'object', additionalProperties: false,
      required: ['urgency', 'reason', 'steps'],
      properties: {
        urgency: { type: 'string', enum: ['not-needed', 'soon', 'now'] },
        reason: { type: 'string' },
        steps: { type: 'array', maxItems: 6, items: { type: 'string' } },
      },
    },
    placement: {
      type: 'object', additionalProperties: false,
      required: ['light', 'location', 'windowDistance', 'avoid'],
      properties: {
        light: { type: 'string' }, location: { type: 'string' }, windowDistance: { type: 'string' },
        avoid: { type: 'array', maxItems: 6, items: { type: 'string' } },
      },
    },
    soil: {
      type: 'object', additionalProperties: false,
      required: ['soilType', 'phMin', 'phMax', 'mixNotes', 'drainageNotes', 'amendments'],
      properties: {
        soilType: { type: 'string' },
        phMin: { type: 'number', minimum: 3, maximum: 9 },
        phMax: { type: 'number', minimum: 3, maximum: 9 },
        mixNotes: { type: 'string' },
        drainageNotes: { type: 'string' },
        amendments: { type: 'array', maxItems: 8, items: { type: 'string' } },
      },
    },
    sources: {
      type: 'array', minItems: 1, maxItems: 6,
      items: {
        type: 'object', additionalProperties: false, required: ['title', 'url'],
        properties: { title: { type: 'string' }, url: { type: 'string' } },
      },
    },
    disclaimer: { type: 'string' },
  },
} as const;

const IDENTIFY_SCHEMA = {
  type: 'object', additionalProperties: false, required: ['identity', 'health'],
  properties: {
    identity: {
      type: 'object', additionalProperties: false,
      required: ['commonName', 'scientificName', 'confidence'],
      properties: {
        commonName: { type: 'string' }, scientificName: { type: 'string' },
        confidence: { type: 'number', minimum: 0, maximum: 1 },
      },
    },
    health: HEALTH_SCHEMA,
  },
} as const;

const CHECK_IN_SCHEMA = {
  type: 'object', additionalProperties: false,
  required: ['health', 'careShouldChange', 'carePlan'],
  properties: {
    health: HEALTH_SCHEMA,
    careShouldChange: { type: 'boolean' },
    carePlan: { anyOf: [CARE_SCHEMA, { type: 'null' }] },
  },
} as const;

export async function identifyPlantImage(imageDataUrl: string) {
  const prompt = `Identify this houseplant only when multiple visible features agree. First inspect its growth habit
(vining/trailing, upright pseudostems, cane, rosette, or clumping), then leaf shape, arrangement, venation,
attachment, texture, and variegation. Reject any species whose growth habit or leaf shape conflicts with the
photo. In particular, pothos must show a vining or trailing habit with broad heart-shaped leaves; an upright
clump with pseudostems and narrow lance-shaped leaves is not pothos and may belong to the ginger family.
Do not choose an exact ginger species unless diagnostic flowers, rhizomes, or other distinguishing features
are visible. Report confidence of 0.8 or higher only when at least three compatible diagnostic features are
clearly visible; otherwise return a lower confidence so the app requests another photo. Assess visible health,
separating visible signs from possible causes. Do not diagnose disease or invent unseen conditions. Use concise plain language.`;
  const provider = plantAIProvider();
  const output = provider === 'ollama'
    ? await ollamaStructuredResponse(prompt, IDENTIFY_SCHEMA, [imageDataUrl])
    : provider === 'cloudflare'
      ? await fetchCloudflarePlantJson({ prompt, schema: IDENTIFY_SCHEMA, imageDataUrl })
      : parseBody(await openAIResponse({
      input: [{ role: 'user', content: [
      { type: 'input_text', text: prompt },
      { type: 'input_image', image_url: imageDataUrl, detail: 'high' },
    ] }],
    text: { format: { type: 'json_schema', name: 'plant_identification', strict: true, schema: IDENTIFY_SCHEMA } },
  }));
  const parsed = output as Record<string, unknown>;
  const identity = validatePlantIdentity(parsed.identity);
  const health = validatePlantHealth(parsed.health);
  if (!identity || !health) throw new Error('INVALID_ANALYSIS');
  if (!hasConfidentPlantIdentity(identity)) throw new Error('UNCLEAR_IMAGE');
  return { identity, health };
}

function carePrompt(identity: PlantIdentity, health: PlantHealthAssessment, room: RoomProfile) {
  return `Create a conservative indoor care plan for ${identity.commonName} (${identity.scientificName}). ` +
    `Visible health summary: ${health.summary}. Pot diameter: ${room.potDiameterCm} cm; drainage: ${room.drainage}; ` +
    `window: ${room.windowDirection}; distance: ${room.windowDistanceM} m; direct sun: ${room.directSunHours} hours. ` +
    'Watering must be an editable starting range plus a soil check, not a guarantee. Placement must be relative to the supplied window. ' +
    'Include species-appropriate soil type, target pH range, mix notes, drainage notes, and useful amendments. ' +
    'Do not provide pesticide, medical, or pet-toxicity claims. State that conditions vary.';
}

export function validateLocalCarePlan(value: unknown): PlantCarePlan | null {
  if (typeof value !== 'object' || value === null) return null;
  const raw = value as Record<string, unknown>;
  const pruning = typeof raw.pruning === 'object' && raw.pruning !== null
    ? raw.pruning as Record<string, unknown>
    : undefined;
  const normalizedPruning = pruning && typeof pruning.reason === 'string' && /\b(no|not)\b.*\b(prun\w*|trim\w*|cut\w*)/i.test(pruning.reason)
    ? { ...pruning, urgency: 'not-needed' }
    : pruning;
  return validatePlantCarePlan({
    ...raw,
    pruning: normalizedPruning,
    sources: HOUSEPLANT_CARE_SOURCES,
    disclaimer: 'Generated locally by qwen3-vl as a starting point. Indoor conditions vary; verify uncertain or worsening issues with a qualified horticulturist.',
  });
}

function validateCloudflareCarePlan(value: unknown): PlantCarePlan | null {
  if (typeof value !== 'object' || value === null) return null;
  const raw = value as Record<string, unknown>;
  return validatePlantCarePlan({
    ...raw,
    sources: HOUSEPLANT_CARE_SOURCES,
    disclaimer: 'AI-generated starting guidance based on the details you provided. Indoor conditions vary; verify uncertain or worsening issues with a qualified horticulturist.',
  });
}

export async function createCarePlan(input: {
  identity: PlantIdentity; health: PlantHealthAssessment; room: RoomProfile; roomImageDataUrl?: string;
}): Promise<PlantCarePlan> {
  try {
    const provider = plantAIProvider();
    if (provider === 'ollama') {
      const prompt = carePrompt(input.identity, input.health, input.room) +
        ' Keep pruning urgency logically consistent: use not-needed whenever the reason says pruning is unnecessary. Complete every schema field. The app will attach general horticultural references after generation; use placeholder HTTPS sources in the required sources field.';
      const raw = await ollamaStructuredResponse(
        prompt,
        CARE_SCHEMA,
        input.roomImageDataUrl ? [input.roomImageDataUrl] : [],
      );
      const plan = validateLocalCarePlan(raw);
      if (plan) return plan;
    } else if (provider === 'cloudflare') {
      const raw = await fetchCloudflarePlantJson({
        prompt: carePrompt(input.identity, input.health, input.room) +
          ' Keep pruning urgency logically consistent: use not-needed whenever the reason says pruning is unnecessary. Complete every schema field. Use placeholder HTTPS sources; the app replaces them with fixed horticultural references.',
        schema: CARE_SCHEMA,
        imageDataUrl: input.roomImageDataUrl,
      });
      const plan = validateCloudflareCarePlan(raw);
      if (plan) return plan;
    } else {
      const content: Record<string, unknown>[] = [{ type: 'input_text', text: carePrompt(input.identity, input.health, input.room) }];
      if (input.roomImageDataUrl) content.push({ type: 'input_image', image_url: input.roomImageDataUrl, detail: 'low' });
      const body = await openAIResponse({
        tools: [{ type: 'web_search', search_context_size: 'medium' }],
        input: [{ role: 'user', content: [
          ...content,
          { type: 'input_text', text: 'Use trustworthy university extension, botanical garden, or recognized horticultural sources and return their direct HTTPS URLs.' },
        ] }],
        text: { format: { type: 'json_schema', name: 'plant_care_plan', strict: true, schema: CARE_SCHEMA } },
      });
      const plan = validatePlantCarePlan(parseBody(body));
      if (plan) return plan;
    }
  } catch {
    // Model or transport failure — still return an editable starting plan.
  }
  return buildFallbackCarePlan(input);
}

export async function checkPlantHealth(input: {
  imageDataUrl: string; identity: PlantIdentity; previousHealth: PlantHealthAssessment;
  currentCarePlan: PlantCarePlan; room: RoomProfile;
}) {
  const prompt = `Reassess this known ${input.identity.scientificName}. Previous assessment: ${input.previousHealth.summary}. Compare only supported visible changes. Propose a complete replacement care plan only when the visible evidence justifies it. ${carePrompt(input.identity, input.previousHealth, input.room)}`;
  const provider = plantAIProvider();
  const output = provider === 'ollama'
    ? await ollamaStructuredResponse(
      prompt + ' Complete every schema field. The app will attach general horticultural references to any proposed care plan; use placeholder HTTPS sources in the required sources field.',
      CHECK_IN_SCHEMA,
      [input.imageDataUrl],
    )
    : provider === 'cloudflare'
      ? await fetchCloudflarePlantJson({
        prompt: prompt + ' Complete every schema field. Use placeholder HTTPS sources for any proposed care plan; the app replaces them with fixed horticultural references.',
        schema: CHECK_IN_SCHEMA,
        imageDataUrl: input.imageDataUrl,
      })
      : parseBody(await openAIResponse({
    tools: [{ type: 'web_search', search_context_size: 'low' }],
    input: [{ role: 'user', content: [
      { type: 'input_text', text: prompt + ' Use trustworthy horticultural web sources for any proposed change.' },
      { type: 'input_image', image_url: input.imageDataUrl, detail: 'high' },
    ] }],
    text: { format: { type: 'json_schema', name: 'plant_check_in', strict: true, schema: CHECK_IN_SCHEMA } },
  }));
  const parsed = output as Record<string, unknown>;
  const health = validatePlantHealth(parsed.health);
  const carePlan = parsed.careShouldChange
    ? (provider === 'ollama'
      ? validateLocalCarePlan(parsed.carePlan)
      : provider === 'cloudflare'
        ? validateCloudflareCarePlan(parsed.carePlan)
        : validatePlantCarePlan(parsed.carePlan))
    : null;
  if (!health || (parsed.careShouldChange === true && !carePlan)) throw new Error('INVALID_ANALYSIS');
  return { health, proposedCarePlan: carePlan ?? undefined };
}
