import { Image } from 'expo-image';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import {
  appPrompt,
  AppText,
  GlassMetaChip,
  GlassPlate,
  Symbol,
} from '@/components/primitives';
import { radii, spacing, ufcFightCardColors } from '@/design-system';
import {
  fightCardBoutCountLabel,
  fightCardBoutBilling,
  fightCardBoutStatusLabel,
  fightCardSectionLabel,
  fightCardWeightClassLabel,
  fighterMetaOrder,
  splitFightCardMatchup,
} from '@/features/events/event-card-model';
import { useResponsive } from '@/hooks/use-responsive';
import { useTheme } from '@/hooks/use-theme';
import {
  fetchUfcFighterProfiles,
  type EventBout,
  type EventCardSection,
  type EventFighter,
  type EventFighterProfile,
} from '@/services/events';
import { AgentTestId, AgentUiIds, useAgentUiTarget } from '@/utils/agent-ui';
import { haptics } from '@/utils/haptics';

type DisplayBout = EventBout & { billing?: 'Main Event' | 'Co-Main' };

type FightCardContext = {
  eventTitle?: string;
  eventTiming?: string;
};

const sectionOrder: EventCardSection[] = ['main', 'prelims', 'early-prelims'];
function sameMatchup(names: readonly string[], participants: readonly string[]) {
  if (names.length < 2 || participants.length < 2) return false;
  const normalized = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, '');
  return normalized(names[0]) === normalized(participants[0])
    && normalized(names[1]) === normalized(participants[1]);
}

function legacyFighter(name: string, side: number): EventFighter {
  return { providerAthleteId: `legacy-${side}-${name}`, name };
}

function displayBouts(
  bouts: readonly EventBout[] | undefined,
  participants: readonly string[],
  legacyCard: readonly string[],
): DisplayBout[] {
  const addBilling = (items: readonly EventBout[]): DisplayBout[] => {
    let mainIndex = 0;
    return items.map((bout) => ({
      ...bout,
      billing: fightCardBoutBilling(
        bout.cardSection,
        bout.cardSection === 'main' ? mainIndex++ : -1,
      ),
    }));
  };

  if (bouts?.length) {
    return addBilling(bouts);
  }

  const headliner = participants.length
    ? [{
        providerCompetitionId: 'legacy-main-event',
        cardSection: 'main' as const,
        fighters: participants.slice(0, 2).map(legacyFighter),
      }]
    : [];
  const card = legacyCard.flatMap((label, index) => {
    const matchup = splitFightCardMatchup(label);
    const names = [matchup.redCorner, matchup.blueCorner].filter(
      (name): name is string => Boolean(name),
    );
    if (sameMatchup(names, participants)) return [];
    return [{
      providerCompetitionId: `legacy-${index}`,
      cardSection: 'main' as const,
      fighters: names.map(legacyFighter),
    }];
  });
  return addBilling([...headliner, ...card]);
}

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
}

function FighterPortrait({ fighter, featured }: {
  fighter: EventFighter;
  featured: boolean;
}) {
  const { s } = useResponsive();
  const colors = ufcFightCardColors(useTheme());
  const [failed, setFailed] = useState(false);
  const size = s(featured ? 68 : 54);
  useEffect(() => setFailed(false), [fighter.imageUrl]);

  return (
    <GlassPlate
      mist
      accessibilityRole="image"
      accessibilityLabel={`${fighter.name} portrait`}
      style={[
        styles.portraitWell,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
        },
      ]}>
      {fighter.imageUrl && !failed ? (
        <Image
          source={fighter.imageUrl}
          cachePolicy="disk"
          contentFit="contain"
          transition={150}
          onError={() => setFailed(true)}
          style={StyleSheet.absoluteFill}
        />
      ) : (
        <AppText variant="caption" color="onAccent" style={{ color: colors.primaryText }} bold>
          {initials(fighter.name)}
        </AppText>
      )}
    </GlassPlate>
  );
}

