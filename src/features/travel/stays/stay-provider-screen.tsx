import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import {
    AppText,
    EmptyState,
    Screen,
    Symbol,
} from '@/components/primitives';
import { fontFamilies } from '@/design-system';
import {
    searchStays,
    stayProviders,
    staySearchInput,
    type StayProvider,
} from '@/features/travel/stays/provider';
import { StayProviderLogo } from '@/features/travel/stays/stay-provider-logo';
import { itinerarySheetChrome } from '@/features/travel/travel-itinerary-sheet-chrome';
import { TravelSheetIconControl } from '@/features/travel/travel-list-actions';
import {
    TRAVEL_EDITORIAL_ACCENT,
    TravelSurfaceCard,
    useTravelPageStyle,
} from '@/features/travel/travel-surface';
import type { TravelPlan } from '@/features/travel/types';
import { useResponsive } from '@/hooks/use-responsive';
import { useTheme } from '@/hooks/use-theme';
import { usePreferences } from '@/store/preferences';
import { useTravel } from '@/store/travel';
import { AgentTestId, AgentUiIds } from '@/utils/agent-ui';
import { formatDateKey } from '@/utils/date';
import { haptics } from '@/utils/haptics';
import { goBackOrReplace } from '@/utils/navigation';

function StayProviderRow({
  provider,
  plan,
  logoSize,
  chevronSize,
  accent,
  chrome,
  light,
}: {
  provider: StayProvider;
  plan: TravelPlan;
  logoSize: number;
  chevronSize: number;
  accent: string;
  chrome: ReturnType<typeof itinerarySheetChrome>;
  light: boolean;
}) {
  const { s, spacing: rs, typography, layout } = useResponsive();
  const testID = AgentUiIds.travel.staySearch.provider(provider.id);
  const label = `Search ${provider.name} for stays in ${plan.destination}`;
  const handlePress = () => {
    haptics.tap();
    void searchStays(provider, plan);
  };

  return (
    <AgentTestId testID={testID} label={label} onPress={handlePress}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        onPress={handlePress}
        style={({ pressed }) => [{ opacity: pressed ? 0.82 : 1 }]}>
        <TravelSurfaceCard padding={0}>
          <View
            style={[
              styles.providerRow,
              {
                paddingHorizontal: rs.md,
                paddingVertical: Math.max(14, rs.md),
                gap: rs.md,
                minHeight: Math.max(layout.minTapTarget + 28, s(88)),
              },
            ]}>
            <StayProviderLogo
              domain={provider.domain}
              icon={provider.icon}
              size={logoSize}
              accessibilityLabel={`${provider.name} logo`}
            />
            <View style={styles.providerCopy}>
              <AppText
                fit
                numberOfLines={1}
                style={[
                  styles.providerName,
                  {
                    color: chrome.title,
                    fontSize: Math.max(19, s(20)),
                    lineHeight: Math.max(24, s(26)),
                  },
                ]}>
                {provider.name}
              </AppText>
              <AppText
                numberOfLines={2}
                style={[
                  styles.providerDescription,
                  typography.caption,
                  {
                    color: chrome.subtitle,
                    fontSize: Math.max(13, s(14)),
                    lineHeight: Math.max(17, s(18)),
                  },
                ]}>
                {provider.description}
              </AppText>
            </View>
            <View
              style={[
                styles.chevronBadge,
                {
                  width: chevronSize,
                  height: chevronSize,
                  borderRadius: chevronSize / 2,
                  backgroundColor: light ? '#FFFFFF' : chrome.fieldBg,
                  borderColor: light ? 'rgba(160, 120, 80, 0.14)' : chrome.fieldBorder,
                },
              ]}>
              <Symbol name="chevron-right" size="sm" color={accent} />
            </View>
          </View>
        </TravelSurfaceCard>
      </Pressable>
    </AgentTestId>
  );
}

function DestinationStamp({
  destination,
  color,
}: {
  destination: string;
  color: string;
}) {
  const { s } = useResponsive();
  const label = destination.trim().toUpperCase() || 'DESTINATION';
  const width = Math.max(92, s(108));
  const height = Math.max(72, s(84));

  return (
    <View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        styles.stamp,
        {
          width,
          height,
          borderColor: color,
          borderRadius: Math.max(4, s(5)),
          transform: [{ rotate: '8deg' }],
          opacity: 0.28,
        },
      ]}>
      <View style={[styles.stampInner, { borderColor: color, borderRadius: Math.max(2, s(3)) }]}>
        <AppText
          fit
          numberOfLines={2}
          style={[
            styles.stampText,
            {
              color,
              fontSize: Math.max(9, s(10)),
              lineHeight: Math.max(11, s(12)),
              letterSpacing: 0.8,
            },
          ]}>
          {label}
        </AppText>
        <View style={[styles.stampWaves, { gap: Math.max(2, s(3)) }]}>
          {[0, 1, 2].map((index) => (
            <View
              key={index}
              style={[
                styles.stampWave,
                {
                  borderColor: color,
                  width: width * (0.55 - index * 0.06),
                  height: Math.max(6, s(7)),
                  borderRadius: Math.max(6, s(7)),
                },
              ]}
            />
          ))}
        </View>
      </View>
    </View>
  );
}

