import { usePathname } from 'expo-router';
import { useEffect, useRef } from 'react';
import { AppState, type AppStateStatus } from 'react-native';

import { removeRuntimeActivity, setRuntimeActivity } from '@/features/performance/runtime-activity';
import {
  resolveAnalyticsSurface,
  type AnalyticsSurface,
} from '@/services/analytics/surfaces';
import { canonicalizeAnalyticsRoute } from '@/services/analytics/flow-model';
import { flushFlowAnalytics } from '@/services/analytics/flow-transport';
import { flushUsageAnalytics } from '@/services/analytics/sync';
import { useAuthSession } from '@/features/auth/auth-provider';
import { useFlowAnalytics } from '@/store/flow-analytics';
import { usePreferences } from '@/store/preferences';
import { useUsageAnalytics } from '@/store/usage-analytics';

/**
 * Records coarse surface dwell + sessions when usage analytics is enabled.
 * Never records Health note text or other content payloads.
 */
export function UsageAnalyticsTracker() {
  const pathname = usePathname();
  const enabled = usePreferences((s) => s.usageAnalyticsEnabled);
  const { phase } = useAuthSession();
  const surface = resolveAnalyticsSurface(pathname);
  const route = canonicalizeAnalyticsRoute(pathname);
  const activeRef = useRef<{ surface: AnalyticsSurface; startedAt: number } | null>(null);
  const sessionOpenRef = useRef(false);

  useEffect(() => {
    useUsageAnalytics.getState().ensureInstallId();
  }, []);

  useEffect(() => {
    if (!enabled) return;
    setRuntimeActivity(
      { id: 'system.usageAnalytics', label: 'Usage analytics', category: 'system' },
      { status: 'running', detail: 'Local surface timing' },
    );
    return () => removeRuntimeActivity('system.usageAnalytics');
  }, [enabled]);

  useEffect(() => {
    if (!enabled) {
      activeRef.current = null;
      useFlowAnalytics.getState().reset();
      return;
    }

    const flowStore = useFlowAnalytics.getState();
    const fromRoute = flowStore.session?.currentRoute;
    flowStore.visitRoute(route);
    const routeCommittedAt = performance.now();
    let secondFrame = 0;
    const firstFrame = requestAnimationFrame(() => {
      secondFrame = requestAnimationFrame(() => {
        useFlowAnalytics.getState().recordPageLoad(
          route,
          fromRoute && fromRoute !== route ? fromRoute : undefined,
          performance.now() - routeCommittedAt,
        );
      });
    });

    const closeSurface = () => {
      const current = activeRef.current;
      if (!current) return;
      const elapsed = Date.now() - current.startedAt;
      activeRef.current = null;
      useUsageAnalytics.getState().recordActiveMs(current.surface, elapsed);
    };

    const openSurface = (next: AnalyticsSurface) => {
      closeSurface();
      activeRef.current = { surface: next, startedAt: Date.now() };
    };

    if (!sessionOpenRef.current) {
      sessionOpenRef.current = true;
      useUsageAnalytics.getState().recordSessionStart();
    }
    openSurface(surface);

    const onAppState = (state: AppStateStatus) => {
      if (state === 'active') {
        if (!sessionOpenRef.current) {
          sessionOpenRef.current = true;
          useUsageAnalytics.getState().recordSessionStart();
        }
        openSurface(resolveAnalyticsSurface(pathname));
        useFlowAnalytics.getState().visitRoute(canonicalizeAnalyticsRoute(pathname));
        return;
      }
      closeSurface();
      useFlowAnalytics.getState().endSession();
      sessionOpenRef.current = false;
      if (phase === 'authenticated') {
        void flushUsageAnalytics().catch(() => undefined);
      }
      void flushFlowAnalytics().catch(() => undefined);
    };

    const sub = AppState.addEventListener('change', onAppState);
    return () => {
      cancelAnimationFrame(firstFrame);
      if (secondFrame) cancelAnimationFrame(secondFrame);
      closeSurface();
      sub.remove();
    };
  }, [enabled, pathname, phase, route, surface]);

  useEffect(() => {
    if (!enabled) return;
    const timer = setInterval(() => {
      useFlowAnalytics.getState().heartbeat();
      void flushFlowAnalytics().catch(() => undefined);
    }, 20_000);
    return () => clearInterval(timer);
  }, [enabled]);

  useEffect(() => {
    if (!enabled || phase !== 'authenticated') return;
    const timer = setTimeout(() => {
      void flushUsageAnalytics().catch(() => undefined);
      void flushFlowAnalytics().catch(() => undefined);
    }, 8_000);
    return () => clearTimeout(timer);
  }, [enabled, phase, pathname]);

  return null;
}
