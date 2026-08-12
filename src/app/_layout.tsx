import { Stack, usePathname, useRouter } from 'expo-router';
import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider,
} from 'expo-router/react-navigation';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { lazy, Suspense, useEffect, useMemo } from 'react';
import { View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import {
  initialWindowMetrics,
  SafeAreaProvider,
} from 'react-native-safe-area-context';

import { NavigationSessionSync } from '@/components/navigation/navigation-session-sync';
import { AppPromptHost } from '@/components/primitives/app-prompt';
import { AppSafeArea } from '@/components/primitives/app-safe-area';
import { HeaderBackButton } from '@/components/primitives/back-button';
import { RouteErrorBoundary } from '@/components/primitives/route-error-boundary';
import { ScreenAtmosphere } from '@/components/primitives/screen-atmosphere';
import { motion } from '@/design-system/motion';
import { spacing } from '@/design-system/spacing';
import { AppBootLoader } from '@/features/auth/app-boot-loader';
import {
  AuthSessionProvider,
  useAuthSession,
} from '@/features/auth/auth-provider';
import { withoutGuestDirtyTracking } from '@/features/auth/guest-dirty-tracking';
import { useShouldShowWelcome } from '@/features/auth/welcome-preview';
import {
  TravelAtmosphereProvider,
  useTravelRouteAtmosphere,
} from '@/features/travel/travel-atmosphere';
import { selectTravelAtmospherePlan } from '@/features/travel/travel-atmosphere-model';
import { useApplyOtaUpdate } from '@/hooks/use-apply-ota-update';
import { useAppIsActive } from '@/hooks/use-app-activity';
import { useHydrated } from '@/hooks/use-hydrated';
import { useMealPhotoMigration } from '@/hooks/use-meal-photo-migration';
import { useRootStartupEffects } from '@/hooks/use-root-startup-effects';
import { useTheme } from '@/hooks/use-theme';
import { useTodoCollaboration } from '@/hooks/use-todo-collaboration';
import { useVehicleCollaboration } from '@/hooks/use-vehicle-collaboration';
import { useAuthAccess } from '@/store/auth-access';
import { useAccountFlags } from '@/store/account-flags';
import { usePreferences } from '@/store/preferences';
import { useSchedule } from '@/store/schedule';
import { useTravel } from '@/store/travel';
import { AgentUiFabRestoreHost } from '@/utils/agent-ui/AgentUiFabRestoreHost';
import { AgentUiOverlay } from '@/utils/agent-ui/AgentUiOverlay';
import { AgentUiRouteSync } from '@/utils/agent-ui/AgentUiRouteSync';
import { todayKey } from '@/utils/date';
import { ThemeToggleFab, ThemeToggleFabHost } from '@/utils/dev-theme-toggle';

/** Expo Router catches render failures so the app never sticks on a blank white view. */
export { RouteErrorBoundary as ErrorBoundary };

void SplashScreen.preventAutoHideAsync().catch(() => undefined);

const LazyPerformanceMonitorProvider = lazy(() =>
  import('@/features/performance/performance-monitor-provider').then(
    (module) => ({ default: module.PerformanceMonitorProvider }),
  ),
);
const LazyUsageAnalyticsTracker = lazy(() =>
  import('@/features/analytics/usage-analytics-tracker').then((module) => ({
    default: module.UsageAnalyticsTracker,
  })),
);

function PerformanceMonitorMount() {
  const enabled = useAccountFlags((state) => state.developerTools);
  if (!enabled) return null;
  return (
    <Suspense fallback={null}>
      <LazyPerformanceMonitorProvider />
    </Suspense>
  );
}

export default function RootLayout() {
  useApplyOtaUpdate();
  const appIsActive = useAppIsActive();
  const theme = useTheme();
  const hydrated = useHydrated();
  const pathname = usePathname();
  const travelRoute = pathname === '/travel' || pathname.startsWith('/travel/');
  const plans = useTravel((state) => state.plans);
  const dateDisplayFormat = usePreferences((state) => state.dateDisplayFormat);
  const refreshDateLocale = usePreferences((state) => state.refreshDateLocale);
  useEffect(() => {
    if (appIsActive) refreshDateLocale();
  }, [appIsActive, refreshDateLocale]);
  const atmospherePlan = selectTravelAtmospherePlan(
    plans,
    pathname,
    todayKey(),
  );
  const atmosphere = useTravelRouteAtmosphere(
    atmospherePlan?.destination,
    dateDisplayFormat,
    travelRoute && hydrated && appIsActive,
  );

  // Keep navigator chrome transparent so AppSafeArea washes (Travel atmosphere,
  // Today time-of-day) continue under the status bar without a hairline seam
  // from React Navigation's default rgb(242,242,242) screen fill.
  const navigationTheme = useMemo(() => {
    const base = theme.name === 'dark' ? DarkTheme : DefaultTheme;
    return {
      ...base,
      colors: {
        ...base.colors,
        background: 'transparent',
      },
    };
  }, [theme.name]);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider initialMetrics={initialWindowMetrics}>
        <ThemeProvider value={navigationTheme}>
          <StatusBar style={theme.name === 'dark' ? 'light' : 'dark'} />
          <TravelAtmosphereProvider atmosphere={atmosphere}>
            <AppSafeArea>
              <AuthSessionProvider hydrated={hydrated}>
                <PerformanceMonitorMount />
                <RootNavigator hydrated={hydrated} pathname={pathname} />
                <AppPromptHost />
              </AuthSessionProvider>
            </AppSafeArea>
          </TravelAtmosphereProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

/** Privacy / Terms: glass chrome + back dismisses to Profile (not `/` / Today). */
function legalDocumentScreenOptions(title: string) {
  const back = <HeaderBackButton fallback="/(tabs)/profile" />;
  return {
    title,
    headerStyle: { backgroundColor: 'transparent' as const },
    contentStyle: { backgroundColor: 'transparent' as const },
    ...(process.env.EXPO_OS === 'ios'
      ? {
          unstable_headerLeftItems: () => [
            {
              type: 'custom' as const,
              element: back,
              hidesSharedBackground: true,
            },
          ],
        }
      : { headerLeft: () => back }),
  };
}

function pathIsWithin(pathname: string, roots: readonly string[]): boolean {
  return roots.some(
    (root) => pathname === root || pathname.startsWith(`${root}/`),
  );
}

function RootNavigator({
  hydrated,
  pathname,
}: {
  hydrated: boolean;
  pathname: string;
}) {
  const theme = useTheme();
  const router = useRouter();
  const { phase } = useAuthSession();
  const seedIfNeeded = useSchedule((state) => state.seedIfNeeded);
  const aiEnabled = usePreferences((state) => state.aiEnabled);
  const hasOnboarded = usePreferences((state) => state.hasOnboarded);
  // Guest upgrade (`authenticating`) must not keep the full app shell open —
  // only settled guest / authenticated phases get app routes.
  const appAccess = phase === 'authenticated' || phase === 'guest';
  // `locked` is the cold-start sign-in gate: same route, re-authentication copy.
  // First-run canvas covers signed-out + guest/auth who still need name/goal.
  const showWelcome = useShouldShowWelcome(hasOnboarded);
  const appIsActive = useAppIsActive();
  const welcomeAccess =
    phase === 'welcome' ||
    phase === 'authenticating' ||
    phase === 'error' ||
    phase === 'locked' ||
    ((phase === 'guest' || phase === 'authenticated') && showWelcome);
  const collaborationReady =
    hydrated && phase === 'authenticated' && appIsActive;
  useTodoCollaboration(
    collaborationReady &&
      pathIsWithin(pathname, [
        '/to-do',
        '/todos',
        '/todo-collaborators',
        '/todo-invites',
      ]),
  );
  useVehicleCollaboration(
    collaborationReady && pathIsWithin(pathname, ['/vehicles', '/v']),
  );
  useRootStartupEffects({
    hydrated,
    appAccess,
    hasOnboarded,
    phase,
    router,
  });

  useEffect(() => {
    if (phase !== 'authenticated') return;
    const returnTo = useAuthAccess.getState().takeAuthReturnTo();
    if (returnTo) router.replace(returnTo as never);
  }, [phase, router]);

  useEffect(() => {
    if (!hydrated || !appAccess) return;
    withoutGuestDirtyTracking(seedIfNeeded);
    void import('@/features/food/food-seed').then(({ seedFoodIfNeeded }) => {
      withoutGuestDirtyTracking(seedFoodIfNeeded);
    });
  }, [appAccess, hydrated, seedIfNeeded]);

  useMealPhotoMigration(hydrated && appAccess && aiEnabled);

  if (!hydrated || phase === 'loading') {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ScreenAtmosphere />
        <AppBootLoader />
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <AgentUiRouteSync />
      <NavigationSessionSync />
      <Suspense fallback={null}>
        <LazyUsageAnalyticsTracker />
      </Suspense>
      <AgentUiFabRestoreHost>
        <ThemeToggleFabHost>
          <Stack
            screenOptions={{
              orientation: 'portrait',
              headerShown: true,
              headerTitle: '',
              headerShadowVisible: false,
              headerStyle: { backgroundColor: theme.backgroundPrimary },
              // Prefer continuous native push over hard cuts; Android fades in
              // from below so material transitions don’t snap.
              animation:
                process.env.EXPO_OS === 'android'
                  ? 'fade_from_bottom'
                  : 'default',
              animationDuration: motion.page,
              ...(process.env.EXPO_OS === 'ios'
                ? {
                    unstable_headerLeftItems: () => [
                      {
                        type: 'custom' as const,
                        element: <HeaderBackButton />,
                        hidesSharedBackground: true,
                      },
                    ],
                  }
                : { headerLeft: () => <HeaderBackButton /> }),
              contentStyle: {
                backgroundColor: theme.backgroundPrimary,
                paddingTop: spacing.md,
              },
            }}
          >
            <Stack.Protected guard={welcomeAccess}>
              <Stack.Screen
                name="welcome"
                options={{
                  animation: 'fade',
                  headerShown: false,
                  contentStyle: { backgroundColor: 'transparent' },
                }}
              />
            </Stack.Protected>
            <Stack.Protected guard={phase === 'resolving-data'}>
              <Stack.Screen
                name="auth/data-choice"
                options={{
                  animation: 'fade',
                  headerShown: false,
                  gestureEnabled: false,
                  contentStyle: { backgroundColor: 'transparent' },
                }}
              />
            </Stack.Protected>
            <Stack.Protected guard={appAccess}>
              <Stack.Screen
                name="(tabs)"
                options={{
                  headerShown: false,
                  // Tab carousel is the app root — iOS edge-swipe must not dispatch
                  // GO_BACK (empty stack → LogBox toast on Travel / other tabs).
                  gestureEnabled: false,
                  // Transparent so Travel’s AppSafeArea chrome atmosphere can paint
                  // continuously under the status bar without a seam at the inset.
                  // Tab screens still fill with their own Screen backgrounds.
                  contentStyle: { backgroundColor: 'transparent' },
                }}
              />
              <Stack.Screen
                name="onboarding"
                options={{
                  animation: 'fade',
                  headerShown: false,
                  contentStyle: { backgroundColor: 'transparent' },
                }}
              />
              <Stack.Screen
                name="account"
                options={{
                  headerShown: false,
                  contentStyle: { backgroundColor: 'transparent' },
                }}
              />
              <Stack.Screen
                name="travel-map"
                options={{
                  headerShown: false,
                  orientation: 'all',
                  contentStyle: {
                    backgroundColor: 'transparent',
                    paddingTop: 0,
                  },
                }}
              />
              <Stack.Screen
                name="vision-board/category-editor"
                options={{ presentation: 'modal' }}
              />
              <Stack.Screen
                name="vision-board/item-editor"
                options={{ presentation: 'modal' }}
              />
              {/* Legacy path redirects → nested tab stacks (bottom nav persists). */}
              <Stack.Screen name="agents" options={{ headerShown: false }} />
              <Stack.Screen
                name="design-system"
                options={{ headerShown: false }}
              />
              <Stack.Screen name="api-usage" options={{ headerShown: false }} />
              <Stack.Screen
                name="integrations"
                options={{ headerShown: false }}
              />
              <Stack.Screen name="developer" options={{ headerShown: false }} />
              <Stack.Screen
                name="nutrition-profile"
                options={{ headerShown: false }}
              />
              <Stack.Screen
                name="todos/[id]"
                options={{ headerShown: false }}
              />
              <Stack.Screen
                name="todos/[id]/settings"
                options={{ headerShown: false }}
              />
              <Stack.Screen
                name="todos/[id]/recipe-import"
                options={{ headerShown: false }}
              />
              <Stack.Screen name="todo-collaborators" />
              <Stack.Screen name="todo-invites" />
              <Stack.Screen name="invite/travel" />
              <Stack.Screen
                name="activity-form"
                options={{
                  presentation: 'modal',
                  // In-content swipe grabber — hide native header so it can't
                  // sit under the full-bleed ScrollView and eat taps / chrome.
                  headerShown: false,
                  contentStyle: {
                    backgroundColor: 'transparent',
                    paddingTop: 0,
                  },
                }}
              />
              <Stack.Screen
                name="detail/gym-active/[id]"
                options={{
                  presentation: 'fullScreenModal',
                  gestureEnabled: false,
                }}
              />
              <Stack.Screen
                name="games/balloon-pop"
                options={{
                  headerShown: false,
                  animation: 'slide_from_bottom',
                  contentStyle: { backgroundColor: 'transparent' },
                }}
              />
            </Stack.Protected>
            <Stack.Protected guard={appAccess && hasOnboarded}>
              <Stack.Screen
                name="share-import"
                options={{ gestureEnabled: false }}
              />
              <Stack.Screen
                name="share-event"
                options={{ gestureEnabled: false }}
              />
            </Stack.Protected>
            <Stack.Screen
              name="auth/callback"
              options={{
                animation: 'fade',
                headerShown: false,
                contentStyle: { backgroundColor: 'transparent' },
              }}
            />
            <Stack.Screen name="i/[code]" />
            <Stack.Screen name="j/[code]" />
            <Stack.Screen name="f/[code]" />
            <Stack.Screen name="l/[code]" />
            <Stack.Screen name="c/[code]" />
            <Stack.Screen name="v/[code]" />
            <Stack.Screen
              name="privacy"
              options={legalDocumentScreenOptions('Privacy Policy')}
            />
            <Stack.Screen
              name="terms"
              options={legalDocumentScreenOptions('Terms of Use')}
            />
            <Stack.Screen
              name="agent/ui"
              options={{
                headerShown: false,
                animation: 'none',
                gestureEnabled: false,
                contentStyle: { backgroundColor: 'transparent' },
              }}
            />
          </Stack>
        </ThemeToggleFabHost>
      </AgentUiFabRestoreHost>
      {/* After Stack inside flex:1 so absolute overlay covers the window. */}
      <AgentUiOverlay />
      <ThemeToggleFab />
    </View>
  );
}