function FighterMeta({ fighter, align }: {
  fighter: EventFighter;
  align: 'left' | 'right';
}) {
  const colors = ufcFightCardColors(useTheme());
  if (!fighter.record && !fighter.countryFlagUrl) return null;
  const parts = {
    flag: fighter.countryFlagUrl ? (
      <Image
        key="flag"
        source={fighter.countryFlagUrl}
        accessibilityLabel={fighter.country ? `${fighter.country} flag` : 'Country flag'}
        contentFit="contain"
        style={styles.flag}
      />
    ) : null,
    record: fighter.record ? (
      <AppText key="record" variant="caption" color="onAccent" style={{ color: colors.secondaryText }}>
        {fighter.record}
      </AppText>
    ) : null,
  };
  return (
    <View style={[styles.fighterMeta, align === 'right' ? styles.fighterMetaRight : null]}>
      {fighterMetaOrder(align).map((part) => parts[part])}
    </View>
  );
}

function FighterCorner({ fighter, side, featured }: {
  fighter: EventFighter;
  side: 'left' | 'right';
  featured: boolean;
}) {
  const colors = ufcFightCardColors(useTheme());
  const copy = (
    <View style={[styles.fighterCopy, side === 'right' ? styles.fighterCopyRight : null]}>
      <AppText
        variant="bodyMedium"
        color="onAccent"
        style={{ color: fighter.winner ? colors.header : colors.primaryText }}
        align={side}
        accessibilityLabel={fighter.winner ? `${fighter.name}, Winner` : fighter.name}
        numberOfLines={2}
        bold>
        {fighter.name}
      </AppText>
      <FighterMeta fighter={fighter} align={side} />
    </View>
  );
  const portrait = <FighterPortrait fighter={fighter} featured={featured} />;

  return (
    <View style={[styles.corner, side === 'right' ? styles.cornerRight : null]}>
      {side === 'left' ? portrait : copy}
      {side === 'left' ? copy : portrait}
    </View>
  );
}

function boutDescriptor(bout: DisplayBout) {
  return [
    fightCardWeightClassLabel(bout.weightClass),
    bout.title ? 'Title Bout' : undefined,
  ]
    .filter(Boolean)
    .join(' · ');
}

function ModalFighter({ fighter }: { fighter: EventFighter }) {
  return (
    <View style={styles.modalFighter}>
      <FighterPortrait fighter={fighter} featured />
      <AppText variant="subheading" align="center" bold>
        {fighter.name}
      </AppText>
      {fighter.record ? (
        <AppText variant="callout" color="secondary" align="center">
          {fighter.record}
        </AppText>
      ) : null}
    </View>
  );
}

function TaleRow({ label, left, right }: {
  label: string;
  left?: string;
  right?: string;
}) {
  const { spacing: responsiveSpacing, s } = useResponsive();
  return (
    <View style={[styles.taleRow, { gap: responsiveSpacing.sm, minHeight: s(34) }]}>
      <AppText variant="callout" align="right" fit bold style={styles.taleValue}>
        {left ?? '—'}
      </AppText>
      <AppText variant="caption" color="secondary" align="center" fit style={styles.taleLabel}>
        {label}
      </AppText>
      <AppText variant="callout" align="left" fit bold style={styles.taleValue}>
        {right ?? '—'}
      </AppText>
    </View>
  );
}

