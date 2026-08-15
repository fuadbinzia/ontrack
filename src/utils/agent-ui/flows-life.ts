import {
    AGENT_UI_DEMO_PLANT_ID,
    AGENT_UI_DEMO_VEHICLE_ID,
    AGENT_UI_DEMO_VISION_CATEGORY_ID,
    AGENT_UI_DEMO_VISION_ITEM_ID,
    AGENT_UI_DEMO_WORKOUT_ACTIVITY_ID,
    AGENT_UI_DEMO_WORKOUT_CATALOG_EXERCISE_ID,
} from './fixtures';

import { AGENT_UI_WAIT_TIMEOUT_MS } from './flows-waits';

export const AGENT_UI_LIFE_FLOWS = {
  vehicles: [
    { op: 'goto', to: 'vehicles' },
    { op: 'wait', prefix: 'ontrack.vehicles.', timeoutMs: AGENT_UI_WAIT_TIMEOUT_MS },
  ],
  'vehicles-new': [
    { op: 'goto', to: 'vehicles/new' },
    {
      op: 'wait',
      id: 'ontrack.vehicles.new.nickname',
      timeoutMs: AGENT_UI_WAIT_TIMEOUT_MS,
    },
  ],
  'vehicle-demo': [
    { op: 'seed', to: 'vehicle-demo' },
    { op: 'goto', to: 'vehicles' },
    {
      op: 'wait',
      id: `ontrack.vehicles.list.vehicle.${AGENT_UI_DEMO_VEHICLE_ID}`,
      timeoutMs: AGENT_UI_WAIT_TIMEOUT_MS,
    },
  ],
  'vehicle-demo-detail': [
    { op: 'seed', to: 'vehicle-demo' },
    { op: 'goto', to: `vehicles/${AGENT_UI_DEMO_VEHICLE_ID}` },
    {
      op: 'wait',
      id: 'ontrack.vehicles.detail.settings',
      timeoutMs: AGENT_UI_WAIT_TIMEOUT_MS,
    },
  ],
  'vehicle-demo-expenses': [
    { op: 'seed', to: 'vehicle-demo' },
    { op: 'goto', to: `vehicles/${AGENT_UI_DEMO_VEHICLE_ID}` },
    {
      op: 'wait',
      id: 'ontrack.vehicles.detail.section.expenses',
      timeoutMs: AGENT_UI_WAIT_TIMEOUT_MS,
    },
    { op: 'tap', id: 'ontrack.vehicles.detail.section.expenses' },
    {
      op: 'wait',
      id: 'ontrack.vehicles.expenses.amount',
      timeoutMs: AGENT_UI_WAIT_TIMEOUT_MS,
    },
  ],
  social: [
    { op: 'goto', to: 'social' },
    { op: 'wait', prefix: 'ontrack.social.', timeoutMs: AGENT_UI_WAIT_TIMEOUT_MS },
  ],
  'friend-invite-sign-in': [
    { op: 'goto', to: 'f/agent-ui-friend-invite' },
    {
      op: 'wait',
      id: 'ontrack.social.friendInvite.signIn',
      timeoutMs: AGENT_UI_WAIT_TIMEOUT_MS,
    },
    { op: 'tap', id: 'ontrack.social.friendInvite.signIn' },
    {
      op: 'wait',
      id: 'ontrack.auth.section.providers',
      timeoutMs: AGENT_UI_WAIT_TIMEOUT_MS,
    },
  ],
  'social-friends-invite-tools': [
    { op: 'goto', to: 'social' },
    {
      op: 'wait',
      id: 'ontrack.social.header.addFriend',
      timeoutMs: AGENT_UI_WAIT_TIMEOUT_MS,
    },
    { op: 'tap', id: 'ontrack.social.header.addFriend' },
    {
      op: 'wait',
      id: 'ontrack.social.friends.openInviteTools',
      timeoutMs: AGENT_UI_WAIT_TIMEOUT_MS,
    },
    { op: 'tap', id: 'ontrack.social.friends.openInviteTools' },
    {
      op: 'wait',
      id: 'ontrack.social.friends.inviteTools.close',
      timeoutMs: AGENT_UI_WAIT_TIMEOUT_MS,
    },
  ],
  workouts: [
    { op: 'goto', to: 'workouts' },
    {
      op: 'wait',
      id: 'ontrack.workouts.selectedDay.section',
      timeoutMs: AGENT_UI_WAIT_TIMEOUT_MS,
    },
  ],
  'workouts-plan-day': [
    { op: 'goto', to: 'workouts' },
    {
      op: 'wait',
      id: 'ontrack.workouts.selectedDay.plan',
      timeoutMs: AGENT_UI_WAIT_TIMEOUT_MS,
    },
    { op: 'tap', id: 'ontrack.workouts.selectedDay.plan' },
    {
      op: 'wait',
      id: 'ontrack.workouts.dayPlanner.section',
      timeoutMs: AGENT_UI_WAIT_TIMEOUT_MS,
    },
    {
      op: 'wait',
      id: 'ontrack.workouts.dayPlanner.close',
      timeoutMs: AGENT_UI_WAIT_TIMEOUT_MS,
    },
  ],
  'workouts-change-day': [
    { op: 'goto', to: 'workouts' },
    {
      op: 'wait',
      id: 'ontrack.workouts.selectedDay.next',
      timeoutMs: AGENT_UI_WAIT_TIMEOUT_MS,
    },
    { op: 'tap', id: 'ontrack.workouts.selectedDay.next' },
    {
      op: 'wait',
      id: 'ontrack.workouts.selectedDay.previous',
      timeoutMs: AGENT_UI_WAIT_TIMEOUT_MS,
    },
  ],
  'workouts-demo': [
    { op: 'seed', to: 'workouts-demo' },
    { op: 'goto', to: 'workouts' },
    {
      op: 'wait',
      id: `ontrack.workouts.selectedDay.editWorkout.${AGENT_UI_DEMO_WORKOUT_ACTIVITY_ID}`,
      timeoutMs: AGENT_UI_WAIT_TIMEOUT_MS,
    },
    {
      op: 'tap',
      id: `ontrack.workouts.selectedDay.editWorkout.${AGENT_UI_DEMO_WORKOUT_ACTIVITY_ID}`,
    },
    {
      op: 'wait',
      id: 'ontrack.workouts.dayPlanner.section',
      timeoutMs: AGENT_UI_WAIT_TIMEOUT_MS,
    },
    {
      op: 'wait',
      id: 'ontrack.workouts.dayPlanner.close',
      timeoutMs: AGENT_UI_WAIT_TIMEOUT_MS,
    },
  ],
  'workouts-demo-explore': [
    { op: 'seed', to: 'workouts-demo' },
    { op: 'goto', to: 'workouts' },
    {
      op: 'wait',
      id: 'ontrack.workouts.exploreMuscles',
      timeoutMs: AGENT_UI_WAIT_TIMEOUT_MS,
    },
    { op: 'tap', id: 'ontrack.workouts.exploreMuscles' },
    {
      op: 'wait',
      id: `ontrack.workouts.exercise.${AGENT_UI_DEMO_WORKOUT_CATALOG_EXERCISE_ID}.add`,
      timeoutMs: AGENT_UI_WAIT_TIMEOUT_MS,
    },
  ],
  'workouts-demo-anatomy': [
    { op: 'seed', to: 'workouts-demo' },
    { op: 'goto', to: 'workouts' },
    {
      op: 'wait',
      id: 'ontrack.workouts.exploreMuscles',
      timeoutMs: AGENT_UI_WAIT_TIMEOUT_MS,
    },
    { op: 'tap', id: 'ontrack.workouts.exploreMuscles' },
    {
      op: 'wait',
      id: 'ontrack.workouts.explorer.anatomySex.male',
      timeoutMs: AGENT_UI_WAIT_TIMEOUT_MS,
    },
    { op: 'tap', id: 'ontrack.workouts.explorer.anatomySex.female' },
    {
      op: 'wait',
      id: 'ontrack.workouts.explorer.bodyView.front',
      timeoutMs: AGENT_UI_WAIT_TIMEOUT_MS,
    },
    { op: 'tap', id: 'ontrack.workouts.explorer.bodyView.side' },
    {
      op: 'wait',
      id: 'ontrack.workouts.explorer.muscle.chest',
      timeoutMs: AGENT_UI_WAIT_TIMEOUT_MS,
    },
  ],
  'workouts-demo-gym-detail': [
    { op: 'seed', to: 'workouts-demo' },
    {
      op: 'goto',
      to: `detail/gym/${AGENT_UI_DEMO_WORKOUT_ACTIVITY_ID}`,
    },
    {
      op: 'wait',
      id: 'ontrack.workouts.gym.start',
      timeoutMs: AGENT_UI_WAIT_TIMEOUT_MS,
    },
  ],
  'workouts-demo-gym-active': [
    { op: 'seed', to: 'workouts-demo' },
    {
      op: 'goto',
      to: `detail/gym-active/${AGENT_UI_DEMO_WORKOUT_ACTIVITY_ID}`,
    },
    {
      op: 'wait',
      id: 'ontrack.workouts.gymActive.completeSet',
      timeoutMs: AGENT_UI_WAIT_TIMEOUT_MS,
    },
  ],
  plants: [
    { op: 'goto', to: 'plants' },
    {
      op: 'wait',
      prefix: 'ontrack.plants.',
      timeoutMs: AGENT_UI_WAIT_TIMEOUT_MS,
    },
  ],
  'plants-new': [
    { op: 'goto', to: 'plants/new' },
    {
      op: 'wait',
      id: 'ontrack.plants.new.camera',
      timeoutMs: AGENT_UI_WAIT_TIMEOUT_MS,
    },
  ],
  'plants-demo': [
    { op: 'seed', to: 'plants-demo' },
    { op: 'goto', to: `plants/${AGENT_UI_DEMO_PLANT_ID}` },
    {
      op: 'wait',
      id: 'ontrack.plants.detail.logWatering',
      timeoutMs: AGENT_UI_WAIT_TIMEOUT_MS,
    },
  ],
  'plants-demo-list': [
    { op: 'seed', to: 'plants-demo' },
    { op: 'goto', to: 'plants' },
    {
      op: 'wait',
      id: `ontrack.plants.list.plant.${AGENT_UI_DEMO_PLANT_ID}`,
      timeoutMs: AGENT_UI_WAIT_TIMEOUT_MS,
    },
  ],
  'plants-demo-log-watering': [
    { op: 'seed', to: 'plants-demo' },
    { op: 'goto', to: `plants/${AGENT_UI_DEMO_PLANT_ID}` },
    {
      op: 'wait',
      id: 'ontrack.plants.detail.logWatering',
      timeoutMs: AGENT_UI_WAIT_TIMEOUT_MS,
    },
    { op: 'tap', id: 'ontrack.plants.detail.logWatering' },
    {
      op: 'wait',
      id: 'ontrack.plants.detail.undoWatering',
      timeoutMs: AGENT_UI_WAIT_TIMEOUT_MS,
    },
  ],
  'vision-board': [
    { op: 'goto', to: 'vision-board' },
    {
      op: 'wait',
      prefix: 'ontrack.vision.',
      timeoutMs: AGENT_UI_WAIT_TIMEOUT_MS,
    },
  ],
  'vision-board-categories': [
    { op: 'goto', to: 'vision-board-categories' },
    {
      op: 'wait',
      id: 'ontrack.vision.dashboard.filter',
      timeoutMs: AGENT_UI_WAIT_TIMEOUT_MS,
    },
  ],
  'vision-board-demo': [
    { op: 'seed', to: 'vision-board-demo' },
    { op: 'goto', to: 'vision-board' },
    {
      op: 'wait',
      id: `ontrack.vision.consolidated.category.${AGENT_UI_DEMO_VISION_CATEGORY_ID}`,
      timeoutMs: AGENT_UI_WAIT_TIMEOUT_MS,
    },
  ],
  'vision-board-demo-edit': [
    { op: 'seed', to: 'vision-board-demo' },
    { op: 'goto', to: `vision-board/${AGENT_UI_DEMO_VISION_CATEGORY_ID}` },
    {
      op: 'wait',
      id: 'ontrack.vision.category.addAffirmation',
      timeoutMs: AGENT_UI_WAIT_TIMEOUT_MS,
    },
    {
      op: 'wait',
      id: `ontrack.vision.category.canvasItem.${AGENT_UI_DEMO_VISION_ITEM_ID}`,
      timeoutMs: AGENT_UI_WAIT_TIMEOUT_MS,
    },
  ],
  'vision-board-demo-item-editor': [
    { op: 'seed', to: 'vision-board-demo' },
    { op: 'goto', to: `vision-board/${AGENT_UI_DEMO_VISION_CATEGORY_ID}` },
    {
      op: 'wait',
      id: `ontrack.vision.category.canvasItem.${AGENT_UI_DEMO_VISION_ITEM_ID}`,
      timeoutMs: AGENT_UI_WAIT_TIMEOUT_MS,
    },
    {
      op: 'tap',
      id: `ontrack.vision.category.canvasItem.${AGENT_UI_DEMO_VISION_ITEM_ID}`,
    },
    {
      op: 'wait',
      id: 'ontrack.vision.category.selection.edit',
      timeoutMs: AGENT_UI_WAIT_TIMEOUT_MS,
    },
    { op: 'tap', id: 'ontrack.vision.category.selection.edit' },
    {
      op: 'wait',
      id: 'ontrack.vision.itemEditor.primary',
      timeoutMs: AGENT_UI_WAIT_TIMEOUT_MS,
    },
  ],
  games: [
    { op: 'goto', to: 'games' },
    { op: 'wait', prefix: 'ontrack.games.', timeoutMs: AGENT_UI_WAIT_TIMEOUT_MS },
  ],
  'games-balloon-pop': [
    { op: 'goto', to: 'games' },
    {
      op: 'wait',
      id: 'ontrack.games.hub.balloonPop',
      timeoutMs: AGENT_UI_WAIT_TIMEOUT_MS,
    },
    { op: 'tap', id: 'ontrack.games.hub.balloonPop' },
    {
      op: 'wait',
      id: 'ontrack.games.balloonPop.play',
      timeoutMs: AGENT_UI_WAIT_TIMEOUT_MS,
    },
  ],
  trackers: [
    { op: 'goto', to: 'trackers' },
    { op: 'wait', id: 'ontrack.trackers.screen', timeoutMs: AGENT_UI_WAIT_TIMEOUT_MS },
  ],
  'trackers-manage': [
    { op: 'goto', to: 'trackers' },
    { op: 'wait', id: 'ontrack.trackers.manage', timeoutMs: AGENT_UI_WAIT_TIMEOUT_MS },
    { op: 'tap', id: 'ontrack.trackers.manage' },
    { op: 'wait', id: 'ontrack.trackers.manage.sheet', timeoutMs: AGENT_UI_WAIT_TIMEOUT_MS },
  ],
} as const satisfies Record<string, readonly import('./flows').AgentUiFlowStep[]>;
