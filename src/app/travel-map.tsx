import { TravelMapScreen } from '@/features/travel/map/travel-map-screen';
import { FeatureThemeProvider } from '@/hooks/use-theme';

export default function TravelMapRoute() {
  return (
    <FeatureThemeProvider feature="travel">
      <TravelMapScreen />
    </FeatureThemeProvider>
  );
}