function BoutDetailContent({
  bout,
  eventTitle,
  eventTiming,
}: { bout: DisplayBout } & FightCardContext) {
  const theme = useTheme();
  const { spacing: responsiveSpacing } = useResponsive();
  const profileIds = bout.fighters
    .map((fighter) => fighter.providerAthleteId)
    .filter((id) => /^\d{1,12}$/.test(id))
    .slice(0, 2);
  const profileIdsKey = profileIds.join(',');
  const [profiles, setProfiles] = useState<Record<string, EventFighterProfile>>({});
  useEffect(() => {
    if (!profileIdsKey) return;
    const controller = new AbortController();
    void fetchUfcFighterProfiles(profileIdsKey.split(','), controller.signal)
      .then((response) => setProfiles(Object.fromEntries(
        response.profiles.map((profile) => [profile.providerAthleteId, profile]),
      )))
      .catch((error: unknown) => {
        if (!(error instanceof Error && error.name === 'AbortError')) {
          // Saved bout data remains usable when profile enrichment is offline.
        }
      });
    return () => controller.abort();
  }, [profileIdsKey]);

  const enrichedFighters = bout.fighters.map((fighter) => ({
    ...fighter,
    ...profiles[fighter.providerAthleteId],
  }));
  const first = enrichedFighters[0];
  const second = enrichedFighters[1];
  const descriptor = boutDescriptor(bout);
  const status = fightCardBoutStatusLabel(bout.status, bout.period, bout.displayClock);
  const tale = [
    {
      label: 'Age',
      left: first?.age == null ? undefined : String(first.age),
      right: second?.age == null ? undefined : String(second.age),
    },
    { label: 'Height', left: first?.height, right: second?.height },
    { label: 'Weight', left: first?.weight, right: second?.weight },
    { label: 'Reach', left: first?.reach, right: second?.reach },
  ];
  const availableTale = tale.filter((row) => row.left != null || row.right != null);

  return (
    <AgentTestId
      testID={AgentUiIds.eventDetail.fightCardModal}
      label="Bout details"
      style={[styles.modalContent, { gap: responsiveSpacing.xl }]}>
      <View style={[styles.modalContext, { gap: responsiveSpacing.xs }]}>
        {eventTiming ? (
          <AppText variant="caption" color="secondary" align="center">
            {eventTiming}
          </AppText>
        ) : null}
        {eventTitle ? (
          <AppText variant="callout" align="center" bold>
            {eventTitle}
          </AppText>
        ) : null}
        {descriptor ? (
          <AppText variant="caption" color="accent" align="center" bold>
            {descriptor}
          </AppText>
        ) : null}
      </View>

      <View style={[styles.modalMatchup, { gap: responsiveSpacing.sm }]}>
        {first ? <ModalFighter fighter={first} /> : <View style={styles.modalFighter} />}
        <View style={styles.modalVersus}>
          <AppText variant="overline" color="accent" bold>VS</AppText>
        </View>
        {second ? <ModalFighter fighter={second} /> : <View style={styles.modalFighter} />}
      </View>

      {availableTale.length > 0 ? (
        <View
          style={[
            styles.tale,
            {
              borderColor: theme.separator,
              gap: responsiveSpacing.xs,
              paddingVertical: responsiveSpacing.md,
            },
          ]}>
          {availableTale.map((row) => <TaleRow key={row.label} {...row} />)}
        </View>
      ) : null}

      {status ? (
        <View style={[styles.modalMeta, { gap: responsiveSpacing.sm }]}>
          <GlassMetaChip accessibilityLabel={`Bout status: ${status}`}>
            <Symbol name="clock" size="sm" color={theme.accentPrimary} />
            <AppText variant="caption" fit>{status}</AppText>
          </GlassMetaChip>
        </View>
      ) : null}
    </AgentTestId>
  );
}

