import {
  filterCategoryCreatorOptions,
  type CategoryCreatorOption,
} from '../category-creator-selector';

const categories: CategoryCreatorOption[] = [
  { id: 'dining', name: 'Dining' },
  { id: 'car-payment', name: 'Car Payment' },
  { id: 'contract-labor', name: 'Contract Labor' },
  { id: 'other', name: 'Other' },
];

describe('filterCategoryCreatorOptions', () => {
  it('uses the create-category draft to search existing categories', () => {
    expect(filterCategoryCreatorOptions(categories, 'other', 'car')).toEqual([
      { id: 'car-payment', name: 'Car Payment' },
    ]);
  });

  it('matches partial category names without regard to case', () => {
    expect(filterCategoryCreatorOptions(categories, 'other', 'CONTRACT')).toEqual([
      { id: 'contract-labor', name: 'Contract Labor' },
    ]);
  });

  it('restores every category for a blank draft and keeps the selection first', () => {
    expect(filterCategoryCreatorOptions(categories, 'other', '   ').map(({ id }) => id)).toEqual([
      'other',
      'car-payment',
      'contract-labor',
      'dining',
    ]);
  });

  it('returns no existing options when the draft is a genuinely new category', () => {
    expect(filterCategoryCreatorOptions(categories, 'other', 'Utilities')).toEqual([]);
  });
});
