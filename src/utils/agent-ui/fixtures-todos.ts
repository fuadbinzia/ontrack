import type { Checklist, ChecklistRecipe, ChecklistTask } from '@/store/todos-types';

import {
    AGENT_UI_DEMO_CHECKLIST_LIST_ID,
    AGENT_UI_DEMO_CHECKLIST_TASK_PACK_ID,
    AGENT_UI_DEMO_CHECKLIST_TASK_PLAN_ID,
    AGENT_UI_DEMO_GROCERY_LIST_ID,
    AGENT_UI_DEMO_GROCERY_RECIPE_ID,
    AGENT_UI_DEMO_GROCERY_TASK_PASTA_ID,
    AGENT_UI_DEMO_GROCERY_TASK_TOMATOES_ID,
} from './fixtures-constants';

export function buildAgentUiDemoChecklist(nowIso = new Date().toISOString()): {
  list: Checklist;
  tasks: ChecklistTask[];
} {
  const list: Checklist = {
    id: AGENT_UI_DEMO_CHECKLIST_LIST_ID,
    name: 'Agent UI Checklist',
    kind: 'checklist',
    mode: 'private',
    role: 'owner',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: nowIso,
  };
  const tasks: ChecklistTask[] = [
    {
      id: AGENT_UI_DEMO_CHECKLIST_TASK_PLAN_ID,
      listId: list.id,
      title:
        'Finance section (bill management, property tax tracker, insurance tracker, car, cc’s. Etc)',
      completed: false,
      important: true,
      position: 0,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: nowIso,
      version: 1,
    },
    {
      id: AGENT_UI_DEMO_CHECKLIST_TASK_PACK_ID,
      listId: list.id,
      title: 'Pack the bag',
      completed: false,
      important: false,
      position: 1,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: nowIso,
      version: 1,
    },
  ];
  return { list, tasks };
}

export function buildAgentUiDemoGrocery(nowIso = new Date().toISOString()): {
  list: Checklist;
  recipe: ChecklistRecipe;
  tasks: ChecklistTask[];
} {
  const list: Checklist = {
    id: AGENT_UI_DEMO_GROCERY_LIST_ID,
    name: 'Agent UI Grocery',
    kind: 'grocery',
    mode: 'private',
    role: 'owner',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: nowIso,
  };
  const recipe: ChecklistRecipe = {
    id: AGENT_UI_DEMO_GROCERY_RECIPE_ID,
    listId: list.id,
    name: 'Demo Pasta',
    sourceKind: 'url',
    sourceUrl: 'https://example.com/demo-pasta',
    targetServings: 2,
    position: 0,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: nowIso,
  };
  const tasks: ChecklistTask[] = [
    {
      id: AGENT_UI_DEMO_GROCERY_TASK_TOMATOES_ID,
      listId: list.id,
      recipeId: recipe.id,
      ingredientPosition: 0,
      ingredientName: 'Tomatoes',
      title: 'Tomatoes',
      quantityText: '4',
      unit: 'whole',
      completed: false,
      important: false,
      position: 0,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: nowIso,
      version: 1,
    },
    {
      id: AGENT_UI_DEMO_GROCERY_TASK_PASTA_ID,
      listId: list.id,
      recipeId: recipe.id,
      ingredientPosition: 1,
      ingredientName: 'Pasta',
      title: 'Pasta',
      quantityText: '12',
      unit: 'oz',
      completed: false,
      important: false,
      position: 1,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: nowIso,
      version: 1,
    },
  ];
  return { list, recipe, tasks };
}


export function upsertChecklistFixtureLists(input: {
  lists: Checklist[];
  tasks: ChecklistTask[];
  recipes?: ChecklistRecipe[];
}): void {
  // Lazy require keeps agent-ui unit tests free of Zustand/AsyncStorage.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { useChecklists } = require('@/store/todos') as typeof import('@/store/todos');
  const listIds = new Set(input.lists.map((list) => list.id));
  const recipes = input.recipes ?? [];
  useChecklists.setState((state) => ({
    lists: [
      ...state.lists.filter((list) => !listIds.has(list.id)),
      ...input.lists,
    ],
    tasks: [
      ...state.tasks.filter((task) => !listIds.has(task.listId)),
      ...input.tasks,
    ],
    recipes: [
      ...state.recipes.filter((recipe) => !listIds.has(recipe.listId)),
      ...recipes,
    ],
  }));
}
