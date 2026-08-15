import {
    AGENT_UI_DEMO_FINANCE_TRANSACTION_ID,
    AGENT_UI_DEMO_HEALTH_FACTOR_ID,
    AGENT_UI_DEMO_HEALTH_MOOD_ID,
    AGENT_UI_DEMO_PLANT_ID,
    AGENT_UI_DEMO_VEHICLE_ID,
    AGENT_UI_DEMO_VISION_CATEGORY_ID,
    AGENT_UI_DEMO_VISION_ITEM_ID,
    AGENT_UI_DEMO_WORKOUT_ACTIVITY_ID,
    AGENT_UI_DEMO_WORKOUT_CATALOG_EXERCISE_ID,
} from './fixtures';

import { AGENT_UI_WAIT_TIMEOUT_MS } from './flows-waits';

export const AGENT_UI_ADDON_FLOWS = {
  health: [
    { op: 'goto', to: 'health' },
    { op: 'wait', prefix: 'ontrack.health.', timeoutMs: AGENT_UI_WAIT_TIMEOUT_MS },
  ],
  'health-mood': [
    { op: 'goto', to: 'health/mood' },
    { op: 'wait', prefix: 'ontrack.health.', timeoutMs: AGENT_UI_WAIT_TIMEOUT_MS },
  ],
  'health-demo': [
    { op: 'seed', to: 'health-demo' },
    { op: 'goto', to: 'health' },
    {
      op: 'wait',
      prefix: 'ontrack.health.',
      timeoutMs: AGENT_UI_WAIT_TIMEOUT_MS,
    },
    { op: 'tap', id: 'ontrack.health.section.mind' },
    {
      op: 'wait',
      id: `ontrack.health.mind.entry.${AGENT_UI_DEMO_HEALTH_MOOD_ID}`,
      timeoutMs: AGENT_UI_WAIT_TIMEOUT_MS,
    },
  ],
  'health-demo-mood': [
    { op: 'seed', to: 'health-demo' },
    { op: 'goto', to: 'health/mood' },
    {
      op: 'wait',
      id: `ontrack.health.checkIn.factor.${AGENT_UI_DEMO_HEALTH_FACTOR_ID}`,
      timeoutMs: AGENT_UI_WAIT_TIMEOUT_MS,
    },
  ],
  'health-settings': [
    { op: 'goto', to: 'health/settings' },
    { op: 'wait', prefix: 'ontrack.health.', timeoutMs: AGENT_UI_WAIT_TIMEOUT_MS },
  ],
  profile: [
    { op: 'goto', to: 'profile' },
    { op: 'wait', prefix: 'ontrack.profile.', timeoutMs: AGENT_UI_WAIT_TIMEOUT_MS },
  ],
  'profile-appearance': [
    { op: 'goto', to: 'profile/appearance' },
    {
      op: 'wait',
      id: 'ontrack.profile.appearance.preview',
      timeoutMs: AGENT_UI_WAIT_TIMEOUT_MS,
    },
  ],
  'open-avatar-editor': [
    { op: 'dismiss', prefix: 'ontrack.profile.avatar.' },
    { op: 'goto', to: 'profile' },
    { op: 'wait', id: 'ontrack.profile.avatar', timeoutMs: AGENT_UI_WAIT_TIMEOUT_MS },
    { op: 'tap', id: 'ontrack.profile.avatar' },
    {
      op: 'wait',
      id: 'ontrack.profile.avatar.close',
      timeoutMs: AGENT_UI_WAIT_TIMEOUT_MS,
    },
    { op: 'wait', ms: 250 },
  ],
  'open-profile-identity': [
    { op: 'dismiss', prefix: 'ontrack.profile.identity.' },
    { op: 'goto', to: 'profile' },
    {
      op: 'wait',
      id: 'ontrack.profile.displayName',
      timeoutMs: AGENT_UI_WAIT_TIMEOUT_MS,
    },
    { op: 'tap', id: 'ontrack.profile.displayName' },
    {
      op: 'wait',
      id: 'ontrack.profile.identity.close',
      timeoutMs: AGENT_UI_WAIT_TIMEOUT_MS,
    },
    { op: 'wait', ms: 250 },
  ],
  'open-developer': [
    { op: 'goto', to: 'developer' },
    {
      op: 'wait',
      id: 'ontrack.developer.devMode',
      timeoutMs: AGENT_UI_WAIT_TIMEOUT_MS,
    },
    { op: 'wait', ms: 250 },
  ],
  'profile-usage-analytics': [
    { op: 'goto', to: 'profile' },
    {
      op: 'wait',
      id: 'ontrack.profile.usageAnalytics',
      timeoutMs: AGENT_UI_WAIT_TIMEOUT_MS,
    },
    { op: 'scroll', id: 'ontrack.profile.usageAnalytics' },
    { op: 'wait', ms: 250 },
  ],
  vehicles: [
    { op: 'goto', to: 'vehicles' },
    { op: 'wait', prefix: 'ontrack.vehicles.', timeoutMs: AGENT_UI_WAIT_TIMEOUT_MS },
  ],
  finance: [
    { op: 'goto', to: 'finance' },
    { op: 'wait', id: 'ontrack.finance.hub', timeoutMs: AGENT_UI_WAIT_TIMEOUT_MS },
  ],
  'finance-transactions': [
    { op: 'goto', to: 'finance/transactions' },
    { op: 'wait', id: 'ontrack.finance.transactions', timeoutMs: AGENT_UI_WAIT_TIMEOUT_MS },
    { op: 'wait', id: 'ontrack.finance.transactions.search', timeoutMs: AGENT_UI_WAIT_TIMEOUT_MS },
    { op: 'wait', id: 'ontrack.finance.transactions.filter.categories', timeoutMs: AGENT_UI_WAIT_TIMEOUT_MS },
    { op: 'wait', id: 'ontrack.finance.transactions.sort', timeoutMs: AGENT_UI_WAIT_TIMEOUT_MS },
  ],
  'finance-transaction-filter-sort': [
    { op: 'seed', to: 'finance-demo' },
    { op: 'goto', to: 'finance/transactions' },
    {
      op: 'wait',
      id: 'ontrack.finance.transactions.filter.categories',
      timeoutMs: AGENT_UI_WAIT_TIMEOUT_MS,
    },
    { op: 'tap', id: 'ontrack.finance.transactions.filter.categories' },
    {
      op: 'wait',
      id: 'ontrack.finance.transactions.filter.category.other',
      timeoutMs: AGENT_UI_WAIT_TIMEOUT_MS,
    },
    { op: 'tap', id: 'ontrack.finance.transactions.filter.category.other' },
    { op: 'tap', id: 'ontrack.finance.transactions.filter.categories' },
    { op: 'tap', id: 'ontrack.finance.transactions.sort' },
    {
      op: 'wait',
      id: 'ontrack.finance.transactions.sort.amount_high',
      timeoutMs: AGENT_UI_WAIT_TIMEOUT_MS,
    },
    { op: 'tap', id: 'ontrack.finance.transactions.sort.amount_high' },
  ],
  'finance-transaction-categorize': [
    { op: 'seed', to: 'finance-demo' },
    { op: 'goto', to: 'finance/transactions' },
    {
      op: 'wait',
      id: `ontrack.finance.transactions.row.${AGENT_UI_DEMO_FINANCE_TRANSACTION_ID}`,
      timeoutMs: AGENT_UI_WAIT_TIMEOUT_MS,
    },
    {
      op: 'tap',
      id: `ontrack.finance.transactions.row.${AGENT_UI_DEMO_FINANCE_TRANSACTION_ID}`,
    },
    {
      op: 'wait',
      id: 'ontrack.finance.transactions.category.sheet',
      timeoutMs: AGENT_UI_WAIT_TIMEOUT_MS,
    },
    {
      op: 'wait',
      id: 'ontrack.finance.transactions.category.save',
      timeoutMs: AGENT_UI_WAIT_TIMEOUT_MS,
    },
    { op: 'tap', id: 'ontrack.finance.transactions.category.selector' },
    {
      op: 'wait',
      id: 'ontrack.finance.transactions.category.newName',
      timeoutMs: AGENT_UI_WAIT_TIMEOUT_MS,
    },
    {
      op: 'wait',
      id: 'ontrack.finance.transactions.category.dining',
      timeoutMs: AGENT_UI_WAIT_TIMEOUT_MS,
    },
    { op: 'tap', id: 'ontrack.finance.transactions.category.dining' },
    { op: 'tap', id: 'ontrack.finance.transactions.category.save' },
  ],
  'finance-accounts': [
    { op: 'goto', to: 'finance/accounts' },
    { op: 'wait', id: 'ontrack.finance.accounts', timeoutMs: AGENT_UI_WAIT_TIMEOUT_MS },
    { op: 'wait', id: 'ontrack.finance.accounts.linkBank', timeoutMs: AGENT_UI_WAIT_TIMEOUT_MS },
    { op: 'wait', id: 'ontrack.finance.accounts.linkInvestments', timeoutMs: AGENT_UI_WAIT_TIMEOUT_MS },
  ],
  'finance-rewards': [
    { op: 'goto', to: 'finance/rewards' },
    { op: 'wait', id: 'ontrack.finance.rewards', timeoutMs: AGENT_UI_WAIT_TIMEOUT_MS },
    { op: 'wait', id: 'ontrack.finance.rewards.section.hero', timeoutMs: AGENT_UI_WAIT_TIMEOUT_MS },
    { op: 'wait', id: 'ontrack.finance.rewards.createFromLink', timeoutMs: AGENT_UI_WAIT_TIMEOUT_MS },
    { op: 'tap', id: 'ontrack.finance.rewards.addManual' },
    { op: 'wait', id: 'ontrack.finance.rewards.profile.sheet', timeoutMs: AGENT_UI_WAIT_TIMEOUT_MS },
    { op: 'wait', id: 'ontrack.finance.rewards.profile.save', timeoutMs: AGENT_UI_WAIT_TIMEOUT_MS },
    { op: 'tap', id: 'ontrack.finance.rewards.profile.close' },
  ],
  'finance-subscriptions': [
    { op: 'goto', to: 'finance/bills' },
    { op: 'wait', id: 'ontrack.finance.recurring', timeoutMs: AGENT_UI_WAIT_TIMEOUT_MS },
    { op: 'wait', id: 'ontrack.finance.recurring.add', timeoutMs: AGENT_UI_WAIT_TIMEOUT_MS },
    { op: 'wait', id: 'ontrack.finance.subscriptions.refresh', timeoutMs: AGENT_UI_WAIT_TIMEOUT_MS },
    { op: 'tap', id: 'ontrack.finance.recurring.add' },
    { op: 'wait', id: 'ontrack.finance.recurring.form', timeoutMs: AGENT_UI_WAIT_TIMEOUT_MS },
    { op: 'wait', id: 'ontrack.finance.recurring.type.bill', timeoutMs: AGENT_UI_WAIT_TIMEOUT_MS },
    { op: 'wait', id: 'ontrack.finance.recurring.type.subscription', timeoutMs: AGENT_UI_WAIT_TIMEOUT_MS },
    { op: 'wait', id: 'ontrack.finance.recurring.save', timeoutMs: AGENT_UI_WAIT_TIMEOUT_MS },
    { op: 'tap', id: 'ontrack.finance.recurring.form.close' },
  ],
  'finance-ezpass-import': [
    { op: 'goto', to: 'finance/ezpass-import' },
    { op: 'wait', id: 'ontrack.finance.ezpass', timeoutMs: AGENT_UI_WAIT_TIMEOUT_MS },
    { op: 'wait', id: 'ontrack.finance.ezpass.officialSite', timeoutMs: AGENT_UI_WAIT_TIMEOUT_MS },
    { op: 'wait', id: 'ontrack.finance.ezpass.file', timeoutMs: AGENT_UI_WAIT_TIMEOUT_MS },
    { op: 'wait', id: 'ontrack.finance.ezpass.screenshots', timeoutMs: AGENT_UI_WAIT_TIMEOUT_MS },
  ],
  'finance-ezpass': [
    { op: 'goto', to: 'finance/ezpass' },
    { op: 'wait', id: 'ontrack.finance.ezpass.home', timeoutMs: AGENT_UI_WAIT_TIMEOUT_MS },
    { op: 'wait', id: 'ontrack.finance.ezpass.upload', timeoutMs: AGENT_UI_WAIT_TIMEOUT_MS },
    { op: 'wait', id: 'ontrack.finance.ezpass.monthChart', timeoutMs: AGENT_UI_WAIT_TIMEOUT_MS },
    { op: 'wait', id: 'ontrack.finance.ezpass.monthDetail', timeoutMs: AGENT_UI_WAIT_TIMEOUT_MS },
    { op: 'wait', id: 'ontrack.finance.ezpass.driver.all', timeoutMs: AGENT_UI_WAIT_TIMEOUT_MS },
    { op: 'wait', id: 'ontrack.finance.ezpass.driver.mine', timeoutMs: AGENT_UI_WAIT_TIMEOUT_MS },
    { op: 'tap', id: 'ontrack.finance.ezpass.driver.mine' },
    { op: 'wait', id: 'ontrack.finance.ezpass.monthDetail', timeoutMs: AGENT_UI_WAIT_TIMEOUT_MS },
    { op: 'tap', id: 'ontrack.finance.ezpass.driver.all' },
  ],
  'finance-ezpass-add-friend': [
    { op: 'goto', to: 'finance/ezpass' },
    {
      op: 'wait',
      id: 'ontrack.finance.ezpass.share',
      timeoutMs: AGENT_UI_WAIT_TIMEOUT_MS,
    },
    { op: 'tap', id: 'ontrack.finance.ezpass.share' },
    {
      op: 'wait',
      id: 'ontrack.finance.ezpass.memberManagement',
      timeoutMs: AGENT_UI_WAIT_TIMEOUT_MS,
    },
    {
      op: 'wait',
      id: 'ontrack.peoplePicker.dropdown',
      timeoutMs: AGENT_UI_WAIT_TIMEOUT_MS,
    },
    { op: 'tap', id: 'ontrack.peoplePicker.dropdown' },
    {
      op: 'wait',
      id: 'ontrack.peoplePicker.search',
      timeoutMs: AGENT_UI_WAIT_TIMEOUT_MS,
    },
  ],
  'finance-ezpass-saved-statements': [
    { op: 'goto', to: 'finance/ezpass' },
    { op: 'wait', id: 'ontrack.finance.ezpass.home', timeoutMs: AGENT_UI_WAIT_TIMEOUT_MS },
    { op: 'wait', id: 'ontrack.finance.ezpass.statements', timeoutMs: AGENT_UI_WAIT_TIMEOUT_MS },
    { op: 'tap', id: 'ontrack.finance.ezpass.statements.toggle' },
    { op: 'wait', prefix: 'ontrack.finance.ezpass.statement.', timeoutMs: AGENT_UI_WAIT_TIMEOUT_MS },
  ],
  'finance-tax': [
    { op: 'goto', to: 'finance/tax' },
    { op: 'wait', id: 'ontrack.finance.tax', timeoutMs: AGENT_UI_WAIT_TIMEOUT_MS },
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
      prefix: 'ontrack.workouts.',
      timeoutMs: AGENT_UI_WAIT_TIMEOUT_MS,
    },
  ],
  'workouts-demo': [
    { op: 'seed', to: 'workouts-demo' },
    { op: 'goto', to: 'workouts' },
    {
      op: 'wait',
      id: `ontrack.workouts.todayPlan.${AGENT_UI_DEMO_WORKOUT_ACTIVITY_ID}`,
      timeoutMs: AGENT_UI_WAIT_TIMEOUT_MS,
    },
  ],
  'workouts-demo-explore': [
    { op: 'seed', to: 'workouts-demo' },
    { op: 'goto', to: 'workouts' },
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
} as const satisfies Record<string, readonly import('./flows').AgentUiFlowStep[]>;