function BoutRow({ bout, eventTitle, eventTiming }: {
  bout: DisplayBout;
} & FightCardContext) {
  const colors = ufcFightCardColors(useTheme());
  const featured = bout.billing === 'Main Event';
  const first = bout.fighters[0];
  const second = bout.fighters[1];
  const descriptor = boutDescriptor(bout);
  const statusLabel = fightCardBoutStatusLabel(
    bout.status,
    bout.period,
    bout.displayClock,
  );
  const matchupLabel = bout.fighters.map((fighter) => fighter.name).join(' versus ');
  const testID = AgentUiIds.eventDetail.fightCardBout(bout.providerCompetitionId);
  const openDetails = () => {
    haptics.tap();
    appPrompt.alert(
      bout.billing ?? (descriptor || 'Bout Details'),
      undefined,
      [{ text: 'Close', style: 'cancel' }],
      {
        cancelable: true,
        icon: null,
        content: (
          <BoutDetailContent
            bout={bout}
            eventTitle={eventTitle}
            eventTiming={eventTiming}
          />
        ),
      },
    );
  };
  const accessibilityLabel = `Open ${matchupLabel || 'bout'} details`;
  const agent = useAgentUiTarget(testID, {
    label: accessibilityLabel,
    onPress: openDetails,
  });
  if (!first) return null;

  return (
    <Pressable
      ref={agent.ref}
      testID={testID}
      onLayout={agent.onLayout}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={openDetails}
      style={({ pressed }) => [
        styles.bout,
        featured ? styles.featuredBout : null,
        { borderTopColor: colors.divider },
        pressed ? styles.boutPressed : null,
      ]}>
      <View style={styles.boutMeta}>
        <View style={styles.boutMetaCopy}>
          <AppText
            variant="callout"
            color="onAccent"
            style={{ color: bout.billing ? colors.header : colors.secondaryText }}
            bold={Boolean(bout.billing)}>
            {bout.billing ?? (descriptor || 'Matchup')}
          </AppText>
          {bout.billing && descriptor ? (
            <AppText variant="caption" color="onAccent" style={{ color: colors.secondaryText }}>
              {descriptor}
            </AppText>
          ) : null}
        </View>
        <View style={styles.boutMetaAction}>
          {statusLabel ? (
            <AppText
              variant="caption"
              color="onAccent"
              style={{ color: colors.header }}
              bold
              numberOfLines={1}>
              {statusLabel}
            </AppText>
          ) : null}
          <Symbol name="chevron-right" size="sm" color={colors.secondaryText} />
        </View>
      </View>
      <View style={styles.matchup}>
        <FighterCorner fighter={first} side="left" featured={featured} />
        <View style={styles.versus}>
          <AppText variant="caption" color="onAccent" style={{ color: colors.secondaryText }}>VS</AppText>
        </View>
        {second ? (
          <FighterCorner fighter={second} side="right" featured={featured} />
        ) : <View style={styles.corner} />}
      </View>
    </Pressable>
  );
}

function FightCardTab({
  section,
  selected,
  onSelect,
}: {
  section: EventCardSection;
  selected: boolean;
  onSelect: () => void;
}) {
  const theme = useTheme();
  const colors = ufcFightCardColors(theme);
  const label = fightCardSectionLabel(section);
  const testID = AgentUiIds.eventDetail.fightCardTab(section);
  const handlePress = () => {
    haptics.select();
    onSelect();
  };
  const agent = useAgentUiTarget(testID, { label, onPress: handlePress });

  return (
    <Pressable
      ref={agent.ref}
      testID={testID}
      onLayout={agent.onLayout}
      accessibilityRole="tab"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
      onPress={handlePress}
      style={({ pressed }) => [styles.tab, pressed ? styles.tabPressed : null]}>
      <AppText
        variant="callout"
        color="onAccent"
        style={{ color: selected ? colors.primaryText : colors.secondaryText }}
        bold={selected}
        fit>
        {label}
      </AppText>
      <View
        style={[
          styles.tabIndicator,
          { backgroundColor: selected ? colors.header : 'transparent' },
        ]}
      />
    </Pressable>
  );
}

