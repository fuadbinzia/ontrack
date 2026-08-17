import { Redirect, useLocalSearchParams } from 'expo-router';

/** Keep legacy `/todos/:id` links working after list detail moved under the tab. */
export default function ChecklistLegacyRedirect() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <Redirect href={`/(tabs)/to-do/${id}` as never} />;
}
