import {
    AGENT_UI_DEMO_ACTIVITY_ID,
    AGENT_UI_DEMO_EVENT_ACTIVITY_ID,
    AGENT_UI_DEMO_EVENT_BOUT_ID,
    AGENT_UI_DEMO_FOOD_ACTIVITY_ID,
    AGENT_UI_DEMO_PLANT_WATERING_ACTIVITY_ID,
} from './fixtures';

import { AGENT_UI_WAIT_TIMEOUT_MS } from './flows-waits';

export const AGENT_UI_DAILY_FLOWS = {
  'overview-event-updates': [
    { op: 'seed', to: 'event-demo' },
    { op: 'goto', to: 'overview' },
    {
      op: 'wait',
      id: 'ontrack.overview.eventUpdates',
      timeoutMs: AGENT_UI_WAIT_TIMEOUT_MS,
    },
  ],
  calendar: [
    { op: 'goto', to: 'calendar' },
    { op: 'wait', prefix: 'ontrack.calendar.', timeoutMs: AGENT_UI_WAIT_TIMEOUT_MS },
  ],
  'calendar-activity-demo': [
    { op: 'seed', to: 'activity-demo' },
    { op: 'goto', to: 'calendar' },
    {
      op: 'wait',
      id: 'ontrack.calendar.jumpToday',
      timeoutMs: AGENT_UI_WAIT_TIMEOUT_MS,
    },
    { op: 'tap', id: 'ontrack.calendar.jumpToday' },
    {
      op: 'wait',
      id: `ontrack.calendar.activity.${AGENT_UI_DEMO_ACTIVITY_ID}`,
      timeoutMs: AGENT_UI_WAIT_TIMEOUT_MS,
    },
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
    { op: 'wait', id: 'ontrack.today.nonToday', timeoutMs: AGENT_UI_WAIT_TIMEOUT_MS },
    { op: 'wait', ms: 800 },
  ],
  'today-next-day': [
    { op: 'seed', to: 'home-weather' },
    { op: 'goto', to: 'today' },
    { op: 'wait', id: 'ontrack.today.nextDay', timeoutMs: AGENT_UI_WAIT_TIMEOUT_MS },
    { op: 'wait', id: 'ontrack.today.weather', timeoutMs: AGENT_UI_WAIT_TIMEOUT_MS },
    { op: 'tap', id: 'ontrack.today.nextDay' },
    { op: 'wait', id: 'ontrack.today.nonToday', timeoutMs: AGENT_UI_WAIT_TIMEOUT_MS },
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
    {
      op: 'wait',
      id: 'ontrack.activityForm.attendeeEmails',
      timeoutMs: AGENT_UI_WAIT_TIMEOUT_MS,
    },
  ],
  'event-demo-edit-review-invite': [
    { op: 'seed', to: 'event-demo' },
    { op: 'goto', to: 'today' },
    {
      op: 'wait',
      id: `ontrack.today.activity.${AGENT_UI_DEMO_EVENT_ACTIVITY_ID}`,
      timeoutMs: AGENT_UI_WAIT_TIMEOUT_MS,
    },
    { op: 'tap', id: `ontrack.today.activity.${AGENT_UI_DEMO_EVENT_ACTIVITY_ID}` },
    {
      op: 'wait',
      id: 'ontrack.eventDetail.edit',
      timeoutMs: AGENT_UI_WAIT_TIMEOUT_MS,
    },
    { op: 'tap', id: 'ontrack.eventDetail.edit' },
    {
      op: 'wait',
      id: 'ontrack.activityForm.save',
      timeoutMs: AGENT_UI_WAIT_TIMEOUT_MS,
    },
    { op: 'tap', id: 'ontrack.activityForm.save' },
    {
      op: 'wait',
      id: 'ontrack.calendarSync.screen',
      timeoutMs: AGENT_UI_WAIT_TIMEOUT_MS,
    },
    {
      op: 'wait',
      id: 'ontrack.calendarSync.section.inviteReview',
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
    {
      op: 'wait',
      id: 'ontrack.today.detail.food.close',
      timeoutMs: AGENT_UI_WAIT_TIMEOUT_MS,
    },
  ],
  'plant-calendar-detail': [
    { op: 'seed', to: 'plants-demo' },
    { op: 'goto', to: 'today' },
    {
      op: 'wait',
      id: `ontrack.today.activity.${AGENT_UI_DEMO_PLANT_WATERING_ACTIVITY_ID}`,
      timeoutMs: AGENT_UI_WAIT_TIMEOUT_MS,
    },
    {
      op: 'tap',
      id: `ontrack.today.activity.${AGENT_UI_DEMO_PLANT_WATERING_ACTIVITY_ID}`,
    },
    {
      op: 'wait',
      id: 'ontrack.today.detail.plant.close',
      timeoutMs: AGENT_UI_WAIT_TIMEOUT_MS,
    },
    {
      op: 'wait',
      id: 'ontrack.plants.detail.logWatering',
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
    {
      op: 'wait',
      id: 'ontrack.eventDetail.close',
      timeoutMs: AGENT_UI_WAIT_TIMEOUT_MS,
    },
  ],
  'event-bout-detail': [
    { op: 'seed', to: 'event-demo' },
    { op: 'goto', to: `detail/generic/${AGENT_UI_DEMO_EVENT_ACTIVITY_ID}` },
    {
      op: 'wait',
      id: `ontrack.eventDetail.fightCard.bout.${AGENT_UI_DEMO_EVENT_BOUT_ID}`,
      timeoutMs: AGENT_UI_WAIT_TIMEOUT_MS,
    },
    {
      op: 'tap',
      id: `ontrack.eventDetail.fightCard.bout.${AGENT_UI_DEMO_EVENT_BOUT_ID}`,
    },
    {
      op: 'wait',
      id: 'ontrack.eventDetail.fightCard.modal',
      timeoutMs: AGENT_UI_WAIT_TIMEOUT_MS,
    },
    {
      op: 'wait',
      id: 'ontrack.prompt.close',
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
  'activity-form-dismiss': [
    { op: 'goto', to: 'today' },
    {
      op: 'wait',
      id: 'ontrack.today.addActivity',
      timeoutMs: AGENT_UI_WAIT_TIMEOUT_MS,
    },
    { op: 'tap', id: 'ontrack.today.addActivity' },
    {
      op: 'wait',
      id: 'ontrack.activityForm.category.mindfulness',
      timeoutMs: AGENT_UI_WAIT_TIMEOUT_MS,
    },
    { op: 'tap', id: 'ontrack.activityForm.category.mindfulness' },
    {
      op: 'wait',
      id: 'ontrack.activityForm.backdrop',
      timeoutMs: AGENT_UI_WAIT_TIMEOUT_MS,
    },
    { op: 'tap', id: 'ontrack.activityForm.backdrop' },
  ],
} as const satisfies Record<string, readonly import('./flows').AgentUiFlowStep[]>;