function MountainFooter({ color }: { color: string }) {
  const { s } = useResponsive();
  const height = Math.max(72, s(88));

  return (
    <View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.mountainWrap, { height }]}>
      <Svg width="100%" height={height} viewBox="0 0 390 88" preserveAspectRatio="xMidYMax meet">
        <Path
          d="M0 78 C42 70 58 42 88 48 C118 54 132 28 158 34 C184 40 196 18 228 26 C260 34 278 14 312 22 C346 30 362 48 390 56 L390 88 L0 88 Z"
          fill={color}
          opacity={0.14}
        />
        <Path
          d="M0 82 C36 76 52 58 78 60 C110 63 126 44 154 48 C182 52 198 36 230 42 C262 48 286 30 320 38 C350 45 368 56 390 62"
          stroke={color}
          strokeWidth={1.25}
          fill="none"
          opacity={0.35}
        />
        <Path
          d="M18 74 C48 62 70 40 96 46 C122 52 138 30 168 38 C198 46 214 24 248 34 C278 42 304 22 338 32 C358 38 374 50 390 54"
          stroke={color}
          strokeWidth={1}
          fill="none"
          opacity={0.22}
        />
      </Svg>
    </View>
  );
}

export function StayProviderScreen({ planId }: { planId: string }) {
  const theme = useTheme();
  const travelStyle = useTravelPageStyle(theme);
  const router = useRouter();
  const chrome = itinerarySheetChrome(theme);
  const { s, spacing: rs, typography } = useResponsive();
  const plan = useTravel((state) => state.plans.find((item) => item.id === planId));
  const dateDisplayFormat = usePreferences((state) => state.dateDisplayFormat);

  const light = theme.name === 'light';
  const accent = light ? TRAVEL_EDITORIAL_ACCENT : chrome.ctaFrom;
  const stampColor = light ? '#C4A882' : chrome.subtitle;
  const mountainColor = light ? '#B8956C' : chrome.subtitle;
  const secureColor = light ? '#3D8F63' : '#6FBF8D';
  const headingSize = Math.max(32, s(34));

  if (!plan) {
    return (
      <Screen style={travelStyle} refresh={false}>
        <EmptyState
          icon="lodging"
          title="This Trip Isn’t Here"
          message="This trip may have been removed."
        />
      </Screen>
    );
  }

  const search = staySearchInput(plan);
  const guestLabel = `${search.guests} ${search.guests === 1 ? 'Guest' : 'Guests'}`;
  const dateLabel = `${formatDateKey(search.checkIn, dateDisplayFormat)} → ${formatDateKey(search.checkOut, dateDisplayFormat)}`;
  const logoSize = Math.max(48, s(52));
  const chevronSize = Math.max(32, s(34));
  const pinSize = Math.max(40, s(42));

  return (
    <Screen
      style={travelStyle}
      contentStyle={{
        ...styles.screen,
        gap: rs.lg,
        paddingBottom: Math.max(96, s(110)),
      }}
      refresh={false}>
      <DestinationStamp destination={plan.destination} color={stampColor} />
      <MountainFooter color={mountainColor} />

      <View style={[styles.header, { gap: rs.md }]}>
        <TravelSheetIconControl
          icon="back"
          size={Math.max(40, s(42))}
          tone="accent"
          testID={AgentUiIds.travel.staySearch.back}
          accessibilityLabel="Back to trip"
          onPress={() =>
            goBackOrReplace(router, { pathname: '/travel/[id]', params: { id: planId } })
          }
        />
        <View style={[styles.headerCopy, { gap: rs.sm }]}>
          <AppText
            variant="overline"
            fit
            numberOfLines={1}
            style={[styles.eyebrow, { color: accent }]}>
            STAY SEARCH
          </AppText>
          <Text
            style={[
              styles.title,
              {
                color: chrome.title,
                fontSize: headingSize,
                lineHeight: headingSize,
                paddingTop: Math.max(8, s(10)),
                paddingBottom: Math.max(2, s(2)),
              },
            ]}>
            Where to check?
          </Text>
          <AppText
            numberOfLines={2}
            style={[
              styles.subtitle,
              typography.callout,
              {
                color: chrome.subtitle,
                fontSize: Math.max(15, s(16)),
                lineHeight: Math.max(20, s(21)),
              },
            ]}>
            Choose a provider. Your destination, dates, and travelers are ready to go.
          </AppText>
        </View>
      </View>

      <TravelSurfaceCard padding={0}>
        <View style={[styles.summaryBody, { padding: rs.lg, gap: rs.md }]}>
          <View style={[styles.summaryRow, { gap: rs.md }]}>
            <View
              style={[
                styles.pinBadge,
                {
                  width: pinSize,
                  height: pinSize,
                  borderRadius: pinSize / 2,
                  backgroundColor: light ? '#FFFFFF' : chrome.fieldBg,
                  borderColor: light ? 'rgba(160, 120, 80, 0.16)' : chrome.fieldBorder,
                },
              ]}>
              <Symbol name="location" size="sm" color={accent} />
            </View>
            <AppText
              fit
              numberOfLines={1}
              style={[
                styles.destination,
                {
                  color: chrome.title,
                  fontSize: Math.max(20, s(22)),
                  lineHeight: Math.max(26, s(28)),
                },
              ]}>
              {search.destination}
            </AppText>
          </View>

          <View style={[styles.summaryMeta, { gap: rs.md }]}>
            <View style={[styles.metaItem, { gap: Math.max(6, rs.xs) }]}>
              <Symbol name="calendar" size="sm" color={accent} />
              <AppText
                fit
                numberOfLines={1}
                style={[
                  styles.metaText,
                  typography.caption,
                  { color: chrome.subtitle, fontSize: Math.max(13, s(14)) },
                ]}>
                {dateLabel}
              </AppText>
            </View>
            <View
              style={[
                styles.metaDivider,
                {
                  backgroundColor: light ? 'rgba(160, 120, 80, 0.22)' : chrome.fieldBorder,
                },
              ]}
            />
            <View style={[styles.metaItem, { gap: Math.max(6, rs.xs) }]}>
              <Symbol name="people" size="sm" color={accent} />
              <AppText
                fit
                numberOfLines={1}
                style={[
                  styles.metaText,
                  typography.caption,
                  { color: chrome.subtitle, fontSize: Math.max(13, s(14)) },
                ]}>
                {guestLabel}
              </AppText>
            </View>
          </View>
        </View>
      </TravelSurfaceCard>

      <View style={[styles.providers, { gap: rs.md }]}>
        {stayProviders.map((provider) => (
          <StayProviderRow
            key={provider.id}
            provider={provider}
            plan={plan}
            logoSize={logoSize}
            chevronSize={chevronSize}
            accent={accent}
            chrome={chrome}
            light={light}
          />
        ))}
      </View>

      <View style={[styles.secureRow, { gap: rs.sm, marginTop: rs.xs }]}>
        <Symbol name="shield" size="sm" color={secureColor} />
        <AppText
          numberOfLines={2}
          style={[
            styles.secureText,
            typography.caption,
            {
              color: chrome.subtitle,
              fontSize: Math.max(12, s(13)),
              lineHeight: Math.max(16, s(17)),
            },
          ]}>
          Results open securely on each provider’s website.
        </AppText>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: {
    position: 'relative',
  },
  header: {},
  headerCopy: {
    flexShrink: 1,
    minWidth: 0,
  },
  eyebrow: {
    letterSpacing: 1.4,
  },
  title: {
    fontFamily: fontFamilies.serif,
    fontWeight: '400',
    letterSpacing: -0.65,
  },
  subtitle: {
    fontFamily: fontFamilies.serif,
    fontWeight: '400',
  },
  summaryBody: {},
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  pinBadge: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    boxShadow: '0 2px 8px rgba(51, 39, 28, 0.08)',
    flexShrink: 0,
  },
  destination: {
    flex: 1,
    flexShrink: 1,
    minWidth: 0,
    fontFamily: fontFamilies.serif,
    fontWeight: '400',
  },
  summaryMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'nowrap',
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 1,
    minWidth: 0,
  },
  metaText: {
    flexShrink: 1,
    minWidth: 0,
  },
  metaDivider: {
    width: StyleSheet.hairlineWidth,
    alignSelf: 'stretch',
    minHeight: 16,
  },
  providers: {},
  providerRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  providerCopy: {
    flex: 1,
    flexShrink: 1,
    minWidth: 0,
    gap: 2,
  },
  providerName: {
    fontFamily: fontFamilies.serif,
    fontWeight: '400',
  },
  providerDescription: {
    fontWeight: '400',
  },
  chevronBadge: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    boxShadow: '0 2px 8px rgba(51, 39, 28, 0.08)',
    flexShrink: 0,
  },
  secureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  secureText: {
    flexShrink: 1,
    minWidth: 0,
    fontStyle: 'italic',
    textAlign: 'center',
  },
  stamp: {
    position: 'absolute',
    top: 8,
    right: 4,
    zIndex: 1,
    borderWidth: 1.5,
    padding: 4,
  },
  stampInner: {
    flex: 1,
    borderWidth: 1,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
    paddingVertical: 6,
    gap: 4,
  },
  stampText: {
    fontFamily: fontFamilies.serif,
    fontWeight: '400',
    textAlign: 'center',
  },
  stampWaves: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  stampWave: {
    borderWidth: 1,
    borderStyle: 'dashed',
  },
  mountainWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 0,
  },
});
