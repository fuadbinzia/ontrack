import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
    Pressable,
    StyleSheet,
    View,
} from 'react-native';

import {
    AppText,
    Card,
    DateField,
    EmptyState,
    Input,
    Screen,
    SectionHeader,
    Symbol,
} from '@/components/primitives';
import { featureFlags } from '@/constants/feature-flags';
import { fontFamilies, radii, spacing } from '@/design-system';
import {
    compareOnGoogleFlights,
    isValidFlightLocation,
} from '@/features/travel/provider';
import {
    itinerarySheetChrome,
    travelInputFieldBackground,
} from '@/features/travel/travel-itinerary-sheet-chrome';
import { TravelSheetIconControl, TravelSheetSecondaryAction } from '@/features/travel/travel-list-actions';
import {
    TRAVEL_EDITORIAL_ACCENT,
    TravelSurfaceCard,
    useTravelPageStyle,
} from '@/features/travel/travel-surface';
import { useResponsive } from '@/hooks/use-responsive';
import { useTheme } from '@/hooks/use-theme';
import { usePreferences } from '@/store/preferences';
import { useTravel } from '@/store/travel';
import { AgentTestId, AgentUiIds } from '@/utils/agent-ui';
import { haptics } from '@/utils/haptics';
import { getNumberFormatter } from '@/utils/intl-cache';
import { goBackOrReplace } from '@/utils/navigation';

import { FlightSearchError, searchFlights } from './client';
import { getCurrentDepartureLocation } from './departure-location';
import {
    FlightSearchErrorBanner,
    FlightSearchLegSummary,
    GOOGLE_FLIGHTS_NOTICE,
    type FlightSearchNotice,
} from './flight-search-presentational';
import type { FlightSearchResponse } from './types';

export { GOOGLE_FLIGHTS_NOTICE };
export type { FlightSearchNotice };

const VALIDATION_NOTICE: FlightSearchNotice = {
  title: 'Check your search details',
  detail:
    'Add a From and To city or airport, choose 1–9 travelers, and a 3-letter currency like USD.',
};

