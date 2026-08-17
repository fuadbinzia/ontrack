import { useLocalSearchParams } from 'expo-router';

import { ChecklistJoinScreen } from '@/features/todos/todo-join-screen';

export default function TodoJoinRoute() {
  const { code } = useLocalSearchParams<{ code: string }>();
  return <ChecklistJoinScreen code={code} />;
}
