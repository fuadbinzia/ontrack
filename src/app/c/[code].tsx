import { useLocalSearchParams } from 'expo-router';

import { ChecklistCollaboratorJoinScreen } from '@/features/todos/todo-collaborator-join-screen';

export default function TodoCollaboratorJoinRoute() {
  const { code } = useLocalSearchParams<{ code: string }>();
  return <ChecklistCollaboratorJoinScreen code={code} />;
}
