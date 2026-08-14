import { StyleSheet, View } from 'react-native';

import {
  AppText,
  Button,
  Card,
  GlassIconWell,
  Symbol,
} from '@/components/primitives';
import { useResponsive } from '@/hooks/use-responsive';
import { useTheme } from '@/hooks/use-theme';
import { AgentUiIds } from '@/utils/agent-ui';

interface FinanceEzPassImportSourceCardsProps {
  busy: boolean;
  openingOfficialSite: boolean;
  onOpenOfficialSite: () => void;
  onPickDocument: () => void;
  onPickScreenshots: () => void;
}

function EzPassBrandMark() {
  const { s } = useResponsive();

  return (
    <View
      accessibilityLabel="E-ZPass New York"
      style={[
        styles.ezPassMark,
        {
          minWidth: s(108),
          minHeight: s(50),
          borderRadius: s(13),
          paddingHorizontal: s(11),
        },
      ]}>
      <View style={styles.ezPassWordmarkRow}>
        <AppText variant="callout" bold fit style={styles.ezPassWordmark}>
          E‑ZPASS
        </AppText>
        <View style={[styles.ezPassRoadMark, { width: s(19) }]} />
      </View>
      <AppText variant="overline" bold fit style={styles.ezPassNy}>
        NEW YORK
      </AppText>
    </View>
  );
}

function StepMark({ number }: { number: string }) {
  const theme = useTheme();
  const { s } = useResponsive();
  const size = s(34);

  return (
    <GlassIconWell size={size} borderRadius={size / 2}>
      <AppText variant="caption" bold style={{ color: theme.accentPrimary }}>
        {number}
      </AppText>
    </GlassIconWell>
  );
}

const FORMAT_BADGES = [
  { label: 'XLSX', color: '#217346' },
  { label: 'CSV', color: '#1769AA' },
  { label: 'PDF', color: '#C74343' },
] as const;

function FormatMarks() {
  const { s, spacing } = useResponsive();

  return (
    <View
      accessibilityLabel="Supports XLSX, CSV, and PDF"
      style={[styles.formatMarks, { gap: spacing.xs }]}>
      {FORMAT_BADGES.map((badge) => (
        <View
          key={badge.label}
          style={[
            styles.formatMark,
            {
              minWidth: s(38),
              minHeight: s(25),
              borderRadius: s(6),
              backgroundColor: badge.color,
              paddingHorizontal: s(6),
            },
          ]}>
          <AppText variant="overline" bold fit style={styles.formatMarkText}>
            {badge.label}
          </AppText>
        </View>
      ))}
    </View>
  );
}

function ScreenshotMark() {
  const theme = useTheme();
  const { s } = useResponsive();
  const size = s(34);

  return (
    <GlassIconWell size={size} borderRadius={s(9)}>
      <Symbol name="photo" size="sm" color={theme.accentPrimary} />
    </GlassIconWell>
  );
}

export function FinanceEzPassImportSourceCards({
  busy,
  openingOfficialSite,
  onOpenOfficialSite,
  onPickDocument,
  onPickScreenshots,
}: FinanceEzPassImportSourceCardsProps) {
  const { spacing: gap } = useResponsive();

  return (
    <>
      <Card style={styles.heroCard}>
        <View style={{ gap: gap.md }}>
          <View style={[styles.stepHeader, { gap: gap.sm }]}>
            <StepMark number="1" />
            <EzPassBrandMark />
            <View style={styles.stepCopy}>
              <AppText variant="callout" bold fit>Get a fresh statement</AppText>
              <AppText variant="caption" color="secondary">
                Sign in securely on the official site.
              </AppText>
            </View>
          </View>

          <View style={[styles.privacyRow, { gap: gap.xs }]}>
            <Symbol name="shield" size="sm" />
            <AppText variant="caption" color="secondary" style={styles.privacyCopy}>
              Your E‑ZPass credentials never pass through onTrack.
            </AppText>
          </View>

          <Button
            icon="open-external"
            trailing="chevron-right"
            disabled={busy}
            onPress={onOpenOfficialSite}
            testID={AgentUiIds.finance.ezpass.officialSite}>
            {openingOfficialSite ? 'Opening E-ZPass NY…' : 'Open E-ZPass NY'}
          </Button>
        </View>
      </Card>

      <Card airy>
        <View style={{ gap: gap.md }}>
          <View style={[styles.stepHeader, { gap: gap.sm }]}>
            <StepMark number="2" />
            <View style={styles.stepCopy}>
              <AppText variant="callout" bold fit>Choose what you saved</AppText>
              <AppText variant="caption" color="secondary">
                We’ll scan it locally and show every row before import.
              </AppText>
            </View>
          </View>

          <AppText variant="caption" color="secondary">
            Pick a downloaded statement or up to six screenshots.
          </AppText>

          <View style={[styles.acceptedFormats, { gap: gap.sm }]}>
            <AppText variant="overline" color="tertiary" fit>Accepted</AppText>
            <FormatMarks />
          </View>

          <View style={[styles.importActions, { gap: gap.sm }]}>
            <Button
              size="sm"
              variant="secondary"
              icon="download"
              trailing="chevron-right"
              disabled={busy}
              onPress={onPickDocument}
              style={styles.importAction}
              accessibilityLabel="Choose downloaded statement file"
              testID={AgentUiIds.finance.ezpass.file}>
              Statement file
            </Button>
            <Button
              size="sm"
              variant="secondary"
              leading={<ScreenshotMark />}
              trailing="chevron-right"
              disabled={busy}
              onPress={onPickScreenshots}
              style={styles.importAction}
              accessibilityLabel="Choose E-ZPass screenshots"
              testID={AgentUiIds.finance.ezpass.screenshots}>
              Screenshots
            </Button>
          </View>

          <View style={[styles.localRow, { gap: gap.xs }]}>
            <Symbol name="shield" size={14} />
            <AppText variant="caption" color="tertiary" style={styles.privacyCopy}>
              Files stay on this device unless you choose AI fallback.
            </AppText>
          </View>
        </View>
      </Card>
    </>
  );
}

const styles = StyleSheet.create({
  heroCard: {
    overflow: 'hidden',
  },
  stepHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: 0,
  },
  stepCopy: {
    flex: 1,
    flexShrink: 1,
    minWidth: 0,
  },
  privacyRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  localRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 2,
  },
  privacyCopy: {
    flex: 1,
    flexShrink: 1,
    minWidth: 0,
  },
  ezPassMark: {
    alignItems: 'stretch',
    justifyContent: 'center',
    backgroundColor: '#F4C542',
    borderWidth: 1,
    borderColor: '#FFE38A',
    borderCurve: 'continuous',
  },
  ezPassWordmarkRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  ezPassWordmark: {
    color: '#123F78',
    letterSpacing: -0.5,
  },
  ezPassRoadMark: {
    height: 3,
    marginLeft: 4,
    borderRadius: 2,
    backgroundColor: '#123F78',
  },
  ezPassNy: {
    color: '#123F78',
    letterSpacing: 1.4,
  },
  importActions: {
    flexDirection: 'column',
  },
  importAction: {
    width: '100%',
  },
  acceptedFormats: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  formatMarks: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  formatMark: {
    alignItems: 'center',
    justifyContent: 'center',
    borderCurve: 'continuous',
  },
  formatMarkText: {
    color: '#FFFFFF',
    letterSpacing: 0.2,
  },
});
