import { AppStack } from '@/components/navigation/app-stack';
import { useSafeAreaChrome } from '@/components/primitives/safe-area-chrome';
import { travelSafeAreaBackground } from '@/features/travel/travel-surface';
import { FeatureThemeProvider, useTheme } from '@/hooks/use-theme';

export const unstable_settings = {
  anchor: 'index',
};

export default function TravelLayout() {
  return (
    <FeatureThemeProvider feature="travel">
      <TravelStack />
    </FeatureThemeProvider>
  );
}

function TravelStack() {
  const theme = useTheme();
  useSafeAreaChrome(travelSafeAreaBackground(theme));
  return (
    <AppStack
      screenOptions={{
        // Fully transparent — do NOT spread travelPageStyle here.
        // Its experimental_backgroundImage gradient is opaque and covered the
        // AppSafeArea atmosphere photo (only the status-bar sliver remained).
        // Screens that need the wash set style/contentStyle locally
        // (or inherit via TravelPlanDetailBody pageWash below the sky band).
        contentStyle: { backgroundColor: 'transparent' },
      }}
    />
  );
}
