import { useState } from 'react';
import { View } from 'react-native';

import {
  AppText,
  Card,
  CollapsibleSection,
  IconButton,
  SegmentedControl,
} from '@/components/primitives';
import { useResponsive } from '@/hooks/use-responsive';
import { useTheme } from '@/hooks/use-theme';
import { AgentTestId, AgentUiIds } from '@/utils/agent-ui';

import {
  catalogTopVersionDiffers,
  formatCurrentAppVersionLabel,
  formatVersionNotesDate,
  getAppBuild,
  getAppVersion,
  getChangelog,
  getReleaseNotes,
  groupVersionNotesByDate,
  type VersionNotesEntry,
} from './release-notes';

type NotesTab = 'releaseNotes' | 'changelog';

const TAB_OPTIONS: { value: NotesTab; label: string }[] = [
  { value: 'releaseNotes', label: 'Release Notes' },
  { value: 'changelog', label: 'Changelogs' },
];

function VersionNotesBlock({ entry }: { entry: VersionNotesEntry }) {
  const { spacing } = useResponsive();

  return (
    <AgentTestId
      testID={AgentUiIds.developer.releaseNotesVersion(entry.version)}
      label={`Version ${entry.version}`}
      style={{ gap: spacing.xs }}>
      <AppText variant="callout" bold fit>
        {entry.version}
      </AppText>
      {entry.notes.map((note) => (
        <AppText key={note} variant="caption" color="primary">
          • {note}
        </AppText>
      ))}
    </AgentTestId>
  );
}

function NotesDayPager({
  entries,
  emptyLabel,
  dayIndex,
  onDayIndexChange,
  currentVersionLabel,
  mismatchHint,
}: {
  entries: readonly VersionNotesEntry[];
  emptyLabel: string;
  /** 0 = newest day. */
  dayIndex: number;
  onDayIndexChange: (index: number) => void;
  currentVersionLabel: string;
  mismatchHint: boolean;
}) {
  const theme = useTheme();
  const { spacing, layout } = useResponsive();
  const days = groupVersionNotesByDate(entries);

  if (days.length === 0) {
    return (
      <View style={{ gap: spacing.xs }}>
        <AgentTestId
          testID={AgentUiIds.developer.releaseNotesCurrentVersion}
          label={currentVersionLabel}>
          <AppText variant="caption" color="secondary" fit>
            {currentVersionLabel}
          </AppText>
        </AgentTestId>
        {mismatchHint ? (
          <AppText variant="caption" color="tertiary">
            Catalog top version differs from this build (common in OTA or local
            Metro).
          </AppText>
        ) : null}
        <AppText variant="caption" color="secondary">
          {emptyLabel}
        </AppText>
      </View>
    );
  }

  const safeIndex = Math.min(Math.max(dayIndex, 0), days.length - 1);
  const day = days[safeIndex]!;
  const dateLabel = formatVersionNotesDate(day.date);
  // Days are newest-first: left → older, right → newer.
  const canGoOlder = safeIndex < days.length - 1;
  const canGoNewer = safeIndex > 0;

  return (
    <Card
      style={{ gap: spacing.sm }}
      testID={AgentUiIds.developer.releaseNotesDay(day.date)}
      accessibilityLabel={dateLabel}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.sm,
          minHeight: layout.minTapTarget,
        }}>
        <IconButton
          icon="chevron-left"
          size={layout.minTapTarget}
          background={theme.backgroundElevated}
          borderColor={theme.separator}
          disabled={!canGoOlder}
          accessibilityLabel="Older ship day"
          testID={AgentUiIds.developer.releaseNotesPrev}
          onPress={() =>
            onDayIndexChange(Math.min(safeIndex + 1, days.length - 1))
          }
        />
        <AgentTestId
          testID={AgentUiIds.developer.releaseNotesDate}
          label={dateLabel}
          style={{ flex: 1, minWidth: 0, alignItems: 'center' }}>
          <AppText variant="callout" bold fit align="center">
            {dateLabel}
          </AppText>
        </AgentTestId>
        <IconButton
          icon="chevron-right"
          size={layout.minTapTarget}
          background={theme.backgroundElevated}
          borderColor={theme.separator}
          disabled={!canGoNewer}
          accessibilityLabel="Newer ship day"
          testID={AgentUiIds.developer.releaseNotesNext}
          onPress={() => onDayIndexChange(Math.max(safeIndex - 1, 0))}
        />
      </View>

      <View style={{ gap: spacing.xs, alignItems: 'center' }}>
        <AgentTestId
          testID={AgentUiIds.developer.releaseNotesCurrentVersion}
          label={currentVersionLabel}>
          <AppText variant="caption" color="secondary" fit align="center">
            {currentVersionLabel}
          </AppText>
        </AgentTestId>
        {mismatchHint ? (
          <AppText variant="caption" color="tertiary" align="center">
            Catalog top version differs from this build (common in OTA or local
            Metro).
          </AppText>
        ) : null}
      </View>

      <AgentTestId
        testID={AgentUiIds.developer.releaseNotesList}
        label={`Versions for ${dateLabel}`}
        style={{ gap: spacing.md }}>
        {day.entries.map((entry) => (
          <VersionNotesBlock key={entry.version} entry={entry} />
        ))}
      </AgentTestId>

      {days.length > 1 ? (
        <AppText variant="caption" color="secondary" align="center" fit>
          {safeIndex + 1} of {days.length}
        </AppText>
      ) : null}
    </Card>
  );
}

export function DeveloperReleaseNotesPanel() {
  const { spacing } = useResponsive();
  const [tab, setTab] = useState<NotesTab>('releaseNotes');
  /** Always begin on the newest day (group index 0). */
  const [dayIndex, setDayIndex] = useState(0);
  const version = getAppVersion();
  const build = getAppBuild();
  const releaseNotes = getReleaseNotes();
  const changelog = getChangelog();
  const activeCatalog = tab === 'releaseNotes' ? releaseNotes : changelog;
  const mismatch = catalogTopVersionDiffers(activeCatalog, version);
  const currentVersionLabel = formatCurrentAppVersionLabel(version, build);

  return (
    <CollapsibleSection
      title="App Updates"
      description="Release notes and changelog for this build"
      testID={AgentUiIds.developer.section.appUpdates}
      onExpandedChange={(expanded) => {
        if (expanded) setDayIndex(0);
      }}>
      <AgentTestId
        testID={AgentUiIds.developer.releaseNotes}
        label="App Updates"
        style={{ gap: spacing.sm }}>
        <AgentTestId
          testID={AgentUiIds.developer.releaseNotesTabs}
          label="Release notes tabs">
          <SegmentedControl
            value={tab}
            options={TAB_OPTIONS.map((option) => ({
              ...option,
              testID: AgentUiIds.developer.releaseNotesTab(option.value),
            }))}
            onChange={(next) => {
              setTab(next);
              setDayIndex(0);
            }}
            wrap
          />
        </AgentTestId>

        <NotesDayPager
          key={tab}
          entries={activeCatalog}
          emptyLabel={
            tab === 'releaseNotes'
              ? 'No release notes yet.'
              : 'No changelog yet.'
          }
          dayIndex={dayIndex}
          onDayIndexChange={setDayIndex}
          currentVersionLabel={currentVersionLabel}
          mismatchHint={mismatch}
        />
      </AgentTestId>
    </CollapsibleSection>
  );
}
