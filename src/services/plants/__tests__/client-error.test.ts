import { PlantServiceError, plantServiceErrorMessage } from '../client-error';

describe('plantServiceErrorMessage', () => {
  it('prefers a PlantServiceError message over the generic fallback', () => {
    expect(plantServiceErrorMessage(
      new PlantServiceError('Plant analysis is temporarily unavailable.', 'PROVIDER_FAILURE', 502),
      'A care plan could not be created.',
    )).toBe('Plant analysis is temporarily unavailable.');
  });

  it('still reads the message when instanceof fails across bundles', () => {
    const error = new Error('Sign in to use plant analysis.');
    error.name = 'PlantServiceError';
    expect(plantServiceErrorMessage(error, 'A care plan could not be created.')).toBe(
      'Sign in to use plant analysis.',
    );
  });

  it('keeps the generic fallback for unrelated throws', () => {
    expect(plantServiceErrorMessage(new SyntaxError('Unexpected token'), 'A care plan could not be created.'))
      .toBe('A care plan could not be created.');
  });
});
