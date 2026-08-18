import type { AppIconName } from '@/design-system';
import type { Href } from 'expo-router';

export type SearchDomain =
  | 'screen'
  | 'travel'
  | 'todos'
  | 'calendar'
  | 'food'
  | 'plants'
  | 'finance'
  | 'vehicles'
  | 'vision-board'
  | 'people'
  | 'journal'
  | 'health';

export type SearchKind = 'screen' | 'entity';

export interface SearchDocument {
  kind: SearchKind;
  domain: SearchDomain;
  id: string;
  title: string;
  subtitle?: string;
  href: Href;
  icon: AppIconName;
}

export interface SearchGroup {
  domain: SearchDomain;
  label: string;
  items: SearchDocument[];
}

export const SEARCH_GROUP_LABEL: Record<SearchDomain, string> = {
  screen: 'Screens',
  travel: 'Trips',
  todos: 'Checklists',
  calendar: 'Calendar',
  food: 'Recipes',
  plants: 'Plants',
  finance: 'Spending',
  vehicles: 'Vehicles',
  'vision-board': 'Vision',
  people: 'People',
  journal: 'Journal',
  health: 'Health',
};

export const SEARCH_GROUP_LIMIT = 8;
