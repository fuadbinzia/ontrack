import type { AgentUiFixtureName } from './fixtures-constants';

export type AgentUiSeedResult = {
  fixture: AgentUiFixtureName;
  /** Primary entity id for host status (`id` field). */
  primaryId: string;
  planId?: string;
  flightItemId?: string;
  listId?: string;
  taskId?: string;
  recipeId?: string;
  factorId?: string;
  moodEntryId?: string;
  vehicleId?: string;
  plantId?: string;
  activityId?: string;
  categoryId?: string;
  itemId?: string;
};
