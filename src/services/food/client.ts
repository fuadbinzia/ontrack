import { apiRequest } from '@/services/http/api-client';
import { resolveExpoApiUrl } from '@/services/http/api-url';
import type { UserFoodProfile } from '@/types/food';
import { prepareJpegDataUrl } from '@/utils/image-persist';

import { buildExclusions, filterUnsafeRecipeIdeas } from './safety';
import type {
  FoodErrorCode,
  IngredientScanAnalysis,
  IngredientScanRequest,
  RecipeIdeasRequest,
  RecipeIdeasResponse,
} from './types';

export class FoodServiceError extends Error {
  constructor(
    message: string,
    readonly code: FoodErrorCode,
    readonly status = 0,
  ) {
    super(message);
    this.name = 'FoodServiceError';
  }
}

function apiUrl(path: string): string {
  return resolveExpoApiUrl(path, {
    configuredBaseUrl:
      process.env.EXPO_PUBLIC_FOOD_API_URL ?? process.env.EXPO_PUBLIC_NUTRITION_API_URL,
    preferConfiguredFirst: true,
    createNotConfiguredError: () =>
      new FoodServiceError('Food AI is not configured for this build.', 'NOT_CONFIGURED'),
  });
}

function post<T>(path: string, body: unknown, signal?: AbortSignal): Promise<T> {
  return apiRequest<T, FoodServiceError>({
    url: apiUrl(path),
    method: 'POST',
    body,
    signal,
    offlineMessage: 'Unable to connect. Check your internet connection.',
    unavailableMessage: 'Food AI is temporarily unavailable.',
    defaultErrorCode: 'PROVIDER_FAILURE',
    createError: (message, code, status) =>
      new FoodServiceError(
        message,
        (code as FoodErrorCode | undefined) ?? 'PROVIDER_FAILURE',
        status ?? 0,
      ),
  });
}

export type RecipeIdeasInput = Omit<RecipeIdeasRequest, 'exclusions'>;

/**
 * AI recipe ideas. Profile exclusions are injected into every request and the
 * response is hard-filtered against severe allergies again on this side —
 * defense in depth over the identical server-side filter.
 */
export async function requestRecipeIdeas(
  input: RecipeIdeasInput,
  profile: UserFoodProfile,
  signal?: AbortSignal,
): Promise<RecipeIdeasResponse> {
  const request: RecipeIdeasRequest = {
    ...input,
    exclusions: buildExclusions(profile),
  };
  const response = await post<RecipeIdeasResponse>('/food/recipe-ideas', request, signal);
  return {
    ...response,
    suggestions: filterUnsafeRecipeIdeas(response.suggestions, profile.allergies),
  };
}

/** Resizes and re-encodes (strips EXIF); label text needs the larger width. */
export async function prepareIngredientImage(photoUri: string): Promise<string> {
  return prepareJpegDataUrl(photoUri, {
    width: 2_048,
    compress: 0.82,
    maxDataUrlLength: 8_000_000,
    onInvalid: (reason) => {
      throw new FoodServiceError(
        reason === 'too_large'
          ? 'The selected image is too large.'
          : 'The selected image could not be prepared.',
        'INVALID_IMAGE',
      );
    },
  });
}

export async function analyzeIngredientPhoto(
  photoUri: string,
  signal?: AbortSignal,
): Promise<IngredientScanAnalysis> {
  const request: IngredientScanRequest = {
    imageDataUrl: await prepareIngredientImage(photoUri),
  };
  return post<IngredientScanAnalysis>('/food/ingredient-scan', request, signal);
}

/** Errors where a deterministic fixture fallback beats a dead end (offline demo). */
export function shouldFallBackToFixtures(error: unknown): boolean {
  return (
    error instanceof FoodServiceError &&
    (error.code === 'OFFLINE' ||
      error.code === 'NOT_CONFIGURED' ||
      error.code === 'PROVIDER_FAILURE')
  );
}
