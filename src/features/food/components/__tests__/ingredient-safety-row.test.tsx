import { render, screen } from '@testing-library/react-native';

import {
    IngredientSafetyRow,
    ingredientSafetyIcon,
    ingredientSafetyLabel,
    ingredientSafetyReasonPlacement,
    ingredientSafetyRowKey,
    ingredientSafetyStatusForLevel,
    ingredientSafetyTone,
    type IngredientSafetyStatus,
} from '@/features/food/components/ingredient-safety-row';

let mockWidthClass: 'compact' | 'regular' | 'large' = 'regular';

jest.mock('@/hooks/use-responsive', () => {
  const actual = jest.requireActual('@/hooks/use-responsive');
  return {
    ...actual,
    useResponsive: () => ({
      ...actual.useResponsive(),
      widthClass: mockWidthClass,
    }),
  };
});

describe('ingredient safety mappings', () => {
  it('reason sits inline on regular/large and moves below on compact', () => {
    expect(ingredientSafetyReasonPlacement('compact')).toBe('below');
    expect(ingredientSafetyReasonPlacement('regular')).toBe('inline');
    expect(ingredientSafetyReasonPlacement('large')).toBe('inline');
  });

  it('every status carries icon + label (never color-only)', () => {
    const statuses: IngredientSafetyStatus[] = [
      'safe',
      'avoided',
      'mild',
      'moderate',
      'severe',
    ];
    for (const status of statuses) {
      expect(ingredientSafetyIcon(status)).toBeTruthy();
      expect(ingredientSafetyLabel(status)).toBeTruthy();
      expect(ingredientSafetyTone(status)).toBeTruthy();
    }
    expect(ingredientSafetyTone('severe')).toBe('danger');
    expect(ingredientSafetyTone('safe')).toBe('success');
    expect(ingredientSafetyLabel('safe')).toBe('No Conflicts Found');
    expect(ingredientSafetyLabel('safe')).not.toBe('Safe');
    expect(ingredientSafetyLabel('avoided')).toBe('Avoided');
  });

  it('maps assessment levels to badges, with no badge for unknown', () => {
    expect(ingredientSafetyStatusForLevel('severe')).toBe('severe');
    expect(ingredientSafetyStatusForLevel('avoided')).toBe('avoided');
    expect(ingredientSafetyStatusForLevel('none')).toBe('safe');
    expect(ingredientSafetyStatusForLevel('unknown')).toBeUndefined();
  });

  it('slugs display names into stable testID keys', () => {
    expect(ingredientSafetyRowKey('Red 40 (Allura Red)')).toBe(
      'red-40-allura-red',
    );
  });
});

describe('IngredientSafetyRow', () => {
  const rowId = 'ontrack.food.ingredients.row.peanut-oil';

  afterEach(() => {
    mockWidthClass = 'regular';
  });

  it('renders reason inline beside the title on regular width', () => {
    mockWidthClass = 'regular';
    render(
      <IngredientSafetyRow
        name="Peanut Oil"
        status="severe"
        reason="Contains peanuts"
      />,
    );
    expect(screen.getByText('Peanut Oil')).toBeTruthy();
    expect(screen.getByText('Contains peanuts')).toBeTruthy();
    expect(screen.getByText('Severe')).toBeTruthy();
    expect(screen.getByTestId(`${rowId}.reasonInline`)).toBeTruthy();
    expect(screen.queryByTestId(`${rowId}.reasonBelow`)).toBeNull();
  });

  it('shows No Conflicts Found with the softer reason, never Safe', () => {
    render(
      <IngredientSafetyRow
        name="Olive Oil"
        status="safe"
        reason="No conflicts with your saved allergies and preferences."
      />,
    );
    expect(screen.getByText('No Conflicts Found')).toBeTruthy();
    expect(screen.queryByText('Safe')).toBeNull();
    expect(
      screen.getByText('No conflicts with your saved allergies and preferences.'),
    ).toBeTruthy();
  });

  it('moves the reason below the title on compact width', () => {
    mockWidthClass = 'compact';
    render(
      <IngredientSafetyRow
        name="Peanut Oil"
        status="severe"
        reason="Contains peanuts"
      />,
    );
    expect(screen.getByTestId(`${rowId}.reasonBelow`)).toBeTruthy();
    expect(screen.queryByTestId(`${rowId}.reasonInline`)).toBeNull();
  });
});
