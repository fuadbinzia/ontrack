import * as Clipboard from 'expo-clipboard';
import * as Linking from 'expo-linking';
import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import {
  AppText,
  appPrompt,
  Button,
  Card,
  HeaderBackButton,
  MetaList,
  Screen,
  ScreenHeader,
  SectionHeader,
  SegmentedControl,
  StatusBadge,
} from '@/components/primitives';
import { useResponsive } from '@/hooks/use-responsive';
import { useRouteIsActive } from '@/hooks/use-app-activity';
import { useTheme } from '@/hooks/use-theme';
import { usePerformanceHistory } from '@/store/performance-history';
import { usePerformanceRuntime } from '@/store/performance-runtime';
import { AgentTestId, AgentUiIds } from '@/utils/agent-ui';
import { confirmDestructiveAction } from '@/utils/confirm-destructive';
import { formatCount } from '@/utils/grammar';

import {
  deriveRuntimeWarnings,
  formatPerformanceBytes,
} from './performance-metrics';
import {
  runtimeActivityStatusLabel,
  useRuntimeActivities,
} from './runtime-activity';
import type {
  PerformanceHourlyRollup,
  PerformanceSnapshot,
  PerformanceWarning,
  RuntimeActivityCategory,
} from './types';

type ActivityFilter = 'all' | RuntimeActivityCategory;

const FILTER_OPTIONS: readonly { value: ActivityFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'sync', label: 'Sync' },
  { value: 'network', label: 'Network' },
  { value: 'system', label: 'System' },
  { value: 'visual', label: 'Visual' },
];

function percent(value?: number): string {
  return value == null ? 'Unavailable' : `${value.toFixed(1)}%`;
}

function battery(value?: number): string {
  return value == null ? 'Unavailable' : `${Math.round(value * 100)}%`;
}

function duration(ms: number): string {
  const seconds = Math.max(0, Math.floor(ms / 1000));
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}

function metricSamples(
  samples: readonly PerformanceSnapshot[],
  read: (sample: PerformanceSnapshot) => number | undefined,
): number[] {
  return samples.slice(-24).flatMap((sample) => {
    const value = read(sample);
    return value == null || !Number.isFinite(value) ? [] : [value];
  });
}

function SparkBars({ values }: { values: readonly number[] }) {
  const theme = useTheme();
  const max = Math.max(1, ...values);
  return (
    <View style={styles.sparkBars} accessibilityElementsHidden>
      {values.length === 0 ? (
        <View
          style={[styles.sparkEmpty, { backgroundColor: theme.separator }]}
        />
      ) : (
        values.map((value, index) => (
          <View
            key={`${index}-${value}`}
            style={[
              styles.sparkBar,
              {
                height: `${Math.max(8, (value / max) * 100)}%`,
                backgroundColor: theme.accentPrimary,
              },
            ]}
          />
        ))
      )}
    </View>
  );
}

function MetricCard({
  label,
  value,
  detail,
  values,
}: {
  label: string;
  value: string;
  detail: string;
  values: readonly number[];
}) {
  const { spacing } = useResponsive();
  return (
    <Card airy style={[styles.metricCard, { gap: spacing.xs }]}>
      <AppText variant="overline" color="secondary" fit>
        {label}
      </AppText>
      <AppText variant="title" bold fit>
        {value}
      </AppText>
      <SparkBars values={values} />
      <AppText variant="caption" color="tertiary" numberOfLines={2}>
        {detail}
      </AppText>
    </Card>
  );
}

function rollupAverage(
  row: PerformanceHourlyRollup,
  field: 'cpuNormalizedTotal' | 'memoryTotalBytes',
): number {
  return row.sampleCount > 0 ? row[field] / row.sampleCount : 0;
}

