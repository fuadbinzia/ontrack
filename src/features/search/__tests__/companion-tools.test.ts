import mockAsyncStorage from '@react-native-async-storage/async-storage/jest/async-storage-mock';

import { ALL_ADDONS_ON } from '@/addons/registry';
import { ONTRACK_COMPANION_ID } from '@/agents/registry';
import { ALL_ACCOUNTS_TEST_TRIP } from '@/constants/travel';
import type { TravelPlan } from '@/features/travel/types';
import { AGENT_RUN_SYSTEM_PROMPT } from '@/services/agents/run-types';
import { useAddons } from '@/store/addons';
import { useAgents } from '@/store/agents';
import { useSchedule } from '@/store/schedule';
import { useChecklists } from '@/store/todos';
import { useTravel } from '@/store/travel';
import { addDays, formatDateLong, formatWeekday, todayKey } from '@/utils/date';

import { companionTools, resetCompanionUndoForTests } from '../companion-tools';
import { companionCapabilitiesForAddons, ensureCompanionReady } from '../ensure-companion';
import { redactToolResult } from '../companion-redact';

jest.mock('@react-native-async-storage/async-storage', () => mockAsyncStorage);

function tool(id: string) {
  const found = companionTools.find((item) => item.id === id);
  if (!found) throw new Error(`Missing tool ${id}`);
  return found;
}

