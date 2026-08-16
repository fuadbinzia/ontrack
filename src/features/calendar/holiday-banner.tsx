import { AllDayBanner } from './all-day-banner';
import { HolidayMark } from './holiday-mark';
import type { CalendarHoliday } from './holidays';

interface HolidayBannerProps {
  holiday: CalendarHoliday;
  testID: string;
}

/** Holiday entry on the shared all-day rail. */
export function HolidayBanner({ holiday, testID }: HolidayBannerProps) {
  return (
    <AllDayBanner
      title={holiday.name}
      caption="Holiday"
      iconNode={<HolidayMark slug={holiday.slug} />}
      testID={testID}
    />
  );
}
