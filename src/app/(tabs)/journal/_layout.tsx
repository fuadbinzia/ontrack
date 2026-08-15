import { AppStack } from '@/components/navigation/app-stack';

export const unstable_settings = {
  anchor: 'index',
};

export default function JournalLayout() {
  return (
    <AppStack>
      <AppStack.Screen name="index" />
      <AppStack.Screen name="[date]" />
    </AppStack>
  );
}
