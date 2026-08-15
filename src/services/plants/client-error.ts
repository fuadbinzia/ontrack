import type { PlantServiceErrorCode } from './types';

export class PlantServiceError extends Error {
  constructor(
    message: string,
    readonly code: PlantServiceErrorCode,
    readonly status = 0,
  ) {
    super(message);
    this.name = 'PlantServiceError';
  }
}

export function plantServiceErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof PlantServiceError && error.message.trim()) return error.message;
  if (error instanceof Error && error.name === 'PlantServiceError' && error.message.trim()) {
    return error.message;
  }
  return fallback;
}
