import { useCallback, useEffect, useState } from 'react';

import {
    AppText,
    Card,
    CollapsibleSection,
    MetaList,
    PanelTitle,
} from '@/components/primitives';
import { useResponsive } from '@/hooks/use-responsive';
import {
    analyticsSurfaceLabel,
    formatActiveDuration,
    type AnalyticsSurface,
} from '@/services/analytics/surfaces';
import {
    fetchProductAnalyticsSummary,
    flushUsageAnalytics,
    type ProductAnalyticsSummary,
} from '@/services/analytics/sync';
import { summarizeLocalUsage } from '@/store/usage-analytics';
import { AgentTestId, AgentUiIds } from '@/utils/agent-ui';
import { formatCount } from '@/utils/grammar';

export function DeveloperInsightsPanel() {
  const { spacing } = useResponsive();
  const [local, setLocal] = useState(() => summarizeLocalUsage(7));
  const [product, setProduct] = useState<ProductAnalyticsSummary | undefined>();
  const [productError, setProductError] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    setBusy(true);
    setLocal(summarizeLocalUsage(7));
    setProductError(undefined);
    try {
      await flushUsageAnalytics();
      const summary = await fetchProductAnalyticsSummary(7);
      if ('error' in summary) {
        setProduct(undefined);
        setProductError(summary.error);
      } else {
        setProduct(summary);
      }
    } catch (reason) {
      setProductError(reason instanceof Error ? reason.message : 'Could not load product stats.');
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const localSurfaces = local.topSurfaces.map((row) => ({
    label: analyticsSurfaceLabel(row.surface as AnalyticsSurface),
    value: formatActiveDuration(row.activeMs),
  }));

  const productSurfaces =
    product?.topSurfaces.map((row) => ({
      label: analyticsSurfaceLabel(row.surface as AnalyticsSurface),
      value: formatActiveDuration(row.activeMs),
    })) ?? [];

  return (
    <CollapsibleSection
      title="Product insights"
      description="Surface time on this device and across users"
      testID={AgentUiIds.developer.section.insights}
      actionLabel="Sync"
      actionTestID={AgentUiIds.developer.insightsRefresh}
      actionDisabled={busy}
      onAction={() => void refresh()}>
      <AgentTestId
        testID={AgentUiIds.developer.insights}
        label="Product insights"
        style={{ gap: spacing.sm }}>
        <AppText variant="caption" color="secondary">
          Surface time only — health notes and meal contents are never included.
        </AppText>

        <Card style={{ gap: spacing.sm }} testID={AgentUiIds.developer.insightsLocal}>
          <PanelTitle>This device (7 days)</PanelTitle>
          <AppText variant="body" fit>
            {formatCount(local.sessionCount, 'session')} · {formatActiveDuration(local.activeMs)} active
          </AppText>
          {localSurfaces.length === 0 ? (
            <AppText variant="caption" color="secondary">
              No dwell recorded yet — keep Usage Analytics on.
            </AppText>
          ) : (
            <MetaList items={localSurfaces} />
          )}
        </Card>

        <Card style={{ gap: spacing.sm }} testID={AgentUiIds.developer.insightsProduct}>
          <PanelTitle>All users (7 days)</PanelTitle>
          {product ? (
            <>
              <AppText variant="body" fit>
                {formatCount(product.totalUsers, 'account')} · {product.activeUsers} active ·{' '}
                {formatCount(product.totalSessions, 'session')}
              </AppText>
              <AppText variant="caption" color="secondary" fit>
                {formatActiveDuration(product.totalActiveMs)} total active time
              </AppText>
              {productSurfaces.length > 0 ? <MetaList items={productSurfaces} /> : null}
            </>
          ) : (
            <AppText variant="caption" color="secondary">
              {productError ?? 'Sign in as the analytics admin to load cloud totals.'}
            </AppText>
          )}
        </Card>
      </AgentTestId>
    </CollapsibleSection>
  );
}
