import type { CalendarHoliday } from './holidays';

export type HolidayMarkId =
  | 'blossom'
  | 'burst-star'
  | 'calendar'
  | 'champagne'
  | 'christmas-tree'
  | 'columns'
  | 'cross'
  | 'crown'
  | 'egg'
  | 'fireworks'
  | 'gift'
  | 'hammer'
  | 'heart'
  | 'maple'
  | 'medal'
  | 'party'
  | 'people'
  | 'poppy'
  | 'pumpkin'
  | 'shamrock'
  | 'southern-cross'
  | 'sun'
  | 'tie'
  | 'turkey';

const HOLIDAY_MARKS: Record<string, HolidayMarkId> = {
  'new-years-day': 'party',
  'new-years-eve': 'champagne',
  'christmas-day': 'christmas-tree',
  'christmas-eve': 'christmas-tree',
  'boxing-day': 'gift',
  'valentines-day': 'heart',
  'mothers-day': 'blossom',
  'fathers-day': 'tie',
  'st-patricks-day': 'shamrock',
  easter: 'egg',
  'easter-monday': 'egg',
  'good-friday': 'cross',
  'mlk-day': 'people',
  'presidents-day': 'columns',
  juneteenth: 'burst-star',
  'independence-day': 'fireworks',
  'canada-day': 'maple',
  'australia-day': 'southern-cross',
  'memorial-day': 'poppy',
  'veterans-day': 'medal',
  'remembrance-day': 'poppy',
  'anzac-day': 'poppy',
  'labor-day': 'hammer',
  'labour-day': 'hammer',
  'indigenous-peoples-day': 'sun',
  halloween: 'pumpkin',
  thanksgiving: 'turkey',
  'victoria-day': 'crown',
  'kings-birthday': 'crown',
  'early-may-bank': 'blossom',
  'spring-bank': 'blossom',
  'summer-bank': 'sun',
};

/** Observance silhouette — not a borrowed SF/Material stand-in. */
export function holidayMark(
  holiday: string | Pick<CalendarHoliday, 'slug'>,
): HolidayMarkId {
  const slug = typeof holiday === 'string' ? holiday : holiday.slug;
  return HOLIDAY_MARKS[slug] ?? 'calendar';
}
