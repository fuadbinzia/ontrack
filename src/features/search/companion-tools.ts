import type { AgentTool } from '@/agents/types';
import { findCategory } from '@/constants/categories';
import { ALL_ACCOUNTS_TEST_TRIP } from '@/constants/travel';
import {
  getTravelChatDeviceId,
  loadTravelChatMessages,
  sendTravelChatMessage,
  travelChatAccessCode,
  travelChatMessagePreview,
} from '@/features/travel/chat';
import type { TravelPlan } from '@/features/travel/types';
import { useAddons } from '@/store/addons';
import { usePreferences } from '@/store/preferences';
import { useSchedule } from '@/store/schedule';
import { useChecklists } from '@/store/todos';
import {
  DEFAULT_GROCERY_LIST_NAME,
  isGroceryListName,
} from '@/store/todos-normalize';
import { useTravel } from '@/store/travel';
import { addDays, formatDateLong, formatMinutes, formatWeekday, todayKey } from '@/utils/date';

import { openDeviceAssistant, openNavigateTo } from './companion-navigate';
import { companionNavigate } from './ensure-companion';
import { buildSearchDocuments, groupSearchDocuments } from './search-documents';
import { catalogSearchScreens } from './search-screens';

const objectParams = {
  type: 'object',
  additionalProperties: false,
} as const;

