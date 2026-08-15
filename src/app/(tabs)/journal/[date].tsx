import { Redirect, useLocalSearchParams } from 'expo-router';

import { JournalPageScreen } from '@/features/journal/journal-page-screen';
import { isJournalDateKey } from '@/features/journal/model';
import { todayKey } from '@/utils/date';

export default function JournalDateScreen() {
  const { date } = useLocalSearchParams<{ date: string }>();
  if (!isJournalDateKey(date)) {
    return <Redirect href="/(tabs)/journal" />;
  }
  if (date === todayKey()) {
    return <Redirect href="/(tabs)/journal" />;
  }
  return <JournalPageScreen dateKey={date} />;
}
