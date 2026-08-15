import { usePathname, useRouter } from 'expo-router';
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

import { AppStack } from '@/components/navigation/app-stack';
import { NavigationSessionSync } from '@/components/navigation/navigation-session-sync';
import { AppPromptHost } from '@/components/primitives/app-prompt';
import { AppSafeArea } from '@/components/primitives/app-safe-area';
import { HeaderBackButton } from '@/components/primitives/back-button';
import { RouteErrorBoundary } from '@/components/primitives/route-error-boundary';
import { ScreenAtmosphere } from '@/components/primitives/screen-atmosphere';
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
    appIsActive,
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
          <AppStack
            screenOptions={{
              orientation: 'portrait',
              headerShown: true,
              headerTitle: '',
              headerShadowVisible: false,
              headerStyle: { backgroundColor: theme.backgroundPrimary },
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
            <AppStack.Protected guard={welcomeAccess}>
              <AppStack.Screen
                name="welcome"
                options={{
                  animation: 'fade',
                  headerShown: false,
                  contentStyle: { backgroundColor: 'transparent' },
                }}
              />
            </AppStack.Protected>
            <AppStack.Protected guard={phase === 'resolving-data'}>
              <AppStack.Screen
                name="auth/data-choice"
                options={{
                  animation: 'fade',
                  headerShown: false,
                  gestureEnabled: false,
                  contentStyle: { backgroundColor: 'transparent' },
                }}
              />
            </AppStack.Protected>
            <AppStack.Protected guard={appAccess}>
              <AppStack.Screen
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
              <AppStack.Screen
                name="onboarding"
                options={{
                  animation: 'fade',
                  headerShown: false,
                  contentStyle: { backgroundColor: 'transparent' },
                }}
              />
              <AppStack.Screen
                name="account"
                options={{
                  headerShown: false,
                  contentStyle: { backgroundColor: 'transparent' },
                }}
              />
              <AppStack.Screen
                name="travel-map"
                options={{
                  headerShown: false,
                  orientation: 'all',
                  gestureEnabled: false,
                  contentStyle: {
                    backgroundColor: 'transparent',
                    paddingTop: 0,
                  },
                }}
              />
              <AppStack.Screen
                name="vision-board/category-editor"
                options={{ presentation: 'modal' }}
              />
              <AppStack.Screen
                name="vision-board/item-editor"
                options={{ presentation: 'modal' }}
              />
              {/* Legacy path redirects → nested tab stacks (bottom nav persists). */}
              <AppStack.Screen name="agents" options={{ headerShown: false }} />
              <AppStack.Screen
                name="design-system"
                options={{ headerShown: false }}
              />
              <AppStack.Screen name="api-usage" options={{ headerShown: false }} />
              <AppStack.Screen
                name="integrations"
                options={{ headerShown: false }}
              />
              <AppStack.Screen name="developer" options={{ headerShown: false }} />
              <AppStack.Screen
                name="nutrition-profile"
                options={{ headerShown: false }}
              />
              <AppStack.Screen
                name="todos/[id]"
                options={{ headerShown: false }}
              />
              <AppStack.Screen
                name="todos/[id]/settings"
                options={{ headerShown: false }}
              />
              <AppStack.Screen
                name="todos/[id]/recipe-import"
                options={{ headerShown: false }}
              />
              <AppStack.Screen name="todo-collaborators" />
              <AppStack.Screen name="todo-invites" />
              <AppStack.Screen name="invite/travel" />
              <AppStack.Screen
                name="activity-form"
                options={{
                  // SheetScaffold owns the backdrop and pan-down gesture so
                  // dismissal stays identical across fresh and warm bundles.
                  presentation: 'transparentModal',
                  animation: 'none',
                  gestureEnabled: false,
                  headerShown: false,
                  contentStyle: {
                    backgroundColor: 'transparent',
                    paddingTop: 0,
                  },
                }}
              />
              <AppStack.Screen
                name="detail/gym-active/[id]"
                options={{
                  presentation: 'fullScreenModal',
                  gestureEnabled: false,
                }}
              />
              <AppStack.Screen
                name="games/balloon-pop"
                options={{
                  headerShown: false,
                  animation: 'slide_from_bottom',
                  contentStyle: { backgroundColor: 'transparent' },
                }}
              />
            </AppStack.Protected>
            <AppStack.Protected guard={appAccess && hasOnboarded}>
              <AppStack.Screen
                name="share-import"
                options={{ gestureEnabled: false }}
              />
              <AppStack.Screen
                name="share-event"
                options={{ gestureEnabled: false }}
              />
            </AppStack.Protected>
            <AppStack.Screen
              name="auth/callback"
              options={{
                animation: 'fade',
                headerShown: false,
                contentStyle: { backgroundColor: 'transparent' },
              }}
            />
            <AppStack.Screen name="i/[code]" />
            <AppStack.Screen name="j/[code]" />
            <AppStack.Screen name="f/[code]" />
            <AppStack.Screen name="l/[code]" />
            <AppStack.Screen name="c/[code]" />
            <AppStack.Screen name="v/[code]" />
            <AppStack.Screen
              name="privacy"
              options={legalDocumentScreenOptions('Privacy Policy')}
            />
            <AppStack.Screen
              name="terms"
              options={legalDocumentScreenOptions('Terms of Use')}
            />
            <AppStack.Screen
              name="agent/ui"
              options={{
                headerShown: false,
                animation: 'none',
                gestureEnabled: false,
                contentStyle: { backgroundColor: 'transparent' },
              }}
            />
          </AppStack>
        </ThemeToggleFabHost>
      </AgentUiFabRestoreHost>
      {/* After Stack inside flex:1 so absolute overlay covers the window. */}
      <AgentUiOverlay />
      <ThemeToggleFab />
    </View>
  );
}