function buildDiagnosticsReport(
  latest: PerformanceSnapshot | undefined,
  activities: ReturnType<typeof useRuntimeActivities>,
  warnings: readonly PerformanceWarning[],
): string {
  const lines = [
    'onTrack performance diagnostics',
    `Captured: ${new Date().toISOString()}`,
    latest
      ? `Process: ${latest.processName} (${latest.processId})`
      : 'Process: unavailable',
    latest
      ? `Memory: ${formatPerformanceBytes(latest.memoryBytes)}`
      : 'Memory: unavailable',
    latest
      ? `CPU normalized: ${percent(latest.cpuNormalizedPercent)}`
      : 'CPU: unavailable',
    latest ? `Thermal: ${latest.thermalState}` : 'Thermal: unavailable',
    latest
      ? `Low power mode: ${latest.lowPowerMode ? 'on' : 'off'}`
      : 'Low power mode: unavailable',
    '',
    'Runtime activities:',
    ...activities.map(
      (item) =>
        `- ${item.label}: ${item.status}, pending ${item.pending}, operations ${item.operations}, errors ${item.errors}`,
    ),
    '',
    'Warnings:',
    ...(warnings.length > 0
      ? warnings.map((item) => `- ${item.title}: ${item.detail}`)
      : ['- None']),
  ];
  return lines.join('\n');
}

