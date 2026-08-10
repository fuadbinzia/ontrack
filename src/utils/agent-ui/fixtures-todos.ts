import type { TodoList, TodoRecipe, TodoTask } from '@/store/todos-types';

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
  list: TodoList;
  tasks: TodoTask[];
} {
  const list: TodoList = {
    id: AGENT_UI_DEMO_CHECKLIST_LIST_ID,
    name: 'Agent UI Checklist',
    kind: 'checklist',
    mode: 'private',
    role: 'owner',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: nowIso,
  };
  const tasks: TodoTask[] = [
    {
      id: AGENT_UI_DEMO_CHECKLIST_TASK_PLAN_ID,
      listId: list.id,
      title: 'Plan the weekend',
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
  list: TodoList;
  recipe: TodoRecipe;
  tasks: TodoTask[];
} {
  const list: TodoList = {
    id: AGENT_UI_DEMO_GROCERY_LIST_ID,
    name: 'Agent UI Grocery',
    kind: 'grocery',
    mode: 'private',
    role: 'owner',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: nowIso,
  };
  const recipe: TodoRecipe = {
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
  const tasks: TodoTask[] = [
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


export function upsertTodoFixtureLists(input: {
  lists: TodoList[];
  tasks: TodoTask[];
  recipes?: TodoRecipe[];
}): void {
  // Lazy require keeps agent-ui unit tests free of Zustand/AsyncStorage.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { useTodos } = require('@/store/todos') as typeof import('@/store/todos');
  const listIds = new Set(input.lists.map((list) => list.id));
  const recipes = input.recipes ?? [];
  useTodos.setState((state) => ({
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

