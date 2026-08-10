/** Design catalog types + labels (rows in design-system-catalog-data). */

export type DesignCatalogGroup =
  | 'Layout'
  | 'Actions'
  | 'Forms'
  | 'Feedback'
  | 'Content'
  | 'Shared';

export type DesignFeatureId =
  | 'account'
  | 'auth'
  | 'daily-tracking'
  | 'calendar'
  | 'games'
  | 'health'
  | 'nutrition'
  | 'plants'
  | 'social'
  | 'todos'
  | 'travel'
  | 'vehicles'
  | 'vision-board'
  | 'workouts'
  | 'agents';

export type DesignCatalogElement = {
  id: string;
  name: string;
  group: DesignCatalogGroup;
  description: string;
  /** Gallery tab that demos this element. */
  demo: 'components' | 'forms' | 'colors' | 'fonts' | 'icons';
  /** Feature areas that import/use this element. Empty = gallery / infra only. */
  usedBy: readonly DesignFeatureId[];
};

export const DESIGN_FEATURE_LABELS: Record<DesignFeatureId, string> = {
  account: 'Account',
  auth: 'Auth',
  'daily-tracking': 'Today',
  calendar: 'Calendar',
  games: 'Games',
  health: 'Health',
  nutrition: 'Nutrition',
  plants: 'Plants',
  social: 'Social',
  todos: 'Todos',
  travel: 'Travel',
  vehicles: 'Vehicles',
  'vision-board': 'Vision Board',
  workouts: 'Workouts',
  agents: 'Agents',
};

export const DESIGN_CATALOG_GROUPS: readonly DesignCatalogGroup[] = [
  'Layout',
  'Actions',
  'Forms',
  'Feedback',
  'Content',
  'Shared',
] as const;

/** Plain-language section titles for the Elements tab. */
export const DESIGN_CATALOG_GROUP_LABELS: Record<DesignCatalogGroup, string> = {
  Layout: 'Screens & layout',
  Actions: 'Buttons & actions',
  Forms: 'Forms & settings',
  Feedback: 'Status & feedback',
  Content: 'Content blocks',
  Shared: 'Shared patterns',
};