export function PerformanceMonitorScreen() {
  const routeIsActive = useRouteIsActive();
  const { spacing } = useResponsive();
  const latest = usePerformanceRuntime((state) => state.latest);
  const samples = usePerformanceRuntime((state) => state.samples);
  const warnings = usePerformanceRuntime((state) => state.warnings);
  const supported = usePerformanceRuntime((state) => state.supported);
  const setDetailed = usePerformanceRuntime((state) => state.setDetailed);
  const clearSession = usePerformanceRuntime((state) => state.clearSession);
  const rollups = usePerformanceHistory((state) => state.rollups);
  const sessions = usePerformanceHistory((state) => state.sessions);
  const clearHistory = usePerformanceHistory((state) => state.clear);
  const activities = useRuntimeActivities();
  const [filter, setFilter] = useState<ActivityFilter>('all');

  useEffect(() => {
    setDetailed(routeIsActive);
    return () => setDetailed(false);
  }, [routeIsActive, setDetailed]);

  const filteredActivities = useMemo(
    () =>
      activities.filter(
        (activity) => filter === 'all' || activity.category === filter,
      ),
    [activities, filter],
  );
  const displayWarnings = useMemo(
    () => [...warnings, ...deriveRuntimeWarnings(activities)],
    [activities, warnings],
  );
  const recentRollups = useMemo(
    () =>
      Object.values(rollups)
        .sort((a, b) => b.hour.localeCompare(a.hour))
        .slice(0, 24),
    [rollups],
  );
  const dailyTrends = useMemo(() => {
    const days = new Map<string, {
      samples: number; cpuTotal: number; cpuPeak: number; memoryPeak: number; network: number;
    }>();
    for (const row of Object.values(rollups)) {
      const day = row.hour.slice(0, 10);
      const current = days.get(day) ?? {
        samples: 0, cpuTotal: 0, cpuPeak: 0, memoryPeak: 0, network: 0,
      };
      current.samples += row.sampleCount;
      current.cpuTotal += row.cpuNormalizedTotal;
      current.cpuPeak = Math.max(current.cpuPeak, row.cpuNormalizedPeak);
      current.memoryPeak = Math.max(current.memoryPeak, row.memoryPeakBytes);
      current.network += row.networkReceivedBytes + row.networkSentBytes;
      days.set(day, current);
    }
    return [...days.entries()].sort(([a], [b]) => b.localeCompare(a)).slice(0, 30);
  }, [rollups]);
  const recentSessions = useMemo(
    () => [...sessions].sort((a, b) => b.endedAt - a.endedAt).slice(0, 5),
    [sessions],
  );
  const networkDelta =
    (latest?.networkReceivedDeltaBytes ?? 0) +
    (latest?.networkSentDeltaBytes ?? 0);

  const copyReport = async () => {
    await Clipboard.setStringAsync(
      buildDiagnosticsReport(latest, activities, displayWarnings),
    );
    appPrompt.alert(
      'Diagnostics copied',
      'The local performance report is ready to paste.',
    );
  };

  const clearAllHistory = () => {
    confirmDestructiveAction({
      title: 'Clear performance history?',
      message:
        'This removes the current session samples and all locally stored 30-day rollups.',
      actionLabel: 'Clear History',
      confirmTestID: AgentUiIds.performance.clearConfirm,
      onConfirm: () => {
        clearSession();
        clearHistory();
      },
    });
  };

  return (
    <Screen contentStyle={{ gap: spacing.lg }}>
      <ScreenHeader
        eyebrow="Developer diagnostics"
        title="Performance Monitor"
        subtitle="Live onTrack process health, runtime work, and 30-day device-local trends"
        leading={
          <HeaderBackButton
            compact
            fallback="/(tabs)/profile/developer"
            accessibilityLabel="Back to developer tools"
            testID={AgentUiIds.performance.back}
          />
        }
      />

      {!supported ? (
        <Card testID={AgentUiIds.performance.unsupported}>
          <AppText variant="body">
            Performance metrics need a native build containing
            OnTrackPerformance. The rest of Developer Tools remains available.
          </AppText>
        </Card>
      ) : null}

      <AgentTestId testID={AgentUiIds.performance.section.live}>
        <View style={{ gap: spacing.sm }}>
          <SectionHeader
            title="Live process"
            detail="1 second sampling"
            flush
          />
          <View style={[styles.metricGrid, { gap: spacing.sm }]}>
            <MetricCard
              label="CPU load"
              value={percent(latest?.cpuNormalizedPercent)}
              detail={`Core equivalent ${percent(latest?.cpuCorePercent)}`}
              values={metricSamples(
                samples,
                (sample) => sample.cpuNormalizedPercent,
              )}
            />
            <MetricCard
              label="Memory"
              value={formatPerformanceBytes(latest?.memoryBytes)}
              detail={
                latest?.availableMemoryBytes == null
                  ? 'Available memory unavailable'
                  : `${formatPerformanceBytes(latest.availableMemoryBytes)} available`
              }
              values={metricSamples(samples, (sample) => sample.memoryBytes)}
            />
            <MetricCard
              label="Battery"
              value={battery(latest?.batteryLevel)}
              detail={`${latest?.batteryState ?? 'unknown'} · device-wide observation`}
              values={metricSamples(samples, (sample) => sample.batteryLevel)}
            />
            <MetricCard
              label="JS delay"
              value={
                latest?.jsEventLoopLagMs == null
                  ? 'Unavailable'
                  : `${latest.jsEventLoopLagMs.toFixed(0)} ms`
              }
              detail={`Frames ${latest?.framesPerSecond?.toFixed(0) ?? '—'} fps · slow ${percent((latest?.slowFrameRatio ?? 0) * 100)}`}
              values={metricSamples(
                samples,
                (sample) => sample.jsEventLoopLagMs,
              )}
            />
          </View>
          <Card airy testID={AgentUiIds.performance.processDetails}>
            <MetaList
              items={[
                {
                  label: 'Process',
                  value: latest
                    ? `${latest.processName} · PID ${latest.processId}`
                    : 'Collecting…',
                },
                {
                  label: 'Uptime',
                  value: latest ? duration(latest.uptimeMs) : '—',
                },
                {
                  label: 'Threads',
                  value:
                    latest?.threadCount == null
                      ? 'Unavailable'
                      : String(latest.threadCount),
                },
                { label: 'Thermal', value: latest?.thermalState ?? 'Unknown' },
                {
                  label: 'Low Power Mode',
                  value: latest?.lowPowerMode
                    ? 'On · optional effects reduced'
                    : 'Off',
                },
                {
                  label: 'Network since sample',
                  value: formatPerformanceBytes(networkDelta),
                },
                {
                  label: 'Total device memory',
                  value: formatPerformanceBytes(latest?.totalMemoryBytes),
                },
                {
                  label: 'Available device memory',
                  value: formatPerformanceBytes(latest?.availableMemoryBytes),
                },
                {
                  label: 'Native heap',
                  value: formatPerformanceBytes(latest?.nativeHeapBytes),
                },
                {
                  label: 'Java heap',
                  value: formatPerformanceBytes(latest?.javaHeapBytes),
                },
                {
                  label: 'Graphics',
                  value: formatPerformanceBytes(latest?.graphicsBytes),
                },
              ]}
            />
          </Card>
        </View>
      </AgentTestId>

      <AgentTestId testID={AgentUiIds.performance.section.warnings}>
        <View style={{ gap: spacing.sm }}>
          <SectionHeader
            title="Drain indicators"
            detail={`${displayWarnings.length} active`}
            flush
          />
          {displayWarnings.length === 0 ? (
            <Card airy>
              <AppText variant="body" color="secondary">
                No current threshold warnings.
              </AppText>
            </Card>
          ) : (
            displayWarnings.map((warning) => (
              <Card key={warning.id} airy style={{ gap: spacing.xs }}>
                <StatusBadge
                  label={warning.severity === 'critical' ? 'Critical' : 'Watch'}
                  tone={warning.severity === 'critical' ? 'danger' : 'warning'}
                />
                <AppText variant="callout" bold fit>
                  {warning.title}
                </AppText>
                <AppText variant="caption" color="secondary">
                  {warning.detail}
                </AppText>
              </Card>
            ))
          )}
        </View>
      </AgentTestId>

      <AgentTestId testID={AgentUiIds.performance.section.activities}>
        <View style={{ gap: spacing.sm }}>
          <SectionHeader
            title="Runtime work"
            detail={`${filteredActivities.length} shown`}
            flush
          />
          <SegmentedControl
            label="Category"
            value={filter}
            options={FILTER_OPTIONS.map((option) => ({
              ...option,
              testID: AgentUiIds.performance.filter(option.value),
            }))}
            onChange={setFilter}
            wrap
          />
          <AppText variant="caption" color="tertiary">
            onTrack has one main process. These rows show logical work and
            activity counters; memory cannot be attributed reliably per
            subsystem.
          </AppText>
          {filteredActivities.map((activity) => (
            <Card
              key={activity.id}
              airy
              style={{ gap: spacing.xs }}
              testID={AgentUiIds.performance.activity(activity.id)}
            >
              <View style={styles.activityTitle}>
                <AppText variant="callout" bold fit style={styles.flexText}>
                  {activity.label}
                </AppText>
                <StatusBadge
                  label={runtimeActivityStatusLabel(activity.status)}
                  tone={
                    activity.status === 'error'
                      ? 'danger'
                      : activity.status === 'running'
                        ? 'success'
                        : 'neutral'
                  }
                />
              </View>
              <MetaList
                items={[
                  { label: 'Detail', value: activity.detail ?? '—' },
                  {
                    label: 'Lifetime',
                    value: activity.startedAt
                      ? duration((latest?.timestampMs ?? activity.updatedAt) - activity.startedAt)
                      : '—',
                  },
                  {
                    label: 'Work',
                    value: `${formatCount(activity.operations, 'operation')} · ${activity.pending} pending`,
                  },
                  { label: 'Errors', value: String(activity.errors) },
                  {
                    label: 'Traffic',
                    value: `${formatPerformanceBytes(activity.receivedBytes)} in · ${formatPerformanceBytes(activity.sentBytes)} out`,
                  },
                ]}
              />
            </Card>
          ))}
        </View>
      </AgentTestId>

      <AgentTestId testID={AgentUiIds.performance.section.history}>
        <View style={{ gap: spacing.sm }}>
          <SectionHeader
            title="30-day history"
            detail={`${formatCount(dailyTrends.length, 'day')} · ${formatCount(recentSessions.length, 'session')}`}
            flush
          />
          {recentRollups.length === 0 ? (
            <Card airy>
              <AppText variant="body" color="secondary">
                History will appear after the first foreground samples are
                flushed.
              </AppText>
            </Card>
          ) : (
            recentRollups.slice(0, 8).map((row) => (
              <Card key={row.hour} airy>
                <MetaList
                  items={[
                    {
                      label: 'Hour',
                      value: new Date(row.hour).toLocaleString(),
                    },
                    {
                      label: 'Average CPU',
                      value: percent(rollupAverage(row, 'cpuNormalizedTotal')),
                    },
                    {
                      label: 'Peak CPU',
                      value: percent(row.cpuNormalizedPeak),
                    },
                    {
                      label: 'Average memory',
                      value: formatPerformanceBytes(
                        rollupAverage(row, 'memoryTotalBytes'),
                      ),
                    },
                    {
                      label: 'Peak memory',
                      value: formatPerformanceBytes(row.memoryPeakBytes),
                    },
                    {
                      label: 'Network',
                      value: formatPerformanceBytes(
                        row.networkReceivedBytes + row.networkSentBytes,
                      ),
                    },
                  ]}
                />
              </Card>
            ))
          )}
          {dailyTrends.length > 0 ? (
            <>
              <SectionHeader title="Daily trends" flush />
              {dailyTrends.slice(0, 7).map(([day, row]) => (
                <Card key={day} airy>
                  <MetaList items={[
                    { label: 'Day', value: day },
                    { label: 'Average CPU', value: percent(row.samples > 0 ? row.cpuTotal / row.samples : 0) },
                    { label: 'Peak CPU', value: percent(row.cpuPeak) },
                    { label: 'Peak memory', value: formatPerformanceBytes(row.memoryPeak) },
                    { label: 'Network', value: formatPerformanceBytes(row.network) },
                  ]} />
                </Card>
              ))}
            </>
          ) : null}
          {recentSessions.length > 0 ? (
            <>
              <SectionHeader title="Session comparisons" flush />
              {recentSessions.map((session) => {
                const batteryChange =
                  session.batteryStart == null || session.batteryEnd == null
                    ? 'Unavailable'
                    : `${((session.batteryEnd - session.batteryStart) * 100).toFixed(1)}% device-wide`;
                return (
                  <Card key={session.id} airy>
                    <MetaList items={[
                      { label: 'Started', value: new Date(session.startedAt).toLocaleString() },
                      { label: 'Foreground', value: duration(session.foregroundDurationMs) },
                      { label: 'Average / peak CPU', value: `${percent(session.cpuNormalizedAverage)} / ${percent(session.cpuNormalizedPeak)}` },
                      { label: 'Peak memory', value: formatPerformanceBytes(session.memoryPeakBytes) },
                      { label: 'JS lag p95', value: `${session.jsLagP95Ms.toFixed(1)} ms` },
                      { label: 'Battery observation', value: batteryChange },
                    ]} />
                  </Card>
                );
              })}
            </>
          ) : null}
        </View>
      </AgentTestId>

      <AgentTestId testID={AgentUiIds.performance.section.tools}>
        <View style={{ gap: spacing.sm }}>
          <SectionHeader title="Tools" flush />
          <View style={[styles.toolRow, { gap: spacing.sm }]}>
            <Button
              variant="secondary"
              testID={AgentUiIds.performance.copy}
              onPress={() => void copyReport()}
              style={styles.toolButton}
            >
              Copy diagnostics
            </Button>
            <Button
              variant="ghost"
              testID={AgentUiIds.performance.settings}
              onPress={() => void Linking.openSettings()}
              style={styles.toolButton}
            >
              App settings
            </Button>
          </View>
          <Button
            variant="danger"
            testID={AgentUiIds.performance.clear}
            onPress={clearAllHistory}
          >
            Clear performance history
          </Button>
          <AppText variant="caption" color="tertiary">
            For definitive energy attribution, profile a physical device with
            Xcode Instruments or Android Studio. System battery pages include
            other apps and device activity.
          </AppText>
        </View>
      </AgentTestId>
    </Screen>
  );
}

const styles = StyleSheet.create({
  metricGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  metricCard: { flexGrow: 1, flexBasis: '46%', minWidth: 0 },
  sparkBars: {
    height: 34,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 2,
  },
  sparkBar: { flex: 1, minWidth: 2, borderRadius: 2, opacity: 0.72 },
  sparkEmpty: { width: '100%', height: StyleSheet.hairlineWidth },
  activityTitle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  flexText: { flex: 1, minWidth: 0 },
  toolRow: { flexDirection: 'row' },
  toolButton: { flex: 1, minWidth: 0 },
});