export function UfcFightCard({
  bouts,
  participants,
  legacyCard = [],
  eventTitle,
  eventTiming,
}: {
  bouts?: readonly EventBout[];
  participants: readonly string[];
  legacyCard?: readonly string[];
} & FightCardContext) {
  const theme = useTheme();
  const colors = ufcFightCardColors(theme);
  const resolved = useMemo(
    () => displayBouts(bouts, participants, legacyCard),
    [bouts, legacyCard, participants],
  );
  const sections = useMemo(() => sectionOrder
    .map((section) => ({
      section,
      bouts: resolved.filter((bout) => bout.cardSection === section),
    }))
    .filter((group) => group.bouts.length > 0), [resolved]);
  const [activeSection, setActiveSection] = useState<EventCardSection>(
    () => sections[0]?.section ?? 'main',
  );
  const activeGroup = sections.find((group) => group.section === activeSection)
    ?? sections[0];

  useEffect(() => {
    if (activeGroup && activeGroup.section !== activeSection) {
      setActiveSection(activeGroup.section);
    }
  }, [activeGroup, activeSection]);

  if (resolved.length === 0) return null;

  return (
    <GlassPlate
      inverted={theme.name === 'dark'}
      intensity={78}
      tintColor={colors.board}
      style={[styles.card, { borderColor: colors.boardBorder }]}>
      <GlassPlate
        tintColor={colors.header}
        style={[styles.cardBanner, { borderBottomColor: colors.header }]}>
        <AppText variant="overline" color="onAccent" style={{ color: colors.headerText }} bold>
          Fight Card
        </AppText>
        <AppText variant="caption" color="onAccent" style={{ color: colors.headerText }}>
          {fightCardBoutCountLabel(resolved.length)}
        </AppText>
      </GlassPlate>
      <View accessibilityRole="tablist" style={[styles.tabs, { borderBottomColor: colors.divider }]}>
        {sections.map((group) => (
          <FightCardTab
            key={group.section}
            section={group.section}
            selected={group.section === activeGroup?.section}
            onSelect={() => setActiveSection(group.section)}
          />
        ))}
      </View>
      {activeGroup?.bouts.map((bout) => (
        <BoutRow
          key={bout.providerCompetitionId}
          bout={bout}
          eventTitle={eventTitle}
          eventTiming={eventTiming}
        />
      ))}
    </GlassPlate>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: radii.lg,
  },
  cardBanner: {
    borderRadius: 0,
    borderBottomWidth: 4,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  tabs: {
    minWidth: 0,
    flexDirection: 'row',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  tab: {
    minWidth: 0,
    minHeight: 48,
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
  },
  tabPressed: { opacity: 0.64 },
  tabIndicator: {
    position: 'absolute',
    right: spacing.md,
    bottom: 0,
    left: spacing.md,
    height: 3,
    borderTopLeftRadius: radii.pill,
    borderTopRightRadius: radii.pill,
  },
  bout: {
    gap: spacing.md,
    minHeight: 112,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
  },
  boutPressed: { opacity: 0.68, transform: [{ scale: 0.992 }] },
  featuredBout: { minHeight: 148, paddingVertical: spacing.xl },
  boutMeta: {
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  boutMetaCopy: { minWidth: 0, flex: 1, gap: spacing.xxs },
  boutMetaAction: {
    flexShrink: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  matchup: {
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
  },
  corner: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  cornerRight: { justifyContent: 'flex-end' },
  fighterCopy: { flex: 1, minWidth: 0, gap: spacing.xxs },
  fighterMeta: {
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  fighterCopyRight: { alignItems: 'flex-end' },
  fighterMetaRight: { justifyContent: 'flex-end' },
  portraitWell: {
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  flag: { width: 17, height: 11, borderRadius: 2 },
  versus: { width: spacing.xl, alignItems: 'center', flexShrink: 0 },
  modalContent: { width: '100%' },
  modalContext: { minWidth: 0 },
  modalMatchup: {
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  modalFighter: {
    flex: 1,
    minWidth: 0,
    alignItems: 'center',
    gap: spacing.xs,
  },
  modalVersus: {
    minHeight: 68,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalMeta: {
    width: '100%',
    alignItems: 'center',
  },
  tale: {
    width: '100%',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  taleRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
  },
  taleValue: {
    flex: 1,
    minWidth: 0,
  },
  taleLabel: {
    width: '30%',
    minWidth: 0,
  },
});
