/** Today / calendar agent-ui testIDs (composed into agentUiIdsShell). */

export const agentUiIdsShellDaily = {
  today: {
    prevDay: 'ontrack.today.prevDay',
    nextDay: 'ontrack.today.nextDay',
    weather: 'ontrack.today.weather',
    /** Live GPS weather bar under Home when places differ (Today only). */
    currentLocation: 'ontrack.today.currentLocation',
    /** Layout anchor — only mounted when day completion > 0. */
    progress: 'ontrack.today.progress',
    addActivity: 'ontrack.today.addActivity',
    emptyAddActivity: 'ontrack.today.emptyAddActivity',
    activity: (activityId: string) => `ontrack.today.activity.${activityId}`,
    activityToggle: (activityId: string) =>
      `ontrack.today.activityToggle.${activityId}`,
  },
  calendar: {
    jumpToday: 'ontrack.calendar.jumpToday',
    prevMonth: 'ontrack.calendar.prevMonth',
    nextMonth: 'ontrack.calendar.nextMonth',
    openDay: 'ontrack.calendar.openDay',
    day: (dateKey: string) => `ontrack.calendar.day.${dateKey}`,
  },
} as const;