function formatPrice(value: string, currency: string): string {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return `${currency} ${value}`;
  try {
    return getNumberFormatter(undefined, {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `${currency} ${Math.round(amount)}`;
  }
}

export function FlightSearchScreen({
  planId,
  initialNotice,
}: {
  planId: string;
  /** DEV-only preview of the error banner. */
  initialNotice?: FlightSearchNotice;
}) {
  const theme = useTheme();
  const travelStyle = useTravelPageStyle(theme);
  const router = useRouter();
  const chrome = itinerarySheetChrome(theme);
  const { s, spacing: rs, layout, typography } = useResponsive();
  const plan = useTravel((state) => state.plans.find((item) => item.id === planId));
  const dateDisplayFormat = usePreferences((state) => state.dateDisplayFormat);
  const controllerRef = useRef<AbortController | undefined>(undefined);
  const mountedRef = useRef(true);
  const originEditedRef = useRef(false);
  const [origin, setOrigin] = useState(plan?.origin ?? '');
  const [destination, setDestination] = useState(plan?.destination ?? '');
  const [departureDate, setDepartureDate] = useState(plan?.startDate ?? '');
  const [returnDate, setReturnDate] = useState(plan?.endDate ?? '');
  const [adults, setAdults] = useState('1');
  const [currencyCode, setCurrencyCode] = useState('USD');
  const [result, setResult] = useState<FlightSearchResponse>();
  const [error, setError] = useState<FlightSearchNotice | undefined>(initialNotice);
  const [loading, setLoading] = useState(false);
  const [comparing, setComparing] = useState(false);

  const light = theme.name === 'light';
  const accent = light ? TRAVEL_EDITORIAL_ACCENT : chrome.ctaFrom;
  const field = (tone: keyof typeof chrome.icons) => {
    const icon = chrome.icons[tone];
    return {
      iconBackground: icon.bg,
      iconColor: icon.fg,
      fieldBackground: travelInputFieldBackground(theme),
      stackedLabelColor: accent,
      placeholderColor: chrome.placeholder,
      placeholderTextColor: chrome.placeholder,
    };
  };

  useEffect(() => {
    if (initialNotice) {
      queueMicrotask(() => setError(initialNotice));
    }
  }, [initialNotice]);

  useEffect(() => {
    let active = true;
    void getCurrentDepartureLocation().then((suggestion) => {
      if (!active) return;
      if (suggestion.status === 'suggested' && !originEditedRef.current) {
        setOrigin(suggestion.label);
      }
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      controllerRef.current?.abort();
    };
  }, []);

  if (!plan) {
    return (
      <Screen style={travelStyle} refresh={false}>
        <EmptyState icon="flight" title="Trip Not Found" message="This trip may have been removed." />
      </Screen>
    );
  }

  const runSearch = async () => {
    const travelerCount = Number(adults);
    setError(undefined);
    if (
      origin.trim().length < 3 ||
      destination.trim().length < 3 ||
      !Number.isInteger(travelerCount) ||
      travelerCount < 1 ||
      travelerCount > 9 ||
      !/^[A-Z]{3}$/.test(currencyCode.trim().toUpperCase())
    ) {
      return setError(VALIDATION_NOTICE);
    }
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    setLoading(true);
    try {
      setResult(
        await searchFlights(
          {
            origin: origin.trim(),
            destination: destination.trim(),
            departureDate,
            returnDate,
            adults: travelerCount,
            currencyCode: currencyCode.trim().toUpperCase(),
          },
          controller.signal,
        ),
      );
    } catch (searchError) {
      if (searchError instanceof Error && searchError.name === 'AbortError') return;
      setError(
        searchError instanceof FlightSearchError
          ? {
              title: 'Live prices unavailable',
              detail: searchError.message,
            }
          : {
              title: 'Live prices unavailable',
              detail: 'Flight search is temporarily unavailable. Try again in a moment.',
            },
      );
    } finally {
      if (controllerRef.current === controller) setLoading(false);
    }
  };

  const cancelSearch = () => {
    controllerRef.current?.abort();
  };

  const compareFlights = async () => {
    setError(undefined);
    setComparing(true);
    try {
      await compareOnGoogleFlights({
        origin,
        destination,
        departureDate,
        returnDate,
        adults: Math.max(1, Number(adults) || 1),
        currencyCode,
      });
    } catch {
      setError(GOOGLE_FLIGHTS_NOTICE);
    } finally {
      setComparing(false);
    }
  };

  const canCompare =
    !comparing && isValidFlightLocation(origin) && isValidFlightLocation(destination);
  const ctaMinHeight = Math.max(layout.minTapTarget, s(52));
  const ctaColors = light
    ? ([theme.accentSoft, theme.accentPrimary, '#175C88'] as const)
    : ([chrome.ctaFrom, chrome.ctaTo] as const);
  const headingSize = Math.max(32, s(34));

  return (
    <Screen
      style={travelStyle}
      contentStyle={{ gap: rs.lg }}
      refresh={false}>
      <View style={[styles.header, { gap: rs.md }]}>
        <TravelSheetIconControl
          icon="back"
          size={Math.max(40, s(42))}
          tone="accent"
          testID={AgentUiIds.travel.flightSearch.back}
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
            FLIGHT SEARCH
          </AppText>
          <AppText
            fit
            fitMinimumScale={0.55}
            numberOfLines={2}
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
            Flights for {plan.title}
          </AppText>
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
            Live availability and total prices without leaving onTrack.
          </AppText>
        </View>
      </View>

      <TravelSurfaceCard padding={0}>
        <View style={[styles.cardBody, { padding: rs.lg, gap: rs.md }]}>
          <View style={{ gap: rs.sm }}>
            <Input
              value={origin}
              onChangeText={(value) => {
                originEditedRef.current = true;
                setOrigin(value);
              }}
              icon="flight"
              stackedLabel="FROM"
              placeholder="JFK or New York"
              autoCapitalize="words"
              accessibilityLabel="From"
              testID={AgentUiIds.travel.flightSearch.from}
              {...field('flight')}
            />
            <Input
              value={destination}
              onChangeText={setDestination}
              icon="location"
              stackedLabel="TO"
              placeholder="KEF or Reykjavik"
              autoCapitalize="words"
              accessibilityLabel="To"
              testID={AgentUiIds.travel.flightSearch.to}
              {...field('location')}
            />
          </View>

          <View style={[styles.twoColumns, { gap: rs.sm }]}>
            <View style={styles.flex}>
              <DateField
                value={departureDate}
                stackedLabel="DEPARTURE"
                placeholder="Select date"
                accessibilityLabel="Departure date"
                testID={AgentUiIds.travel.flightSearch.departure}
                onChange={(value) => {
                  setDepartureDate(value);
                  if (returnDate < value) setReturnDate(value);
                }}
                {...field('calendar')}
              />
            </View>
            <View style={styles.flex}>
              <DateField
                value={returnDate}
                stackedLabel="RETURN"
                placeholder="Select date"
                minimumDate={departureDate}
                accessibilityLabel="Return date"
                testID={AgentUiIds.travel.flightSearch.return}
                onChange={setReturnDate}
                {...field('calendar')}
              />
            </View>
          </View>

          <View style={[styles.twoColumns, { gap: rs.sm }]}>
            <View style={styles.flex}>
              <Input
                value={adults}
                onChangeText={setAdults}
                icon="personal"
                stackedLabel="TRAVELERS"
                stackedAlign="center"
                keyboardType="number-pad"
                placeholder="1"
                accessibilityLabel="Travelers"
                testID={AgentUiIds.travel.flightSearch.travelers}
                {...field('note')}
              />
            </View>
            <View style={styles.flex}>
              <Input
                value={currencyCode}
                onChangeText={(v) => setCurrencyCode(v.replace(/[^A-Za-z]/g, '').toUpperCase())}
                icon="currency"
                stackedLabel="CURRENCY"
                stackedAlign="center"
                autoCapitalize="characters"
                autoCorrect={false}
                maxLength={3}
                placeholder="USD"
                accessibilityLabel="Currency"
                testID={AgentUiIds.travel.flightSearch.currency}
                {...field('currency')}
              />
            </View>
          </View>

          {error ? <FlightSearchErrorBanner notice={error} /> : null}

          {featureFlags.liveFlightSearch ? (
            <TravelSheetSecondaryAction
              icon={loading ? 'close' : 'search'}
              label={loading ? 'Cancel Live Price Check' : 'Search Flights'}
              testID={AgentUiIds.travel.flightSearch.searchLive}
              onPress={loading ? cancelSearch : () => void runSearch()}
            />
          ) : null}

          <AgentTestId
            testID={AgentUiIds.travel.flightSearch.compareGoogle}
            label={comparing ? 'Opening Google Flights' : 'Compare on Google Flights'}
            onPress={canCompare ? () => { haptics.tap(); void compareFlights(); } : undefined}
            style={styles.ctaWrap}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={
                comparing ? 'Opening Google Flights' : 'Compare on Google Flights'
              }
              accessibilityState={{ disabled: !canCompare }}
              disabled={!canCompare}
              onPress={() => {
                if (!canCompare) return;
                haptics.tap();
                void compareFlights();
              }}
              style={({ pressed }) => [
                {
                  minHeight: ctaMinHeight,
                  borderRadius: radii.pill,
                  opacity: !canCompare ? 0.45 : pressed ? 0.88 : 1,
                  boxShadow: light
                    ? '0 4px 14px rgba(36, 116, 168, 0.32), 0 1px 3px rgba(11, 28, 40, 0.14)'
                    : '0 8px 18px rgba(0, 0, 0, 0.35)',
                },
              ]}>
            <LinearGradient
              colors={[...ctaColors]}
              locations={light ? [0, 0.45, 1] : undefined}
              start={{ x: 0, y: 0.5 }}
              end={{ x: 1, y: 0.5 }}
              style={[
                styles.ctaGradient,
                {
                  minHeight: ctaMinHeight,
                  paddingHorizontal: rs.lg,
                  gap: rs.sm,
                  borderRadius: radii.pill,
                },
              ]}>
              <Symbol name="open-external" size="sm" color={chrome.ctaText} />
              <AppText
                variant="callout"
                fit
                numberOfLines={1}
                style={[
                  styles.ctaLabel,
                  {
                    color: chrome.ctaText,
                    fontSize: s(18),
                    lineHeight: s(23),
                    flexShrink: 1,
                    minWidth: 0,
                  },
                ]}>
                {comparing ? 'Opening Google Flights…' : 'Compare on Google Flights'}
              </AppText>
            </LinearGradient>
            </Pressable>
          </AgentTestId>
        </View>
      </TravelSurfaceCard>

      {result ? (
        <>
          <View style={styles.resultsHeader}>
            <SectionHeader
              title={`${result.originCode} → ${result.destinationCode}`}
              detail={`${result.offers.length} options`}
            />
            <AppText variant="caption" color={result.dataMode === 'live' ? 'success' : 'secondary'}>
              {result.dataMode === 'live' ? 'Live Prices' : 'Test Data'}
            </AppText>
          </View>
          <AppText variant="caption" color="secondary">
            Checked{' '}
            {new Date(result.searchedAt).toLocaleTimeString([], {
              hour: 'numeric',
              minute: '2-digit',
            })}
            {' · '}
            Prices can change until ticketing.
          </AppText>
          {result.offers.length === 0 ? (
            <EmptyState
              icon="flight"
              title="No Flights Found"
              message="Try nearby airport codes or different dates."
              actionLabel="Search Again"
              onAction={() => void runSearch()}
            />
          ) : null}
          {result.offers.map((offer) => (
            <Card key={offer.id} variant="elevated" style={styles.offerCard}>
              <View style={styles.offerHeader}>
                <View style={styles.flex}>
                  <AppText variant="subheading">{offer.outbound.carrier || 'Airline'}</AppText>
                  <AppText variant="caption" color="secondary">
                    {offer.outbound.flightNumber}
                    {offer.seatsAvailable ? ` · ${offer.seatsAvailable} seats left` : ''}
                  </AppText>
                </View>
                <View style={styles.price}>
                  <AppText variant="subheading" color="accent">
                    {formatPrice(offer.totalPrice, offer.currency)}
                  </AppText>
                  <AppText variant="caption" color="secondary">
                    total · {adults} {Number(adults) === 1 ? 'traveler' : 'travelers'}
                  </AppText>
                </View>
              </View>
              <FlightSearchLegSummary
                label="Outbound"
                leg={offer.outbound}
                dateDisplayFormat={dateDisplayFormat}
                labelColor={accent}
              />
              {offer.inbound ? (
                <FlightSearchLegSummary
                  label="Return"
                  leg={offer.inbound}
                  dateDisplayFormat={dateDisplayFormat}
                  labelColor={accent}
                />
              ) : null}
            </Card>
          ))}
          {result.offers.length > 0 ? (
            <TravelSheetSecondaryAction
              label="Refresh prices"
              onPress={() => void runSearch()}
            />
          ) : null}
        </>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
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
  cardBody: {},
  twoColumns: { flexDirection: 'row' },
  flex: { flex: 1, flexShrink: 1, minWidth: 0 },
  ctaWrap: {
    width: '100%',
    overflow: 'hidden',
    borderCurve: 'continuous',
  },
  ctaGradient: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaLabel: {
    fontFamily: fontFamilies.serif,
    fontWeight: '400',
  },
  resultsHeader: { gap: spacing.xs },
  offerCard: { gap: spacing.lg },
  offerHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  price: { alignItems: 'flex-end', gap: spacing.xxs },
});
