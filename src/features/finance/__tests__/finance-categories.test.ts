import { financeCategoryById } from '../categories';

describe('Finance categories', () => {
  it('labels existing dining transactions as Food/Dining without changing their ID', () => {
    expect(financeCategoryById('dining')).toMatchObject({
      id: 'dining',
      label: 'Food/Dining',
      taxBucket: 'meals',
    });
  });

  it('keeps unknown custom categories legible', () => {
    expect(financeCategoryById('Pet Supplies')).toMatchObject({
      id: 'Pet Supplies',
      label: 'Pet Supplies',
      taxBucket: 'uncategorized',
    });
  });
});
