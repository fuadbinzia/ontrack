import { AppStack } from '@/components/navigation/app-stack';

export const unstable_settings = {
  anchor: 'index',
};

export default function FinanceLayout() {
  return (
    <AppStack>
      <AppStack.Screen name="index" />
      <AppStack.Screen name="transactions" />
      <AppStack.Screen name="expense" options={{ presentation: 'modal' }} />
      <AppStack.Screen name="ezpass" />
      <AppStack.Screen name="ezpass-import" />
      <AppStack.Screen name="bills" />
      <AppStack.Screen name="subscriptions" />
      <AppStack.Screen name="buckets" />
      <AppStack.Screen name="entities" />
      <AppStack.Screen name="accounts" />
      <AppStack.Screen name="rewards" />
      <AppStack.Screen name="tax" />
    </AppStack>
  );
}
