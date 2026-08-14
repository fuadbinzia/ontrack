import {
    AGENT_UI_DEMO_ACTIVITY_ID,
    AGENT_UI_DEMO_CHASE_OUTBOUND_ID,
    AGENT_UI_DEMO_CHECKLIST_TASK_PLAN_ID,
    AGENT_UI_DEMO_EVENT_ACTIVITY_ID,
    AGENT_UI_DEMO_EVENT_BOUT_ID,
    AGENT_UI_DEMO_FOOD_ACTIVITY_ID,
    AGENT_UI_DEMO_GROCERY_LIST_ID,
    AGENT_UI_DEMO_HEALTH_MOOD_ID,
    AGENT_UI_DEMO_TRIP_ID,
    AGENT_UI_DEMO_VEHICLE_ID,
    AGENT_UI_DEMO_VISION_ITEM_ID,
    AGENT_UI_DEMO_WORKOUT_ACTIVITY_ID,
    AGENT_UI_DEMO_WORKOUT_CATALOG_EXERCISE_ID,
} from "../fixtures";
import {
    AGENT_UI_WAIT_TIMEOUT_MS,
    listAgentUiFlowNames,
    resolveAgentUiFlow,
} from "../flows";

describe('agent-ui flows', () => {
  it('lists and resolves named flows', () => {
    expect(listAgentUiFlowNames()).toContain('travel-demo');
    expect(listAgentUiFlowNames()).toContain('open-new-trip');
    expect(listAgentUiFlowNames()).toContain('open-new-checklist');
    expect(listAgentUiFlowNames()).toContain('open-home-location');
    expect(listAgentUiFlowNames()).toContain('today-prev-day');
    expect(listAgentUiFlowNames()).toContain('today-next-day');
    expect(listAgentUiFlowNames()).toContain('open-avatar-editor');
    expect(listAgentUiFlowNames()).toContain('open-profile-identity');
    expect(listAgentUiFlowNames()).toContain('open-developer');
    expect(listAgentUiFlowNames()).toContain('profile-usage-analytics');
    expect(listAgentUiFlowNames()).toContain('checklist-demo');
    expect(listAgentUiFlowNames()).toContain('grocery-demo');
    expect(listAgentUiFlowNames()).toContain('health-demo');
    expect(listAgentUiFlowNames()).toContain('vehicle-demo-detail');
    expect(listAgentUiFlowNames()).toContain('plants-demo');
    expect(listAgentUiFlowNames()).toContain('activity-demo-edit');
    expect(listAgentUiFlowNames()).toContain('event-bout-detail');
    expect(listAgentUiFlowNames()).toContain('grocery-demo-recipe-import');
    expect(listAgentUiFlowNames()).toContain('workouts-demo');
    expect(listAgentUiFlowNames()).toContain('vision-board-demo-edit');
    expect(listAgentUiFlowNames()).toContain('vision-board-categories');
    expect(listAgentUiFlowNames()).toContain('profile');
    expect(listAgentUiFlowNames()).toContain('health-settings');
    expect(listAgentUiFlowNames()).toContain('vehicles-new');
    expect(listAgentUiFlowNames()).toContain('workouts');
    const steps = resolveAgentUiFlow('travel-demo-add-flight');
    expect(steps?.[0]).toMatchObject({
      op: 'dismiss',
      prefix: 'ontrack.travel.',
    });
    expect(steps?.[1]).toMatchObject({ op: 'seed', to: 'travel-demo' });
    expect(steps?.some((s) => s.op === 'goto')).toBe(true);
    expect(steps?.some((s) => s.op === 'wait')).toBe(true);
    const addActivity = resolveAgentUiFlow('travel-demo-add-activity');
    expect(addActivity?.[2]).toMatchObject({
      op: 'goto',
      to: `travel/${AGENT_UI_DEMO_TRIP_ID}/add/activity`,
    });
    expect(
      addActivity?.some(
        (s) => s.op === 'wait' && s.prefix === 'ontrack.travel.itineraryAdd.',
      ),
    ).toBe(true);
    expect(resolveAgentUiFlow('travel-demo-hub')).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          op: 'wait',
          id: 'ontrack.travel.planDetail.section.tools',
        }),
        expect.objectContaining({
          op: 'wait',
          id: `ontrack.travel.tripTools.section.${AGENT_UI_DEMO_TRIP_ID}`,
        }),
      ]),
    );
    expect(
      steps?.every(
        (s) => s.op !== 'wait' || s.ms != null || s.timeoutMs === AGENT_UI_WAIT_TIMEOUT_MS,
      ),
    ).toBe(true);
    expect(AGENT_UI_WAIT_TIMEOUT_MS).toBe(2000);
    const workouts = resolveAgentUiFlow('workouts');
    expect(
      workouts?.some(
        (s) => s.op === 'wait' && s.prefix === 'ontrack.workouts.',
      ),
    ).toBe(true);
    expect(resolveAgentUiFlow('missing')).toBeNull();
  });

  it('keeps state-sensitive entry flows deterministic', () => {
    expect(resolveAgentUiFlow('open-new-trip')).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ op: 'seed', to: 'travel-demo' }),
        expect.objectContaining({ op: 'tap', id: 'ontrack.travel.newTrip.open' }),
      ]),
    );
    for (const name of ['today-prev-day', 'today-next-day']) {
      expect(resolveAgentUiFlow(name)).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ op: 'wait', id: 'ontrack.today.nonToday' }),
        ]),
      );
    }
  });

  it('lands Chase roundtrip submit on the expanded outbound passenger row', () => {
    const steps = resolveAgentUiFlow('travel-demo-add-flight-roundtrip');
    expect(steps).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          op: 'tap',
          id: 'ontrack.travel.itineraryAdd.submit',
        }),
        expect.objectContaining({
          op: 'tap',
          id: `ontrack.travel.timelineItem.${AGENT_UI_DEMO_CHASE_OUTBOUND_ID}.default`,
        }),
        expect.objectContaining({
          op: 'wait',
          id: `ontrack.travel.flight.passenger.${AGENT_UI_DEMO_CHASE_OUTBOUND_ID}`,
        }),
      ]),
    );
  });

  it('deep-lands non-travel demo surfaces', () => {
    expect(resolveAgentUiFlow('checklist-demo')).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ op: 'seed', to: 'checklist-demo' }),
        expect.objectContaining({
          op: 'wait',
          id: `ontrack.checklists.detail.task.${AGENT_UI_DEMO_CHECKLIST_TASK_PLAN_ID}`,
        }),
      ]),
    );
    expect(resolveAgentUiFlow('grocery-demo-combined')).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          op: 'tap',
          id: 'ontrack.grocery.detail.view.combined',
        }),
        expect.objectContaining({
          op: 'wait',
          id: 'ontrack.grocery.detail.copy',
        }),
      ]),
    );
    expect(resolveAgentUiFlow('health-demo')).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          op: 'tap',
          id: 'ontrack.health.section.mind',
        }),
        expect.objectContaining({
          op: 'wait',
          id: `ontrack.health.mind.entry.${AGENT_UI_DEMO_HEALTH_MOOD_ID}`,
        }),
      ]),
    );
    expect(resolveAgentUiFlow('vehicle-demo-detail')?.[1]).toMatchObject({
      op: 'goto',
      to: `vehicles/${AGENT_UI_DEMO_VEHICLE_ID}`,
    });
    expect(resolveAgentUiFlow('plants-demo')).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          op: 'wait',
          id: 'ontrack.plants.detail.logWatering',
        }),
      ]),
    );
    expect(resolveAgentUiFlow('grocery-demo-recipe-import')?.[1]).toMatchObject({
      op: 'goto',
      to: `checklists/${AGENT_UI_DEMO_GROCERY_LIST_ID}/recipe-import`,
    });
    expect(resolveAgentUiFlow('activity-demo-edit')?.[1]).toMatchObject({
      op: 'goto',
      to: `activityForm?id=${AGENT_UI_DEMO_ACTIVITY_ID}`,
    });
    expect(resolveAgentUiFlow('event-bout-detail')).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          op: 'goto',
          to: `detail/generic/${AGENT_UI_DEMO_EVENT_ACTIVITY_ID}`,
        }),
        expect.objectContaining({
          op: 'tap',
          id: `ontrack.eventDetail.fightCard.bout.${AGENT_UI_DEMO_EVENT_BOUT_ID}`,
        }),
        expect.objectContaining({
          op: 'wait',
          id: 'ontrack.eventDetail.fightCard.modal',
        }),
      ]),
    );
    expect(resolveAgentUiFlow('activity-form-dismiss')).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          op: 'goto',
          to: 'today',
        }),
        expect.objectContaining({
          op: 'tap',
          id: 'ontrack.today.addActivity',
        }),
        expect.objectContaining({
          op: 'tap',
          id: 'ontrack.activityForm.category.mindfulness',
        }),
        expect.objectContaining({
          op: 'tap',
          id: 'ontrack.activityForm.backdrop',
        }),
      ]),
    );
    expect(resolveAgentUiFlow('workouts-demo')).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          op: 'wait',
          id: `ontrack.workouts.todayPlan.${AGENT_UI_DEMO_WORKOUT_ACTIVITY_ID}`,
        }),
      ]),
    );
    expect(resolveAgentUiFlow('workouts-demo-explore')).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          op: 'wait',
          id: `ontrack.workouts.exercise.${AGENT_UI_DEMO_WORKOUT_CATALOG_EXERCISE_ID}.add`,
        }),
      ]),
    );
    expect(resolveAgentUiFlow('vision-board-demo-edit')).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          op: 'wait',
          id: 'ontrack.vision.category.addAffirmation',
        }),
        expect.objectContaining({
          op: 'wait',
          id: `ontrack.vision.category.canvasItem.${AGENT_UI_DEMO_VISION_ITEM_ID}`,
        }),
      ]),
    );
    expect(resolveAgentUiFlow('grocery-demo-settings')).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          op: 'tap',
          id: 'ontrack.grocery.detail.settings',
        }),
        expect.objectContaining({
          op: 'wait',
          id: 'ontrack.listSettings.name',
        }),
      ]),
    );
    expect(resolveAgentUiFlow('workouts-demo-gym-active')?.[1]).toMatchObject({
      op: 'goto',
      to: `detail/gym-active/${AGENT_UI_DEMO_WORKOUT_ACTIVITY_ID}`,
    });
    expect(resolveAgentUiFlow('workouts-demo-anatomy')).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          op: 'tap',
          id: 'ontrack.workouts.explorer.anatomySex.female',
        }),
        expect.objectContaining({
          op: 'wait',
          id: 'ontrack.workouts.explorer.muscle.chest',
        }),
      ]),
    );
    expect(resolveAgentUiFlow('plants-demo-log-watering')).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          op: 'tap',
          id: 'ontrack.plants.detail.logWatering',
        }),
        expect.objectContaining({
          op: 'wait',
          id: 'ontrack.plants.detail.undoWatering',
        }),
      ]),
    );
    expect(resolveAgentUiFlow('vision-board-demo-item-editor')).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          op: 'tap',
          id: 'ontrack.vision.category.selection.edit',
        }),
        expect.objectContaining({
          op: 'wait',
          id: 'ontrack.vision.itemEditor.primary',
        }),
      ]),
    );
    expect(resolveAgentUiFlow('games-balloon-pop')).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          op: 'tap',
          id: 'ontrack.games.hub.balloonPop',
        }),
        expect.objectContaining({
          op: 'wait',
          id: 'ontrack.games.balloonPop.play',
        }),
      ]),
    );
    expect(resolveAgentUiFlow('vehicles-new')).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          op: 'wait',
          id: 'ontrack.vehicles.new.nickname',
        }),
      ]),
    );
    expect(resolveAgentUiFlow('plants-new')).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          op: 'wait',
          id: 'ontrack.plants.new.camera',
        }),
      ]),
    );
    expect(resolveAgentUiFlow('food-demo')?.[1]).toMatchObject({
      op: 'goto',
      to: 'food',
    });
    expect(resolveAgentUiFlow('food-demo')).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          op: 'wait',
          id: 'ontrack.food.home.section.suggestions',
        }),
      ]),
    );
    expect(resolveAgentUiFlow('food-detail-demo')?.[1]).toMatchObject({
      op: 'goto',
      to: `detail/food/${AGENT_UI_DEMO_FOOD_ACTIVITY_ID}`,
    });
    expect(resolveAgentUiFlow('vehicle-demo-expenses')).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          op: 'tap',
          id: 'ontrack.vehicles.detail.section.expenses',
        }),
        expect.objectContaining({
          op: 'wait',
          id: 'ontrack.vehicles.expenses.amount',
        }),
      ]),
    );
  });

  it('keeps every declared flow executable without discovery dumps', () => {
    const supported = new Set([
      'dismiss', 'seed', 'goto', 'tap', 'wait', 'scroll', 'assert', 'open',
    ]);
    for (const name of listAgentUiFlowNames()) {
      const steps = resolveAgentUiFlow(name);
      expect(steps).toBeTruthy();
      expect(steps?.length).toBeGreaterThan(0);
      expect({ name, hasDump: steps?.some((step) => step.op === 'dump') }).toEqual({ name, hasDump: false });
      expect({ name, supported: steps?.every((step) => supported.has(step.op)) }).toEqual({ name, supported: true });
      expect({
        name,
        bounded: steps?.every(
          (step) => step.op !== 'wait' || Boolean(step.id || step.prefix || step.ms),
        ),
      }).toEqual({ name, bounded: true });
    }
  });
});