function asRecord(input: unknown): Record<string, unknown> {
  return input && typeof input === 'object' && !Array.isArray(input)
    ? (input as Record<string, unknown>)
    : {};
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function asBoolean(value: unknown, fallback = false): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

type UndoOp =
  | { type: 'delete-task'; id: string }
  | { type: 'restore-task-title'; id: string; title: string }
  | { type: 'set-task-completion'; id: string; completed: boolean }
  | { type: 'delete-activity'; id: string }
  | { type: 'restore-activity'; id: string; title: string; notes?: string; date: string };

const undoStack: UndoOp[] = [];

export function resetCompanionUndoForTests() {
  undoStack.length = 0;
}

function pushUndo(op: UndoOp) {
  undoStack.push(op);
  if (undoStack.length > 20) undoStack.shift();
}

function findList(name: string) {
  const lists = useChecklists.getState().lists;
  const needle = name.trim().toLowerCase();
  if (!needle) return lists[0];
  return (
    lists.find((list) => list.name.trim().toLowerCase() === needle) ??
    lists.find((list) => list.name.trim().toLowerCase().includes(needle))
  );
}

function ensureList(name: string) {
  const existing = findList(name);
  if (existing) return existing;
  const kind = isGroceryListName(name) ? 'grocery' : 'checklist';
  return useChecklists.getState().createList(name || DEFAULT_GROCERY_LIST_NAME, kind);
}

function findTask(title: string) {
  const needle = title.trim().toLowerCase();
  return useChecklists.getState().tasks.find((task) => task.title.trim().toLowerCase() === needle)
    ?? useChecklists.getState().tasks.find((task) => task.title.trim().toLowerCase().includes(needle));
}

function resolveDate(value: string): string {
  const trimmed = value.trim().toLowerCase();
  if (!trimmed || trimmed === 'today') return todayKey();
  if (trimmed === 'tomorrow') return addDays(todayKey(), 1);
  if (/^\d{4}-\d{2}-\d{2}$/.test(value.trim())) return value.trim();
  return todayKey();
}

function findActivity(title: string) {
  const needle = title.trim().toLowerCase();
  const activities = useSchedule.getState().activities;
  return (
    activities.find((activity) => activity.title.trim().toLowerCase() === needle) ??
    activities.find((activity) => activity.title.trim().toLowerCase().includes(needle))
  );
}

function compareCompanionTrips(a: TravelPlan, b: TravelPlan): number {
  return (
    a.startDate.localeCompare(b.startDate) ||
    a.endDate.localeCompare(b.endDate) ||
    a.title.localeCompare(b.title)
  );
}

/** Live travel store at call time — never a cached snapshot. */
function companionVisiblePlans(): TravelPlan[] {
  const plans = useTravel.getState().plans;
  const hasRealPlan = plans.some((plan) => plan.id !== ALL_ACCOUNTS_TEST_TRIP.id);
  return hasRealPlan
    ? plans.filter((plan) => plan.id !== ALL_ACCOUNTS_TEST_TRIP.id)
    : plans;
}

function listUpcomingCompanionTrips(): TravelPlan[] {
  const today = todayKey();
  return companionVisiblePlans()
    .filter((plan) => plan.endDate >= today)
    .sort(compareCompanionTrips);
}

function listCompanionTrips(): TravelPlan[] {
  const upcoming = listUpcomingCompanionTrips();
  const upcomingIds = new Set(upcoming.map((plan) => plan.id));
  const past = companionVisiblePlans()
    .filter((plan) => !upcomingIds.has(plan.id))
    .sort(compareCompanionTrips);
  return [...upcoming, ...past];
}

function nextCompanionTrip(): TravelPlan | undefined {
  return listUpcomingCompanionTrips()[0];
}

function spokenNextTrip(plan: TravelPlan): string {
  const place = plan.destination.trim() || plan.title.trim() || 'your trip';
  const when = formatDateLong(plan.startDate, { year: true });
  return `Your next trip is ${place} on ${when}.`;
}

function tripSummary(plan: TravelPlan, next: boolean) {
  return {
    id: plan.id,
    title: plan.title,
    destination: plan.destination,
    startDate: plan.startDate,
    endDate: plan.endDate,
    next,
  };
}

function findTrip(title: string) {
  const needle = title.trim().toLowerCase();
  if (!needle) return nextCompanionTrip();
  const plans = useTravel.getState().plans;
  return (
    plans.find((plan) => plan.title.trim().toLowerCase() === needle) ??
    plans.find((plan) => plan.title.trim().toLowerCase().includes(needle))
  );
}

function nextNavigateQuery(named?: string): string | null {
  if (named?.trim()) return named.trim();
  const today = todayKey();
  const activities = useSchedule.getState().activities
    .filter((activity) => activity.date >= today && activity.status !== 'completed')
    .sort((a, b) => a.date.localeCompare(b.date) || a.startMinutes - b.startMinutes);
  const activity = activities[0];
  if (activity?.notes?.trim()) return activity.notes.trim();
  if (activity?.title.trim()) return activity.title.trim();

  const plan = nextCompanionTrip();
  if (!plan) return null;
  const stop = [...plan.itinerary]
    .filter((item) => item.date >= today)
    .sort((a, b) => a.date.localeCompare(b.date) || a.startMinutes - b.startMinutes)[0];
  if (stop) {
    const stopAddress = stop.transport?.stops?.find((entry) => entry.address?.trim())?.address;
    return stopAddress?.trim() || stop.transport?.destination || stop.title;
  }
  return plan.destination || plan.title;
}

export const companionTools: readonly AgentTool[] = [
  {
    id: 'search_app',
    capability: 'todos.read',
    description: 'Search screens and local onTrack records by text.',
    parameters: {
      ...objectParams,
      properties: { query: { type: 'string' } },
      required: ['query'],
    },
    execute: async (input) => {
      const query = asString(asRecord(input).query);
      const groups = groupSearchDocuments(
        buildSearchDocuments({ enabledAddons: useAddons.getState().enabled, query }),
      );
      return {
        groups: groups.map((group) => ({
          label: group.label,
          items: group.items.map((item) => ({
            id: item.id,
            title: item.title,
            subtitle: item.subtitle,
            href: item.href,
          })),
        })),
      };
    },
  },
  {
    id: 'get_today',
    capability: 'calendar.read',
    description: 'Return today’s date and calendar activities. Use for “what day is it”.',
    parameters: objectParams,
    execute: async () => {
      const date = todayKey();
      const weekday = formatWeekday(date);
      const label = formatDateLong(date, { year: true });
      const { activities, categories } = useSchedule.getState();
      return {
        date,
        weekday,
        label,
        spoken: `Today is ${weekday}, ${label}.`,
        activities: activities
          .filter((activity) => activity.date === date)
          .map((activity) => ({
            id: activity.id,
            title: activity.title,
            time: activity.allDay ? 'All day' : formatMinutes(activity.startMinutes),
            category: findCategory(categories, activity.categoryId).name,
            notes: activity.notes,
          })),
      };
    },
  },
  {
    id: 'list_open_tasks',
    capability: 'todos.read',
    description: 'List incomplete checklist items.',
    parameters: objectParams,
    execute: async () => {
      const { lists, tasks } = useChecklists.getState();
      const listName = new Map(lists.map((list) => [list.id, list.name]));
      return {
        tasks: tasks
          .filter((task) => !task.completed)
          .map((task) => ({
            id: task.id,
            title: task.title,
            list: listName.get(task.listId) ?? 'Checklist',
          })),
      };
    },
  },
  {
    id: 'list_trips',
    capability: 'travel.read',
    description: 'List live saved trips. Upcoming first; the next trip is marked next: true.',
    parameters: objectParams,
    execute: async () => {
      const upcoming = listUpcomingCompanionTrips();
      const nextId = upcoming[0]?.id;
      return {
        trips: listCompanionTrips().map((plan) => tripSummary(plan, plan.id === nextId)),
      };
    },
  },
  {
    id: 'get_next_trip',
    capability: 'travel.read',
    description:
      'Return the next upcoming trip from live travel data. Use for “when is my next trip” / “when do I travel”.',
    parameters: objectParams,
    execute: async () => {
      const plan = nextCompanionTrip();
      if (!plan) return { ok: false, spoken: 'No upcoming trips.' };
      return {
        ok: true,
        ...tripSummary(plan, true),
        spoken: spokenNextTrip(plan),
      };
    },
  },
  {
    id: 'add_task',
    capability: 'todos.write',
    description: 'Add a checklist item immediately. No confirmation.',
    parameters: {
      ...objectParams,
      properties: {
        title: { type: 'string' },
        list: { type: 'string', description: 'List name. Defaults to Groceries when grocery-like.' },
      },
      required: ['title'],
    },
    execute: async (input) => {
      const record = asRecord(input);
      const title = asString(record.title);
      if (!title) return { ok: false, error: 'Need a task title.' };
      const list = ensureList(asString(record.list) || DEFAULT_GROCERY_LIST_NAME);
      if (!list) return { ok: false, error: 'Could not open a list.' };
      const task = useChecklists.getState().addTask(list.id, title);
      if (!task) return { ok: false, error: 'Could not add that item.' };
      pushUndo({ type: 'delete-task', id: task.id });
      return { ok: true, spoken: `Added ${title} to ${list.name}`, taskId: task.id, list: list.name };
    },
  },
  {
    id: 'update_task',
    capability: 'todos.write',
    description: 'Rename a checklist item immediately.',
    parameters: {
      ...objectParams,
      properties: { title: { type: 'string' }, newTitle: { type: 'string' } },
      required: ['title', 'newTitle'],
    },
    execute: async (input) => {
      const record = asRecord(input);
      const task = findTask(asString(record.title));
      const newTitle = asString(record.newTitle);
      if (!task || !newTitle) return { ok: false, error: 'Name the task to change.' };
      pushUndo({ type: 'restore-task-title', id: task.id, title: task.title });
      useChecklists.getState().updateTask(task.id, newTitle);
      return { ok: true, spoken: `Updated ${newTitle}`, taskId: task.id };
    },
  },
  {
    id: 'complete_task',
    capability: 'todos.write',
    description: 'Complete or reopen a checklist item immediately.',
    parameters: {
      ...objectParams,
      properties: {
        title: { type: 'string' },
        completed: { type: 'boolean' },
      },
      required: ['title'],
    },
    execute: async (input) => {
      const record = asRecord(input);
      const task = findTask(asString(record.title));
      if (!task) return { ok: false, error: 'Name the task to complete.' };
      const completed = asBoolean(record.completed, true);
      pushUndo({ type: 'set-task-completion', id: task.id, completed: task.completed });
      useChecklists.getState().setTaskCompletion(task.id, completed);
      return {
        ok: true,
        spoken: completed ? `Completed ${task.title}` : `Reopened ${task.title}`,
        taskId: task.id,
      };
    },
  },
  {
    id: 'undo',
    capability: 'todos.write',
    description: 'Undo the last companion write.',
    parameters: objectParams,
    execute: async () => {
      const op = undoStack.pop();
      if (!op) return { ok: false, error: 'Nothing to undo.' };
      const checklists = useChecklists.getState();
      const schedule = useSchedule.getState();
      if (op.type === 'delete-task') checklists.deleteTask(op.id);
      if (op.type === 'restore-task-title') checklists.updateTask(op.id, op.title);
      if (op.type === 'set-task-completion') checklists.setTaskCompletion(op.id, op.completed);
      if (op.type === 'delete-activity') schedule.deleteActivity(op.id);
      if (op.type === 'restore-activity') {
        schedule.updateActivity(op.id, { title: op.title, notes: op.notes, date: op.date });
      }
      return { ok: true, spoken: 'Undid that' };
    },
  },
  {
    id: 'add_activity',
    capability: 'calendar.write',
    description: 'Add a calendar event immediately. No confirmation.',
    parameters: {
      ...objectParams,
      properties: {
        title: { type: 'string' },
        date: { type: 'string', description: 'today, tomorrow, or YYYY-MM-DD' },
        startMinutes: { type: 'number' },
        notes: { type: 'string' },
      },
      required: ['title'],
    },
    execute: async (input) => {
      const record = asRecord(input);
      const title = asString(record.title);
      if (!title) return { ok: false, error: 'Need an event title.' };
      const date = resolveDate(asString(record.date));
      const startMinutes =
        typeof record.startMinutes === 'number' ? record.startMinutes : 9 * 60;
      const activity = useSchedule.getState().addActivity({
        date,
        title,
        categoryId: 'personal',
        startMinutes,
        durationMinutes: 60,
        notes: asString(record.notes) || undefined,
      });
      pushUndo({ type: 'delete-activity', id: activity.id });
      return { ok: true, spoken: `Added ${title}`, activityId: activity.id, date };
    },
  },
  {
    id: 'update_activity',
    capability: 'calendar.write',
    description: 'Change a calendar event immediately.',
    parameters: {
      ...objectParams,
      properties: {
        title: { type: 'string' },
        newTitle: { type: 'string' },
        date: { type: 'string' },
        notes: { type: 'string' },
      },
      required: ['title'],
    },
    execute: async (input) => {
      const record = asRecord(input);
      const activity = findActivity(asString(record.title));
      if (!activity) return { ok: false, error: 'Name the event to change.' };
      pushUndo({
        type: 'restore-activity',
        id: activity.id,
        title: activity.title,
        notes: activity.notes,
        date: activity.date,
      });
      const patch: { title?: string; notes?: string; date?: string } = {};
      const newTitle = asString(record.newTitle);
      if (newTitle) patch.title = newTitle;
      if (typeof record.notes === 'string') patch.notes = record.notes;
      if (asString(record.date)) patch.date = resolveDate(asString(record.date));
      useSchedule.getState().updateActivity(activity.id, patch);
      return { ok: true, spoken: `Updated ${patch.title ?? activity.title}`, activityId: activity.id };
    },
  },
  {
    id: 'navigate',
    capability: 'shell.act',
    description: 'Open a screen or entity in onTrack.',
    parameters: {
      ...objectParams,
      properties: { query: { type: 'string' } },
      required: ['query'],
    },
    execute: async (input) => {
      const query = asString(asRecord(input).query);
      const enabledAddons = useAddons.getState().enabled;
      const screens = catalogSearchScreens(enabledAddons, query);
      const groups = groupSearchDocuments(
        buildSearchDocuments({ enabledAddons, query }),
      );
      const first = screens[0] ?? groups.flatMap((group) => group.items)[0];
      if (!first) return { ok: false, error: 'Nothing to open.' };
      const opened = companionNavigate(first.href);
      return { ok: opened.opened, spoken: `Opening ${first.title}`, href: first.href };
    },
  },
  {
    id: 'update_plan',
    capability: 'travel.write',
    description: 'Change a trip title or notes immediately.',
    parameters: {
      ...objectParams,
      properties: {
        title: { type: 'string' },
        newTitle: { type: 'string' },
        notes: { type: 'string' },
      },
      required: ['title'],
    },
    execute: async (input) => {
      const record = asRecord(input);
      const plan = findTrip(asString(record.title));
      if (!plan) return { ok: false, error: 'Name the trip to change.' };
      const next = {
        ...plan,
        title: asString(record.newTitle) || plan.title,
        notes: typeof record.notes === 'string' ? record.notes : plan.notes,
      };
      const ok = useTravel.getState().savePlan(next);
      return { ok, spoken: ok ? `Updated ${next.title}` : 'Could not update that trip' };
    },
  },
  {
    id: 'navigate_to',
    capability: 'shell.act',
    description: 'Open Waze or Maps navigating to the next stop, event address, or a named place.',
    parameters: {
      ...objectParams,
      properties: { destination: { type: 'string' } },
    },
    execute: async (input) => {
      const query = nextNavigateQuery(asString(asRecord(input).destination));
      if (!query) return { ok: false, error: 'No next stop or address found.' };
      const opened = await openNavigateTo(query);
      return { ok: true, spoken: `Navigating to ${query}`, destination: query, app: opened.opened };
    },
  },
  {
    id: 'activate_assistant',
    capability: 'shell.act',
    description: 'Release the mic and open Siri (not possible) or Google Assistant on Android.',
    parameters: objectParams,
    execute: async () => {
      const result = await openDeviceAssistant();
      return {
        ok: result.opened,
        spoken: result.opened ? "Google's ready" : result.reason,
        releaseMic: true,
        pauseUntilActive: true,
      };
    },
  },
  {
    id: 'read_trip_chat',
    capability: 'travel.read',
    description: 'Read the latest trip chat messages aloud. Only when the user asks.',
    parameters: {
      ...objectParams,
      properties: { title: { type: 'string' } },
    },
    execute: async (input) => {
      const plan = findTrip(asString(asRecord(input).title));
      const accessCode = plan ? travelChatAccessCode(plan) : undefined;
      if (!plan || !accessCode) return { ok: false, error: 'That trip has no chat yet.' };
      const messages = (await loadTravelChatMessages(accessCode)).slice(-6);
      const lines = messages.map(
        (message) => `${message.senderName} says ${travelChatMessagePreview(message)}`,
      );
      return {
        ok: true,
        spoken: lines.length ? lines.join('. ') : 'No messages yet.',
        trip: plan.title,
      };
    },
  },
  {
    id: 'send_trip_chat',
    capability: 'travel.write',
    description: 'Send a text message to a trip chat immediately.',
    parameters: {
      ...objectParams,
      properties: { title: { type: 'string' }, body: { type: 'string' } },
      required: ['body'],
    },
    execute: async (input) => {
      const record = asRecord(input);
      const plan = findTrip(asString(record.title));
      const body = asString(record.body);
      const accessCode = plan ? travelChatAccessCode(plan) : undefined;
      if (!plan || !accessCode) return { ok: false, error: 'That trip has no chat yet.' };
      if (!body) return { ok: false, error: 'Need a message to send.' };
      const senderName = usePreferences.getState().name.trim() || 'You';
      await sendTravelChatMessage({
        accessCode,
        senderName,
        senderDeviceId: await getTravelChatDeviceId(),
        body,
      });
      return { ok: true, spoken: `Sent to ${plan.title}`, trip: plan.title };
    },
  },
];
