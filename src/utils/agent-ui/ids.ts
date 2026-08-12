/** Stable agent-facing testIDs. Convention: ontrack.<feature>.<surface>.<control> */

import { agentUiIdsFinance } from './ids-finance';
import { agentUiIdsFood } from './ids-food';
import { agentUiIdsShell } from './ids-shell';
import { agentUiIdsTravel } from './ids-travel';

export const AgentUiIds = {
  ...agentUiIdsShell,
  ...agentUiIdsFood,
  ...agentUiIdsTravel,
  ...agentUiIdsFinance,
} as const;

export function tabTestIdForRoute(routeName: string): string | undefined {
  switch (routeName) {
    case 'index':
    case '(today)':
      return AgentUiIds.tabs.today;
    case 'calendar':
      return AgentUiIds.tabs.calendar;
    case 'to-do':
      return AgentUiIds.tabs.checklists;
    case 'social':
      return AgentUiIds.tabs.social;
    case 'insights':
      return AgentUiIds.tabs.insights;
    case 'profile':
      return AgentUiIds.tabs.profile;
    case 'workouts':
      return AgentUiIds.tabs.workouts;
    case 'plants':
      return AgentUiIds.tabs.plants;
    case 'travel':
      return AgentUiIds.tabs.travel;
    case 'vision-board':
      return AgentUiIds.tabs.visionBoard;
    case 'games':
      return AgentUiIds.tabs.games;
    case 'vehicles':
      return AgentUiIds.tabs.vehicles;
    case 'health':
      return AgentUiIds.tabs.health;
    case 'finance':
      return AgentUiIds.tabs.finance;
    case 'food':
      return AgentUiIds.tabs.food;
    case 'trackers':
    case 'more':
      return AgentUiIds.tabs.more;
    default:
      return undefined;
  }
}
