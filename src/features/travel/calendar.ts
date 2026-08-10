import type { ActivityDraft } from '@/store/schedule';
import { addDays } from '@/utils/date';

import { formatFlightRouteLabel } from './flight-route-label';
import type { TravelItemKind, TravelPlan } from './types';

const ITEM_ICON: Record<Exclude<TravelItemKind, 'moment'>, string> = {
  flight: '✈️',
  transport: '🧭',
  stay: '🛏️',
  activity: '📍',
  rental: '🚗',
  event: '🎟️',
};

const PLAN_ICON: Record<NonNullable<TravelPlan['mode']>, string> = {
  flight: '✈️',
  road: '🚗',
  train: '🚆',
  bus: '🚌',
  ferry: '⛴️',
  transit: '🚇',
  mixed: '🧭',
  other: '🧳',
};

const TRANSPORT_ICON: Record<NonNullable<TravelPlan['itinerary'][number]['transport']>['mode'], string> = {
  driving: '🚗',
  train: '🚆',
  bus: '🚌',
  subway: '🚇',
  tram: '🚊',
  ferry: '⛴️',
  rideshare: '🚙',
  taxi: '🚕',
  shuttle: '🚐',
  other: '🧭',
};

export function isTravelPlanOnCalendar(
  activities: readonly Pick<ActivityDraft, 'travelPlanId'>[],
  planId: string,
): boolean {
  return activities.some((activity) => activity.travelPlanId === planId);
}

export function travelCalendarDrafts(plan: TravelPlan): ActivityDraft[] {
  const overviews: ActivityDraft[] = [];
  const tripIcon = PLAN_ICON[plan.mode ?? 'flight'];
  let dayNumber = 1;
  for (let date = plan.startDate; date <= plan.endDate; date = addDays(date, 1)) {
    overviews.push({
      date,
      title: `${tripIcon} Day ${dayNumber} · ${plan.title}`,
      categoryId: 'personal',
      startMinutes: 9 * 60,
      durationMinutes: 60,
      travelPlanId: plan.id,
      notes: [
        `${plan.destination} · ${plan.startDate} to ${plan.endDate}`,
        plan.notes,
      ]
        .filter(Boolean)
        .join('\n'),
    });
    dayNumber += 1;
  }

  return [
    ...overviews,
    ...plan.itinerary.flatMap((item) => {
      if (item.kind === 'moment') return [];
      const icon = ITEM_ICON[item.kind];
      if (item.kind === 'transport' && item.transport) {
        const transport = item.transport;
        const modeIcon = TRANSPORT_ICON[transport.mode];
        const route = `${transport.origin} → ${transport.destination}`;
        const commonNotes = [
          plan.title,
          route,
          [transport.operator, transport.serviceNumber].filter(Boolean).join(' · '),
          item.details,
          item.bookingUrl,
        ].filter(Boolean).join('\n');
        return [
          {
            date: item.date,
            title: `${modeIcon} Depart · ${item.title}`,
            categoryId: 'personal' as const,
            startMinutes: item.startMinutes,
            durationMinutes: Math.max(15, item.durationMinutes),
            travelPlanId: plan.id,
            travelItemId: item.id,
            notes: commonNotes,
          },
          ...(transport.stops ?? []).flatMap((stop) =>
            stop.arrivalDate && stop.arrivalMinutes !== undefined
              ? [{
                  date: stop.arrivalDate,
                  title: `📍 Stop · ${stop.name}`,
                  categoryId: 'personal' as const,
                  startMinutes: stop.arrivalMinutes,
                  durationMinutes: 15,
                  travelPlanId: plan.id,
                  travelItemId: item.id,
                  notes: [route, stop.address, stop.notes].filter(Boolean).join('\n'),
                }]
              : [],
          ),
          {
            date: transport.arrivalDate,
            title: `${modeIcon} Arrive · ${transport.destination}`,
            categoryId: 'personal' as const,
            startMinutes: transport.arrivalMinutes,
            durationMinutes: 15,
            travelPlanId: plan.id,
            travelItemId: item.id,
            notes: commonNotes,
          },
        ];
      }
      const flightRoute = item.flight
        ? formatFlightRouteLabel(item.flight)
        : undefined;
      const flightNumber = item.flight
        ? [item.flight.airline, item.flight.flightNumber].filter(Boolean).join(' · ')
        : undefined;
      const confirmation = item.flight?.confirmationCode
        ? `Confirmation: ${item.flight.confirmationCode}`
        : undefined;
      const seat = item.flight?.seat ? `Seat: ${item.flight.seat}` : undefined;
      return [
        {
          date: item.date,
          title: `${icon} ${item.title}`,
          categoryId: 'personal' as const,
          startMinutes: item.startMinutes,
          durationMinutes: item.durationMinutes,
          travelPlanId: plan.id,
          travelItemId: item.id,
          notes: [
            plan.title,
            plan.destination,
            flightRoute,
            flightNumber,
            confirmation,
            seat,
            item.details,
            item.bookingUrl,
          ]
            .filter(Boolean)
            .join('\n'),
        },
      ];
    }),
  ];
}
