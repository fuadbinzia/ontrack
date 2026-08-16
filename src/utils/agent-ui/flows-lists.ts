import {
    AGENT_UI_DEMO_CHECKLIST_LIST_ID,
    AGENT_UI_DEMO_CHECKLIST_TASK_PLAN_ID,
    AGENT_UI_DEMO_GROCERY_LIST_ID,
    AGENT_UI_DEMO_GROCERY_RECIPE_ID,
} from './fixtures';

import { AGENT_UI_WAIT_TIMEOUT_MS } from './flows-waits';

export const AGENT_UI_LIST_FLOWS = {
  checklists: [
    { op: 'goto', to: 'checklists' },
    {
      op: 'wait',
      prefix: 'ontrack.checklists.',
      timeoutMs: AGENT_UI_WAIT_TIMEOUT_MS,
    },
  ],
  'open-new-checklist': [
    { op: 'goto', to: 'checklists' },
    {
      op: 'wait',
      prefix: 'ontrack.checklists.',
      timeoutMs: AGENT_UI_WAIT_TIMEOUT_MS,
    },
    {
      op: 'wait',
      id: 'ontrack.checklists.newListName',
      timeoutMs: AGENT_UI_WAIT_TIMEOUT_MS,
    },
  ],
  'checklist-demo': [
    { op: 'seed', to: 'checklist-demo' },
    { op: 'goto', to: `checklists/${AGENT_UI_DEMO_CHECKLIST_LIST_ID}` },
    {
      op: 'wait',
      id: `ontrack.checklists.detail.task.${AGENT_UI_DEMO_CHECKLIST_TASK_PLAN_ID}`,
      timeoutMs: AGENT_UI_WAIT_TIMEOUT_MS,
    },
  ],
  'checklist-demo-item-details': [
    { op: 'seed', to: 'checklist-demo' },
    { op: 'goto', to: `checklists/${AGENT_UI_DEMO_CHECKLIST_LIST_ID}` },
    {
      op: 'wait',
      id: `ontrack.checklists.detail.task.${AGENT_UI_DEMO_CHECKLIST_TASK_PLAN_ID}`,
      timeoutMs: AGENT_UI_WAIT_TIMEOUT_MS,
    },
    {
      op: 'tap',
      id: `ontrack.checklists.detail.task.${AGENT_UI_DEMO_CHECKLIST_TASK_PLAN_ID}`,
    },
    {
      op: 'wait',
      id: 'ontrack.checklists.itemDetails.category',
      timeoutMs: AGENT_UI_WAIT_TIMEOUT_MS,
    },
  ],
  'checklist-demo-list': [
    { op: 'seed', to: 'checklist-demo' },
    { op: 'goto', to: 'checklists' },
    {
      op: 'wait',
      id: `ontrack.checklists.list.${AGENT_UI_DEMO_CHECKLIST_LIST_ID}`,
      timeoutMs: AGENT_UI_WAIT_TIMEOUT_MS,
    },
  ],
  'checklist-demo-open': [
    { op: 'seed', to: 'checklist-demo' },
    { op: 'goto', to: 'checklists' },
    {
      op: 'wait',
      id: `ontrack.checklists.list.${AGENT_UI_DEMO_CHECKLIST_LIST_ID}`,
      timeoutMs: AGENT_UI_WAIT_TIMEOUT_MS,
    },
    {
      op: 'tap',
      id: `ontrack.checklists.list.${AGENT_UI_DEMO_CHECKLIST_LIST_ID}`,
    },
    {
      op: 'wait',
      id: 'ontrack.checklists.detail.back',
      timeoutMs: AGENT_UI_WAIT_TIMEOUT_MS,
    },
  ],
  'checklist-demo-settings': [
    { op: 'seed', to: 'checklist-demo' },
    {
      op: 'goto',
      to: `checklists/${AGENT_UI_DEMO_CHECKLIST_LIST_ID}/settings`,
    },
    {
      op: 'wait',
      id: 'ontrack.listSettings.addEditors',
      timeoutMs: AGENT_UI_WAIT_TIMEOUT_MS,
    },
  ],
  'grocery-demo': [
    { op: 'seed', to: 'grocery-demo' },
    { op: 'goto', to: `checklists/${AGENT_UI_DEMO_GROCERY_LIST_ID}` },
    {
      op: 'wait',
      id: `ontrack.grocery.detail.recipe.${AGENT_UI_DEMO_GROCERY_RECIPE_ID}`,
      timeoutMs: AGENT_UI_WAIT_TIMEOUT_MS,
    },
  ],
  'grocery-demo-combined': [
    { op: 'seed', to: 'grocery-demo' },
    { op: 'goto', to: `checklists/${AGENT_UI_DEMO_GROCERY_LIST_ID}` },
    {
      op: 'wait',
      id: 'ontrack.grocery.detail.view.combined',
      timeoutMs: AGENT_UI_WAIT_TIMEOUT_MS,
    },
    { op: 'tap', id: 'ontrack.grocery.detail.view.combined' },
    {
      op: 'wait',
      id: 'ontrack.grocery.detail.copy',
      timeoutMs: AGENT_UI_WAIT_TIMEOUT_MS,
    },
  ],
  'grocery-demo-recipe-import': [
    { op: 'seed', to: 'grocery-demo' },
    {
      op: 'goto',
      to: `checklists/${AGENT_UI_DEMO_GROCERY_LIST_ID}/recipe-import`,
    },
    {
      op: 'wait',
      id: 'ontrack.recipeImport.url',
      timeoutMs: AGENT_UI_WAIT_TIMEOUT_MS,
    },
  ],
  'grocery-demo-settings': [
    { op: 'seed', to: 'grocery-demo' },
    { op: 'goto', to: `checklists/${AGENT_UI_DEMO_GROCERY_LIST_ID}` },
    {
      op: 'wait',
      id: 'ontrack.grocery.detail.settings',
      timeoutMs: AGENT_UI_WAIT_TIMEOUT_MS,
    },
    { op: 'tap', id: 'ontrack.grocery.detail.settings' },
    {
      op: 'wait',
      id: 'ontrack.listSettings.name',
      timeoutMs: AGENT_UI_WAIT_TIMEOUT_MS,
    },
  ],
} as const satisfies Record<string, readonly import('./flows').AgentUiFlowStep[]>;
