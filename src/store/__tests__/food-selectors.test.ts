import {
  selectScheduledMealsByType,
  selectScheduledMealsForDate,
} from '@/store/food-selectors';
import type { Activity, Meal } from '@/types/models';

function activity(id: string, date: string, startMinutes: number): Activity {
  return {
    id,
    date,
    title: id,
    categoryId: 'food',
    startMinutes,
    durationMinutes: 30,
    status: 'upcoming',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
}

function meal(activityId: string, mealType: Meal['mealType']): Meal {
  return { activityId, mealType, name: activityId, items: [] };
}

const state = {
  activities: [
    activity('a-dinner', '2026-08-10', 18 * 60),
    activity('a-breakfast', '2026-08-10', 8 * 60),
    activity('a-other-day', '2026-08-11', 12 * 60),
    activity('a-no-meal', '2026-08-10', 10 * 60),
  ],
  meals: [
    meal('a-dinner', 'dinner'),
    meal('a-breakfast', 'breakfast'),
    meal('a-other-day', 'lunch'),
    meal('a-orphan', 'snack'),
  ],
};

describe('food selectors over schedule meals', () => {
  it('joins meals to same-day activities sorted by start time', () => {
    const result = selectScheduledMealsForDate(state, '2026-08-10');
    expect(result.map((entry) => entry.activity.id)).toEqual([
      'a-breakfast',
      'a-dinner',
    ]);
    expect(result[0]?.meal.mealType).toBe('breakfast');
  });

  it('omits orphan meals and other-day activities', () => {
    const ids = selectScheduledMealsForDate(state, '2026-08-10').map(
      (entry) => entry.meal.activityId,
    );
    expect(ids).not.toContain('a-orphan');
    expect(ids).not.toContain('a-other-day');
  });

  it('groups a day by meal type without empty buckets', () => {
    const grouped = selectScheduledMealsByType(state, '2026-08-10');
    expect(Object.keys(grouped).sort()).toEqual(['breakfast', 'dinner']);
    expect(grouped.breakfast?.[0]?.activity.id).toBe('a-breakfast');
  });
});
