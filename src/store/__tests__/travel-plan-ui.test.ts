import {
  normalizeTravelPlanUiPrefs,
  useTravelPlanUi,
} from '@/store/travel-plan-ui';

describe('travel plan UI prefs', () => {
  beforeEach(() => {
    useTravelPlanUi.setState({ byPlanId: {} });
  });

  it('normalizes section and day collapse payloads', () => {
    expect(
      normalizeTravelPlanUiPrefs({
        sectionExpanded: {
          tools: false,
          timeline: true,
          bogus: true,
          flights: 'yes',
        },
        minimizedItemIds: ['a', 'a', '', 12, 'b'],
        collapsedDayDates: ['2026-08-01', '2026-08-01'],
        dayCollapseTouched: ['2026-08-01'],
        notesExpanded: false,
      }),
    ).toEqual({
      sectionExpanded: { timeline: true },
      minimizedItemIds: ['a', 'b'],
      collapsedDayDates: ['2026-08-01'],
      dayCollapseTouched: ['2026-08-01'],
      notesExpanded: false,
    });
  });

  it('patches and clears per-plan prefs', () => {
    const { patchPlanUi, clearPlanUi, retainPlanIds } = useTravelPlanUi.getState();
    patchPlanUi('trip-1', {
      sectionExpanded: { timeline: false },
      notesExpanded: false,
    });
    patchPlanUi('trip-2', { notesExpanded: true });
    expect(useTravelPlanUi.getState().byPlanId['trip-1']).toEqual({
      sectionExpanded: { timeline: false },
      notesExpanded: false,
    });

    clearPlanUi('trip-1');
    expect(useTravelPlanUi.getState().byPlanId['trip-1']).toBeUndefined();
    expect(useTravelPlanUi.getState().byPlanId['trip-2']).toEqual({
      notesExpanded: true,
    });

    retainPlanIds(['trip-missing']);
    expect(useTravelPlanUi.getState().byPlanId).toEqual({});
  });
});
