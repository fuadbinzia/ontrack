import { AppStack } from '@/components/navigation/app-stack';

export const unstable_settings = {
  anchor: 'index',
};

const CALENDAR_DETAIL_SHEET_ROUTES = [
  'detail/food/[id]',
  'detail/generic/[id]',
  'detail/gym/[id]',
  'detail/movie/[id]',
  'detail/plant/[id]',
  'detail/sleep/[id]',
  'detail/work/[id]',
] as const;

export default function TodayTabLayout() {
  return (
    <AppStack
      screenOptions={{
        contentStyle: { backgroundColor: 'transparent' },
      }}>
      <AppStack.Screen name="index" />
      {CALENDAR_DETAIL_SHEET_ROUTES.map((name) => (
        <AppStack.Screen
          key={name}
          name={name}
          options={{
            // SheetScaffold owns the glass plate, backdrop, and pan-down gesture.
            presentation: 'transparentModal',
            animation: 'none',
            gestureEnabled: false,
            contentStyle: {
              backgroundColor: 'transparent',
              paddingTop: 0,
            },
          }}
        />
      ))}
    </AppStack>
  );
}
