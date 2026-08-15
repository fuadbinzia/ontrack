import { AppStack } from '@/components/navigation/app-stack';

export const unstable_settings = {
  anchor: 'index',
};

export default function VisionBoardLayout() {
  return (
    <AppStack>
      <AppStack.Screen name="index" />
      <AppStack.Screen name="all" />
      <AppStack.Screen name="categories" />
      <AppStack.Screen name="[id]" options={{ gestureEnabled: false }} />
    </AppStack>
  );
}
