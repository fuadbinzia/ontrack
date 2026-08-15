import { todayKey } from '@/utils/date';

import { JournalPageScreen } from './journal-page-screen';

export function JournalHub() {
  return <JournalPageScreen dateKey={todayKey()} showEarlier />;
}
