import type { DateDisplayFormat } from '@/utils/date';

import type { TemperatureUnit } from './types';

/** US date format → °F; otherwise °C (matches preference chrome). */
export function temperatureUnitForDateFormat(
  format: DateDisplayFormat,
): TemperatureUnit {
  return format === 'mdy' ? 'fahrenheit' : 'celsius';
}

export function unitSymbol(unit: TemperatureUnit): string {
  return unit === 'fahrenheit' ? '°F' : '°C';
}
