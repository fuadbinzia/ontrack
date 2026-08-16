/** Today / calendar agent-ui testIDs (composed into agentUiIdsShell). */

export const agentUiIdsShellDaily = {
  today: {
    prevDay: 'ontrack.today.prevDay',
    nextDay: 'ontrack.today.nextDay',
    /** Date title (weekday + long date) → Calendar tab. */
    openCalendar: 'ontrack.today.openCalendar',
    /** State anchor mounted whenever the selected date is not today. */
    nonToday: 'ontrack.today.nonToday',
    weather: 'ontrack.today.weather',
    /** Live GPS weather bar under Home when places differ (Today only). */
    currentLocation: 'ontrack.today.currentLocation',
    /** Layout anchor — only mounted when day completion > 0. */
    progress: 'ontrack.today.progress',
    addActivity: 'ontrack.today.addActivity',
    emptyAddActivity: 'ontrack.today.emptyAddActivity',
    addEvent: 'ontrack.today.addEvent',
    addMeal: 'ontrack.today.addMeal',
    addChecklist: 'ontrack.today.addChecklist',
    addJournal: 'ontrack.today.addJournal',
    addSheet: {
      sheet: 'ontrack.today.addSheet',
      close: 'ontrack.today.addSheet.close',
      field: 'ontrack.today.addSheet.field',
      submit: 'ontrack.today.addSheet.submit',
    },
    /** Static all-day holiday rail — not a timeline activity. */
    holiday: (holidayId: string) => `ontrack.today.holiday.${holidayId}`,
    /** Static all-day user event (birthday, conference, …) — not a timeline card. */
    allDay: (activityId: string) => `ontrack.today.allDay.${activityId}`,
    activity: (activityId: string) => `ontrack.today.activity.${activityId}`,
    activityToggle: (activityId: string) =>
      `ontrack.today.activityToggle.${activityId}`,
    detailClose: (kind: string) => `ontrack.today.detail.${kind}.close`,
    detailBackdrop: (kind: string) => `ontrack.today.detail.${kind}.backdrop`,
  },
  calendar: {
    jumpToday: 'ontrack.calendar.jumpToday',
    prevMonth: 'ontrack.calendar.prevMonth',
    nextMonth: 'ontrack.calendar.nextMonth',
    openDay: 'ontrack.calendar.openDay',
    day: (dateKey: string) => `ontrack.calendar.day.${dateKey}`,
    holiday: (holidayId: string) => `ontrack.calendar.holiday.${holidayId}`,
    allDay: (activityId: string) => `ontrack.calendar.allDay.${activityId}`,
    activity: (activityId: string) => `ontrack.calendar.activity.${activityId}`,
  },
} as const;
