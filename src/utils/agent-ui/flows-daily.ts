import {
    AGENT_UI_DEMO_ACTIVITY_ID,
    AGENT_UI_DEMO_FOOD_ACTIVITY_ID,
} from './fixtures';

import { AGENT_UI_WAIT_TIMEOUT_MS } from './flows-waits';

export const AGENT_UI_DAILY_FLOWS = {
  calendar: [
    { op: 'goto', to: 'calendar' },
    { op: 'wait', prefix: 'ontrack.calendar.', timeoutMs: AGENT_UI_WAIT_TIMEOUT_MS },
  ],
  today: [
    { op: 'goto', to: 'today' },
    { op: 'wait', prefix: 'ontrack.today.', timeoutMs: AGENT_UI_WAIT_TIMEOUT_MS },
  ],
  'today-prev-day': [
    { op: 'seed', to: 'home-weather' },
    { op: 'goto', to: 'today' },
    { op: 'wait', id: 'ontrack.today.prevDay', timeoutMs: AGENT_UI_WAIT_TIMEOUT_MS },
    { op: 'wait', id: 'ontrack.today.weather', timeoutMs: AGENT_UI_WAIT_TIMEOUT_MS },
    { op: 'tap', id: 'ontrack.today.prevDay' },
    { op: 'wait', id: 'ontrack.today.weather', timeoutMs: AGENT_UI_WAIT_TIMEOUT_MS },
    { op: 'wait', ms: 800 },
  ],
  'today-next-day': [
    { op: 'seed', to: 'home-weather' },
    { op: 'goto', to: 'today' },
    { op: 'wait', id: 'ontrack.today.nextDay', timeoutMs: AGENT_UI_WAIT_TIMEOUT_MS },
    { op: 'wait', id: 'ontrack.today.weather', timeoutMs: AGENT_UI_WAIT_TIMEOUT_MS },
    { op: 'tap', id: 'ontrack.today.nextDay' },
    { op: 'wait', id: 'ontrack.today.weather', timeoutMs: AGENT_UI_WAIT_TIMEOUT_MS },
    // Forecast resolve after day change (past-window fetch can be slower).
    { op: 'wait', ms: 800 },
  ],
  'open-home-location': [
    { op: 'seed', to: 'home-weather' },
    { op: 'goto', to: 'profile' },
    {
      op: 'wait',
      id: 'ontrack.profile.section.preferences',
      timeoutMs: AGENT_UI_WAIT_TIMEOUT_MS,
    },
    {
      op: 'wait',
      id: 'ontrack.profile.homeLocation',
      timeoutMs: AGENT_UI_WAIT_TIMEOUT_MS,
    },
    { op: 'wait', ms: 250 },
  ],
  'activity-demo': [
    { op: 'seed', to: 'activity-demo' },
    { op: 'goto', to: 'today' },
    {
      op: 'wait',
      id: `ontrack.today.activity.${AGENT_UI_DEMO_ACTIVITY_ID}`,
      timeoutMs: AGENT_UI_WAIT_TIMEOUT_MS,
    },
  ],
  'activity-demo-edit': [
    { op: 'seed', to: 'activity-demo' },
    { op: 'goto', to: `activityForm?id=${AGENT_UI_DEMO_ACTIVITY_ID}` },
    {
      op: 'wait',
      // Title when editing; guidedTitle/date also settle the form.
      prefix: 'ontrack.activityForm.',
      timeoutMs: AGENT_UI_WAIT_TIMEOUT_MS,
    },
  ],
  'food-demo': [
    { op: 'seed', to: 'food-demo' },
    { op: 'goto', to: 'food' },
    {
      op: 'wait',
      id: 'ontrack.food.home.section.suggestions',
      timeoutMs: AGENT_UI_WAIT_TIMEOUT_MS,
    },
  ],
  'food-detail-demo': [
    { op: 'seed', to: 'food-demo' },
    { op: 'goto', to: `detail/food/${AGENT_UI_DEMO_FOOD_ACTIVITY_ID}` },
    {
      op: 'wait',
      id: 'ontrack.food.detail.edit',
      timeoutMs: AGENT_UI_WAIT_TIMEOUT_MS,
    },
  ],
  'activity-demo-detail': [
    { op: 'seed', to: 'activity-demo' },
    { op: 'goto', to: 'today' },
    {
      op: 'wait',
      id: `ontrack.today.activity.${AGENT_UI_DEMO_ACTIVITY_ID}`,
      timeoutMs: AGENT_UI_WAIT_TIMEOUT_MS,
    },
    {
      op: 'tap',
      id: `ontrack.today.activity.${AGENT_UI_DEMO_ACTIVITY_ID}`,
    },
    {
      op: 'wait',
      id: 'ontrack.eventDetail.edit',
      timeoutMs: AGENT_UI_WAIT_TIMEOUT_MS,
    },
  ],
  'activity-form': [
    { op: 'goto', to: 'activityForm' },
    {
      op: 'wait',
      prefix: 'ontrack.activityForm.',
      timeoutMs: AGENT_UI_WAIT_TIMEOUT_MS,
    },
  ],
} as const satisfies Record<string, readonly import('./flows').AgentUiFlowStep[]>;
