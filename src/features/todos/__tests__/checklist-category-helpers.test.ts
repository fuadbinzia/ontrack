import { partitionChecklistCategories } from '@/features/todos/checklist-category-helpers';
import type { TodoCategory } from '@/store/todos';

const createdAt = '2026-08-12T00:00:00.000Z';

function category(id: string, name: string): TodoCategory {
  return {
    id,
    listId: 'list-packing',
    name,
    position: 0,
    createdAt,
    updatedAt: createdAt,
  };
}

describe('checklist category visibility', () => {
  const electronics = category('category-electronics', 'Electronics');
  const clothes = category('category-clothes', 'Clothes');

  it('removes a category with no items', () => {
    expect(partitionChecklistCategories([electronics], [])).toEqual({
      populated: [],
      emptyIds: [electronics.id],
    });
  });

  it('keeps categories containing open or completed items', () => {
    expect(
      partitionChecklistCategories([electronics, clothes], [
        { categoryId: electronics.id },
        { categoryId: clothes.id },
      ]),
    ).toEqual({
      populated: [electronics, clothes],
      emptyIds: [],
    });
  });

  it('removes only empty categories when uncategorized items remain', () => {
    expect(
      partitionChecklistCategories([electronics, clothes], [
        { categoryId: clothes.id },
        { categoryId: undefined },
      ]),
    ).toEqual({
      populated: [clothes],
      emptyIds: [electronics.id],
    });
  });
});