function plan(
  overrides: Partial<TravelPlan> &
    Pick<TravelPlan, 'id' | 'title' | 'destination' | 'startDate' | 'endDate'>,
): TravelPlan {
  return {
    itinerary: [],
    participants: [],
    baseCurrency: 'USD',
    expenses: [],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function seedPlans(plans: TravelPlan[], fixtureFirst = false) {
  for (const item of plans) {
    expect(useTravel.getState().savePlan(item)).toBe(true);
  }
  if (!fixtureFirst) return;
  const current = useTravel.getState().plans;
  const fixture = current.find((item) => item.id === ALL_ACCOUNTS_TEST_TRIP.id);
  if (!fixture) return;
  useTravel.setState({
    plans: [fixture, ...current.filter((item) => item.id !== fixture.id)],
  });
}

describe('onTrack companion', () => {
  beforeEach(() => {
    useChecklists.getState().reset();
    useSchedule.getState().resetAll();
    useTravel.getState().reset();
    useAgents.getState().reset();
    useAddons.getState().replaceEnabled(ALL_ADDONS_ON);
    resetCompanionUndoForTests();
  });

  it('auto-installs as an included agent with core capabilities', () => {
    expect(ensureCompanionReady()).toBe(true);
    const installation = useAgents.getState().installations[ONTRACK_COMPANION_ID];
    expect(installation?.enabled).toBe(true);
    expect(installation?.grantedCapabilities).toEqual(
      expect.arrayContaining(['todos.read', 'todos.write', 'shell.act']),
    );
    expect(companionCapabilitiesForAddons(ALL_ADDONS_ON)).toEqual(
      expect.arrayContaining(['travel.read', 'calendar.write']),
    );
  });

  it('adds and changes a task immediately without a confirm gate', async () => {
    const source = require('node:fs').readFileSync(
      require('node:path').join(process.cwd(), 'src/features/search/companion-tools.ts'),
      'utf8',
    );
    expect(source).not.toContain('appPrompt');
    expect(source).not.toContain('confirm-destructive');

    const added = (await tool('add_task').execute(
      { title: 'Milk', list: 'Groceries' },
      { agentId: ONTRACK_COMPANION_ID },
    )) as { ok: boolean; spoken: string };
    expect(added.ok).toBe(true);
    expect(added.spoken).toContain('Milk');
    expect(useChecklists.getState().tasks.some((task) => task.title === 'Milk')).toBe(true);

    const updated = (await tool('update_task').execute(
      { title: 'Milk', newTitle: 'Oat milk' },
      { agentId: ONTRACK_COMPANION_ID },
    )) as { ok: boolean };
    expect(updated.ok).toBe(true);
    expect(useChecklists.getState().tasks.some((task) => task.title === 'Oat milk')).toBe(true);
  });

  it('adds and changes a calendar activity immediately', async () => {
    const added = (await tool('add_activity').execute(
      { title: 'Dentist', date: 'today' },
      { agentId: ONTRACK_COMPANION_ID },
    )) as { ok: boolean; activityId: string };
    expect(added.ok).toBe(true);
    expect(useSchedule.getState().activities.some((activity) => activity.title === 'Dentist')).toBe(
      true,
    );

    const updated = (await tool('update_activity').execute(
      { title: 'Dentist', newTitle: 'Cleaning' },
      { agentId: ONTRACK_COMPANION_ID },
    )) as { ok: boolean };
    expect(updated.ok).toBe(true);
    expect(useSchedule.getState().activities.some((activity) => activity.title === 'Cleaning')).toBe(
      true,
    );
  });

  it('says the current weekday and date for get_today', async () => {
    const date = todayKey();
    const today = (await tool('get_today').execute({}, { agentId: ONTRACK_COMPANION_ID })) as {
      date: string;
      weekday: string;
      label: string;
      spoken: string;
    };
    expect(today.date).toBe(date);
    expect(today.weekday).toBe(formatWeekday(date));
    expect(today.label).toBe(formatDateLong(date, { year: true }));
    expect(today.spoken).toBe(`Today is ${today.weekday}, ${today.label}.`);
    expect(today.spoken).not.toContain('[redacted]');

    const redacted = redactToolResult(today) as { date: string; spoken: string };
    expect(redacted.date).toBe(date);
    expect(redacted.spoken).toBe(today.spoken);
  });

  it('answers next trip from live user data, not the all-accounts fixture or a past trip', async () => {
    const today = todayKey();
    const past = plan({
      id: 'trip-rome',
      title: 'Rome',
      destination: 'Rome',
      startDate: addDays(today, -60),
      endDate: addDays(today, -50),
    });
    const lisbon = plan({
      id: 'trip-lisbon',
      title: 'Lisbon',
      destination: 'Lisbon',
      startDate: addDays(today, 47),
      endDate: addDays(today, 54),
    });
    const fixture = {
      ...ALL_ACCOUNTS_TEST_TRIP,
      startDate: addDays(today, 7),
      endDate: addDays(today, 14),
    };
    seedPlans([past, lisbon, fixture], true);
    expect(useTravel.getState().plans[0]?.id).toBe(ALL_ACCOUNTS_TEST_TRIP.id);

    const next = (await tool('get_next_trip').execute({}, { agentId: ONTRACK_COMPANION_ID })) as {
      ok: boolean;
      id: string;
      title: string;
      startDate: string;
      spoken: string;
    };
    expect(next.ok).toBe(true);
    expect(next.id).toBe('trip-lisbon');
    expect(next.title).toBe('Lisbon');
    expect(next.spoken).toContain('Lisbon');
    expect(next.spoken).toContain(formatDateLong(lisbon.startDate, { year: true }));
    expect(next.spoken).not.toContain('Test trip');
    const redactedNext = redactToolResult(next) as { startDate: string; spoken: string };
    expect(redactedNext.startDate).toBe(lisbon.startDate);
    expect(redactedNext.spoken).toBe(next.spoken);
    expect(redactedNext.spoken).not.toContain('[redacted]');

    const listed = (await tool('list_trips').execute({}, { agentId: ONTRACK_COMPANION_ID })) as {
      trips: { id: string; startDate?: string; endDate?: string; next?: boolean }[];
    };
    expect(listed.trips.map((trip) => trip.id)).not.toContain(ALL_ACCOUNTS_TEST_TRIP.id);
    expect(listed.trips[0]).toMatchObject({ id: 'trip-lisbon', next: true });
    expect(listed.trips.find((trip) => trip.id === 'trip-rome')?.next).toBeFalsy();
    expect(listed.trips.map((trip) => trip.id).indexOf('trip-lisbon')).toBeLessThan(
      listed.trips.map((trip) => trip.id).indexOf('trip-rome'),
    );
    const redactedListed = redactToolResult(listed) as typeof listed;
    expect(redactedListed.trips[0]?.startDate).toBe(lisbon.startDate);
    expect(redactedListed.trips[0]?.endDate).toBe(lisbon.endDate);
  });

  it('says there are no upcoming trips when every real plan has ended', async () => {
    const today = todayKey();
    seedPlans([
      plan({
        id: 'trip-rome',
        title: 'Rome',
        destination: 'Rome',
        startDate: addDays(today, -20),
        endDate: addDays(today, -10),
      }),
    ]);

    const next = (await tool('get_next_trip').execute({}, { agentId: ONTRACK_COMPANION_ID })) as {
      ok: boolean;
      spoken: string;
    };
    expect(next.ok).toBe(false);
    expect(next.spoken.toLowerCase()).toContain('no upcoming');
  });

  it('may return the all-accounts fixture when it is the only plan', async () => {
    const today = todayKey();
    seedPlans([
      {
        ...ALL_ACCOUNTS_TEST_TRIP,
        startDate: addDays(today, 7),
        endDate: addDays(today, 14),
      },
    ]);

    const next = (await tool('get_next_trip').execute({}, { agentId: ONTRACK_COMPANION_ID })) as {
      ok: boolean;
      id: string;
      spoken: string;
    };
    expect(next.ok).toBe(true);
    expect(next.id).toBe(ALL_ACCOUNTS_TEST_TRIP.id);
    expect(next.spoken).toContain(ALL_ACCOUNTS_TEST_TRIP.destination);
  });

  it('treats a trip that has started but not ended as upcoming', async () => {
    const today = todayKey();
    const inProgress = plan({
      id: 'trip-lisbon',
      title: 'Lisbon',
      destination: 'Lisbon',
      startDate: addDays(today, -2),
      endDate: addDays(today, 4),
    });
    seedPlans(
      [
        inProgress,
        {
          ...ALL_ACCOUNTS_TEST_TRIP,
          startDate: addDays(today, 20),
          endDate: addDays(today, 26),
        },
      ],
      true,
    );

    const next = (await tool('get_next_trip').execute({}, { agentId: ONTRACK_COMPANION_ID })) as {
      ok: boolean;
      id: string;
      startDate: string;
    };
    expect(next.ok).toBe(true);
    expect(next.id).toBe('trip-lisbon');
    expect(next.startDate < today).toBe(true);
  });

  it('finds a named trip even when the fixture is first in the store', async () => {
    const today = todayKey();
    seedPlans(
      [
        plan({
          id: 'trip-lisbon',
          title: 'Lisbon',
          destination: 'Lisbon',
          startDate: addDays(today, 47),
          endDate: addDays(today, 54),
        }),
        {
          ...ALL_ACCOUNTS_TEST_TRIP,
          startDate: addDays(today, 7),
          endDate: addDays(today, 14),
        },
      ],
      true,
    );

    const updated = (await tool('update_plan').execute(
      { title: 'Lisbon', notes: 'Pack walking shoes' },
      { agentId: ONTRACK_COMPANION_ID },
    )) as { ok: boolean; spoken: string };
    expect(updated.ok).toBe(true);
    expect(updated.spoken).toContain('Lisbon');
    expect(useTravel.getState().plans.find((item) => item.id === 'trip-lisbon')?.notes).toBe(
      'Pack walking shoes',
    );
    expect(
      useTravel.getState().plans.find((item) => item.id === ALL_ACCOUNTS_TEST_TRIP.id)?.notes,
    ).not.toBe('Pack walking shoes');

    const missed = (await tool('update_plan').execute(
      { title: 'Kyoto', notes: 'Should not apply' },
      { agentId: ONTRACK_COMPANION_ID },
    )) as { ok: boolean };
    expect(missed.ok).toBe(false);

    const emptyTitle = (await tool('update_plan').execute(
      { title: '', newTitle: 'Lisbon Stay' },
      { agentId: ONTRACK_COMPANION_ID },
    )) as { ok: boolean; spoken: string };
    expect(emptyTitle.ok).toBe(true);
    expect(emptyTitle.spoken).toContain('Lisbon Stay');
    expect(useTravel.getState().plans.find((item) => item.id === 'trip-lisbon')?.title).toBe(
      'Lisbon Stay',
    );
    expect(
      useTravel.getState().plans.find((item) => item.id === ALL_ACCOUNTS_TEST_TRIP.id)?.title,
    ).toBe(ALL_ACCOUNTS_TEST_TRIP.title);
  });

  it('adds a non-grocery task to To Do when no list is named', async () => {
    const added = (await tool('add_task').execute(
      { title: 'Call dentist' },
      { agentId: ONTRACK_COMPANION_ID },
    )) as { ok: boolean; list: string };
    expect(added.ok).toBe(true);
    expect(added.list).toBe('To Do');
    const list = useChecklists.getState().lists.find((item) => item.name === 'To Do');
    expect(
      useChecklists.getState().tasks.some(
        (task) => task.title === 'Call dentist' && task.listId === list?.id,
      ),
    ).toBe(true);
    expect(useChecklists.getState().lists.some((item) => item.name === 'Groceries')).toBe(false);
  });

  it('does not claim a shared-list member completed a task that stayed open', async () => {
    const list = useChecklists.getState().createList('Shared Groceries', 'grocery')!;
    const task = useChecklists.getState().addTask(list.id, 'Milk')!;
    useChecklists.setState((state) => ({
      lists: state.lists.map((item) =>
        item.id === list.id ? { ...item, mode: 'shared' as const, role: 'member' as const } : item,
      ),
    }));

    const completed = (await tool('complete_task').execute(
      { title: 'Milk' },
      { agentId: ONTRACK_COMPANION_ID },
    )) as { ok: boolean; spoken?: string; error?: string };
    expect(completed.ok).toBe(false);
    expect(completed.spoken).toBeUndefined();
    expect(completed.error?.toLowerCase()).toContain('permission');
    expect(useChecklists.getState().tasks.find((item) => item.id === task.id)?.completed).toBe(
      false,
    );
  });

  it('requires get_next_trip for live trip answers and forbids answering from memory', () => {
    expect(AGENT_RUN_SYSTEM_PROMPT).toContain('get_next_trip');
    expect(AGENT_RUN_SYSTEM_PROMPT).toMatch(/Always call tools for live device data/i);
    expect(AGENT_RUN_SYSTEM_PROMPT).toMatch(
      /Never answer trip, calendar, or task questions from memory/i,
    );
    expect(tool('get_next_trip').capability).toBe('travel.read');
  });
});
