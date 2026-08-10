import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import {
    AppState,
    InputAccessoryView,
    Keyboard,
    Platform,
    Pressable,
    useWindowDimensions,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText, Button, LoadingBlock, Symbol } from '@/components/primitives';
import { radii } from '@/design-system';
import { currencyPairForTrip } from '@/features/travel/currency-for-destination';
import { currencyDisplayLabel } from '@/features/travel/expenses/currency-dropdown';
import { normalizeCurrencyCode } from '@/features/travel/expenses/format-money';
import {
    convertAmount,
    currencyOptionsForTrip,
    loadFxRates,
    type FxRates,
} from '@/features/travel/expenses/fx-rates';
import { currencySheetChrome } from '@/features/travel/travel-currency-chrome';
import { TravelCurrencyRatePanel } from '@/features/travel/travel-currency-rate-panel';
import { TravelCurrencySideCard } from '@/features/travel/travel-currency-side-card';
import { TravelSheetModal } from '@/features/travel/travel-sheet';
import type { TravelPlan } from '@/features/travel/types';
import { useResponsive } from '@/hooks/use-responsive';
import { useTheme } from '@/hooks/use-theme';
import { usePreferences } from '@/store/preferences';
import { AgentTestId, AgentUiIds } from '@/utils/agent-ui';
import { haptics } from '@/utils/haptics';
import { sanitizeNumericInput } from '@/utils/parse';
import { travelCurrencySheetStyles as styles } from './travel-currency-sheet.styles';
import {
  convertWithUnitRate,
  formatAmountInput,
  formatFxMoney,
  formatPlainAmount,
  formatRateDate,
  formatRateInput,
  parseAmountText,
} from './travel-currency-formatters';

type ActiveSide = 'origin' | 'destination';

export function TravelCurrencySheet({
  plan,
  visible,
  onClose,
}: {
  plan: TravelPlan;
  visible: boolean;
  onClose: () => void;
}) {
  const sheetKey = `${plan.id}-${visible ? 'open' : 'closed'}`;
  return (
    <TravelCurrencySheetContent
      key={sheetKey}
      plan={plan}
      visible={visible}
      onClose={onClose}
    />
  );
}

function TravelCurrencySheetContent({
  plan,
  visible,
  onClose,
}: {
  plan: TravelPlan;
  visible: boolean;
  onClose: () => void;
}) {
  const theme = useTheme();
  const chrome = currencySheetChrome(theme);
  const { s, spacing: rs, layout } = useResponsive();
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const dateLocale = usePreferences((state) => state.dateLocale);
  const accessoryId = useId().replace(/:/g, '');
  const pair = useMemo(
    () => currencyPairForTrip(plan.destination, plan.baseCurrency),
    [plan.destination, plan.baseCurrency],
  );
  const sheetMinHeight = Math.round(
    Math.max(320, windowHeight - insets.top - rs.sm) * 0.92,
  );
  const destinationLabel = plan.destination.trim() || undefined;

  const [rates, setRates] = useState<FxRates | undefined>();
  const [stale, setStale] = useState(false);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [originCurrency, setOriginCurrency] = useState(pair.origin);
  const [destinationCurrency, setDestinationCurrency] = useState(pair.destination);
  const [originText, setOriginText] = useState('100.00');
  const [destinationText, setDestinationText] = useState('');
  const [rateText, setRateText] = useState('');
  const [rateOverride, setRateOverride] = useState<number | undefined>();
  const [activeSide, setActiveSide] = useState<ActiveSide>('origin');
  const [openDropdown, setOpenDropdown] = useState<'origin' | 'destination' | null>(null);

  // Refs to capture mutable values that don't drive refetch timing
  const originTextRef = useRef(originText);
  const destinationTextRef = useRef(destinationText);
  const activeSideRef = useRef(activeSide);
  const rateOverrideRef = useRef(rateOverride);

  useEffect(() => { originTextRef.current = originText; }, [originText]);
  useEffect(() => { destinationTextRef.current = destinationText; }, [destinationText]);
  useEffect(() => { activeSideRef.current = activeSide; }, [activeSide]);
  useEffect(() => { rateOverrideRef.current = rateOverride; }, [rateOverride]);

  const marketRate = rates
    ? convertAmount(1, originCurrency, destinationCurrency, rates)
    : undefined;
  const effectiveRate = rateOverride ?? marketRate;
  const isCustomRate = rateOverride !== undefined;

  const recomputeAmounts = useCallback(
    (
      side: ActiveSide,
      nextOriginText: string,
      nextDestinationText: string,
      nextOriginCurrency: string,
      nextDestinationCurrency: string,
      unitRate: number | undefined,
    ) => {
      if (!(unitRate !== undefined && unitRate > 0)) {
        if (side === 'origin') setDestinationText('');
        else setOriginText('');
        return;
      }
      if (side === 'origin') {
        setDestinationText(
          convertWithUnitRate(
            nextOriginText,
            nextOriginCurrency,
            nextDestinationCurrency,
            nextOriginCurrency,
            nextDestinationCurrency,
            unitRate,
          ),
        );
        return;
      }
      setOriginText(
        convertWithUnitRate(
          nextDestinationText,
          nextDestinationCurrency,
          nextOriginCurrency,
          nextOriginCurrency,
          nextDestinationCurrency,
          unitRate,
        ),
      );
    },
    [],
  );

  const syncRateTextFromMarket = useCallback((nextMarket: number | undefined) => {
    if (nextMarket !== undefined && nextMarket > 0) {
      setRateText(formatRateInput(nextMarket));
    } else {
      setRateText('');
    }
  }, []);

  const refreshRates = useCallback(
    async (options?: {
      force?: boolean;
      signal?: AbortSignal;
      soft?: boolean;
      clearOverride?: boolean;
    }) => {
      const force = options?.force ?? true;
      if (options?.soft) setRefreshing(true);
      else setLoading(true);
      try {
        if (force) {
          const cached = await loadFxRates({ force: false, signal: options?.signal });
          if (!options?.signal?.aborted && cached.rates) {
            setRates(cached.rates);
            setStale(true);
            setLoading(false);
          }
        }
        const result = await loadFxRates({ force, signal: options?.signal });
        if (options?.signal?.aborted) return;
        setRates(result.rates);
        setStale(result.stale);
        const nextMarketRate = result.rates
          ? convertAmount(1, originCurrency, destinationCurrency, result.rates)
          : undefined;
        const shouldUseMarket = options?.clearOverride || rateOverrideRef.current === undefined;
        if (options?.clearOverride) setRateOverride(undefined);
        if (shouldUseMarket) {
          syncRateTextFromMarket(nextMarketRate);
          recomputeAmounts(
            activeSideRef.current,
            originTextRef.current,
            destinationTextRef.current,
            originCurrency,
            destinationCurrency,
            nextMarketRate,
          );
        }
      } catch {
        // Keep whatever rates we already show.
      } finally {
        if (!options?.signal?.aborted) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [destinationCurrency, originCurrency, recomputeAmounts, syncRateTextFromMarket],
  );

  useEffect(() => {
    if (!visible) return;
    const controller = new AbortController();
    let active = true;
    void loadFxRates({ force: false, signal: controller.signal })
      .then((cached) => {
        if (!active || controller.signal.aborted || !cached.rates) return;
        setRates(cached.rates);
        setStale(true);
        setLoading(false);
        const nextMarketRate = convertAmount(
          1,
          originCurrency,
          destinationCurrency,
          cached.rates,
        );
        if (rateOverrideRef.current === undefined) {
          syncRateTextFromMarket(nextMarketRate);
          recomputeAmounts(
            activeSideRef.current,
            originTextRef.current,
            destinationTextRef.current,
            originCurrency,
            destinationCurrency,
            nextMarketRate,
          );
        }
      })
      .catch(() => undefined);
    void loadFxRates({ force: true, signal: controller.signal })
      .then((result) => {
        if (!active || controller.signal.aborted) return;
        setRates(result.rates);
        setStale(result.stale);
        setLoading(false);
        const nextMarketRate = result.rates
          ? convertAmount(1, originCurrency, destinationCurrency, result.rates)
          : undefined;
        if (rateOverrideRef.current === undefined) {
          syncRateTextFromMarket(nextMarketRate);
          recomputeAmounts(
            activeSideRef.current,
            originTextRef.current,
            destinationTextRef.current,
            originCurrency,
            destinationCurrency,
            nextMarketRate,
          );
        }
      })
      .catch(() => undefined)
      .finally(() => {
        if (active && !controller.signal.aborted) {
          setLoading(false);
          setRefreshing(false);
        }
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, [visible, originCurrency, destinationCurrency]);

  useEffect(() => {
    if (!visible) return;
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        void loadFxRates({ force: true })
          .then((result) => {
            setRates(result.rates);
            setStale(result.stale);
            const nextMarketRate = result.rates
              ? convertAmount(1, originCurrency, destinationCurrency, result.rates)
              : undefined;
            if (rateOverrideRef.current === undefined) {
              syncRateTextFromMarket(nextMarketRate);
              recomputeAmounts(
                activeSideRef.current,
                originTextRef.current,
                destinationTextRef.current,
                originCurrency,
                destinationCurrency,
                nextMarketRate,
              );
            }
          })
          .catch(() => undefined);
      }
    });
    return () => sub.remove();
  }, [visible, originCurrency, destinationCurrency]);

  const currencyOptions = useMemo(
    () =>
      currencyOptionsForTrip([
        originCurrency,
        destinationCurrency,
        plan.baseCurrency,
      ]).map((option) => ({
        value: option.value,
        label: currencyDisplayLabel(option.value),
      })),
    [originCurrency, destinationCurrency, plan.baseCurrency],
  );

  const swapCurrencies = () => {
    haptics.select();
    Keyboard.dismiss();
    setOpenDropdown(null);
    const nextOrigin = destinationCurrency;
    const nextDestination = originCurrency;
    const nextOriginText = destinationText;
    const nextDestinationText = originText;
    const nextOverride =
      rateOverride !== undefined && rateOverride > 0 ? 1 / rateOverride : undefined;
    const nextMarketRate = rates
      ? convertAmount(1, nextOrigin, nextDestination, rates)
      : undefined;
    setOriginCurrency(nextOrigin);
    setDestinationCurrency(nextDestination);
    setOriginText(nextOriginText);
    setDestinationText(nextDestinationText);
    if (nextOverride !== undefined) {
      setRateOverride(nextOverride);
      setRateText(formatRateInput(nextOverride));
    } else {
      setRateOverride(undefined);
      syncRateTextFromMarket(nextMarketRate);
    }
    setActiveSide(activeSide === 'origin' ? 'destination' : 'origin');
  };

  const onOriginAmountChange = (text: string) => {
    const next = sanitizeNumericInput(text);
    setActiveSide('origin');
    setOriginText(next);
    if (effectiveRate !== undefined && effectiveRate > 0) {
      setDestinationText(
        convertWithUnitRate(
          next,
          originCurrency,
          destinationCurrency,
          originCurrency,
          destinationCurrency,
          effectiveRate,
        ),
      );
    }
  };

  const onDestinationAmountChange = (text: string) => {
    const next = sanitizeNumericInput(text);
    setActiveSide('destination');
    setDestinationText(next);
    if (effectiveRate !== undefined && effectiveRate > 0) {
      setOriginText(
        convertWithUnitRate(
          next,
          destinationCurrency,
          originCurrency,
          originCurrency,
          destinationCurrency,
          effectiveRate,
        ),
      );
    }
  };

  const onOriginCurrencyChange = (currency: string) => {
    const next = normalizeCurrencyCode(currency);
    const nextMarketRate = rates
      ? convertAmount(1, next, destinationCurrency, rates)
      : undefined;
    setActiveSide('origin');
    setOriginCurrency(next);
    setRateOverride(undefined);
    syncRateTextFromMarket(nextMarketRate);
    recomputeAmounts('origin', originText, destinationText, next, destinationCurrency, nextMarketRate);
  };

  const onDestinationCurrencyChange = (currency: string) => {
    const next = normalizeCurrencyCode(currency);
    const nextMarketRate = rates
      ? convertAmount(1, originCurrency, next, rates)
      : undefined;
    setActiveSide('origin');
    setDestinationCurrency(next);
    setRateOverride(undefined);
    syncRateTextFromMarket(nextMarketRate);
    recomputeAmounts('origin', originText, destinationText, originCurrency, next, nextMarketRate);
  };

  const onRateChange = (text: string) => {
    const next = sanitizeNumericInput(text);
    setRateText(next);
    const value = parseAmountText(next);
    if (value !== undefined && value > 0) {
      setRateOverride(value);
      recomputeAmounts(
        activeSide,
        originText,
        destinationText,
        originCurrency,
        destinationCurrency,
        value,
      );
      return;
    }
    if (!next.trim()) {
      setRateOverride(undefined);
      syncRateTextFromMarket(marketRate);
      recomputeAmounts(
        activeSide,
        originText,
        destinationText,
        originCurrency,
        destinationCurrency,
        marketRate,
      );
    }
  };

  const useMarketRate = () => {
    setRateOverride(undefined);
    syncRateTextFromMarket(marketRate);
    recomputeAmounts(
      activeSide,
      originText,
      destinationText,
      originCurrency,
      destinationCurrency,
      marketRate,
    );
  };

  const originAmount = parseAmountText(originText);
  const convertedPreview =
    effectiveRate !== undefined &&
    effectiveRate > 0 &&
    originAmount !== undefined
      ? originAmount * effectiveRate
      : undefined;

  const summaryPrimary =
    convertedPreview !== undefined && originAmount !== undefined
      ? `${formatFxMoney(originAmount, originCurrency, dateLocale)} = ${formatPlainAmount(convertedPreview, dateLocale)} ${destinationCurrency}`
      : undefined;

  const rateDateLabel = rates ? formatRateDate(rates.date, dateLocale) : undefined;
  const statusLabel = stale
    ? `Cached rate${rateDateLabel ? ` · ${rateDateLabel}` : ''}`
    : rates
      ? `Live rate · Updated just now`
      : undefined;

  const softSurface = chrome.softBg;
  const badgeSize = Math.max(40, s(44));

  return (
    <TravelSheetModal
      visible={visible}
      eyebrow="CURRENCY"
      title="Convert Currency"
      subtitle={destinationLabel}
      subtitleIcon={destinationLabel ? 'location' : undefined}
      onClose={onClose}
      closeAccessibilityLabel="Close currency calculator"
      closeTestID={AgentUiIds.travel.currency.close}
      minHeight={sheetMinHeight}
      scrollKey={`${plan.id}-${visible ? 'open' : 'closed'}`}
      footer={
        <AgentTestId
          testID={AgentUiIds.travel.currency.done}
          label="Done"
          onPress={() => {
            haptics.tap();
            onClose();
          }}
          style={[
            styles.doneButton,
            {
              backgroundColor: chrome.accent,
              minHeight: Math.max(layout.minTapTarget, s(52)),
              borderRadius: radii.pill,
            },
          ]}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Done"
            onPress={() => {
              haptics.tap();
              onClose();
            }}
            style={({ pressed }) => [
              {
                minHeight: Math.max(layout.minTapTarget, s(52)),
                borderRadius: radii.pill,
                alignItems: 'center',
                justifyContent: 'center',
                opacity: pressed ? 0.88 : 1,
              },
            ]}>
            <AppText
              variant="callout"
              fit
              numberOfLines={1}
              style={{ color: chrome.onAccent, fontWeight: '600' }}>
              Done
            </AppText>
          </Pressable>
        </AgentTestId>
      }>
      {Platform.OS === 'ios' ? (
        <InputAccessoryView nativeID={accessoryId}>
          <View
            style={[
              styles.accessory,
              {
                backgroundColor: chrome.softBg,
                borderTopColor: chrome.fieldBorder,
                paddingHorizontal: rs.md,
                paddingVertical: rs.sm,
              },
            ]}>
            <Button variant="secondary" onPress={() => Keyboard.dismiss()}>
              Done
            </Button>
          </View>
        </InputAccessoryView>
      ) : null}

      {loading && !rates && rateOverride === undefined ? (
        <LoadingBlock compact label="Loading rates…" />
      ) : (
        <View style={{ gap: rs.lg }}>
          <Pressable
            accessible={false}
            onPress={() => Keyboard.dismiss()}
            style={{ gap: rs.lg }}>
          <View>
            <TravelCurrencySideCard
              sideLabel="From"
              amountLabel="You send"
              currency={originCurrency}
              options={currencyOptions}
              open={openDropdown === 'origin'}
              onOpenChange={(next) => {
                Keyboard.dismiss();
                setOpenDropdown(next ? 'origin' : null);
              }}
              onCurrencyChange={onOriginCurrencyChange}
              amountText={originText}
              onAmountChange={onOriginAmountChange}
              onAmountFocus={() => {
                setActiveSide('origin');
              }}
              inputAccessoryViewID={accessoryId}
            />

            <View style={[styles.swapRow, { marginVertical: -rs.sm }]}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Swap currencies"
                hitSlop={8}
                onPress={swapCurrencies}
                style={({ pressed }) => [
                  styles.swapButton,
                  {
                    width: Math.max(layout.minTapTarget, s(44)),
                    height: Math.max(layout.minTapTarget, s(44)),
                    borderRadius: Math.max(layout.minTapTarget, s(44)) / 2,
                    backgroundColor: chrome.cardBg,
                    borderColor: chrome.fieldBorder,
                    opacity: pressed ? 0.7 : 1,
                  },
                ]}>
                <Symbol name="sort" size="md" color={chrome.accent} />
              </Pressable>
            </View>

            <TravelCurrencySideCard
              sideLabel="To"
              amountLabel="You receive"
              currency={destinationCurrency}
              options={currencyOptions}
              open={openDropdown === 'destination'}
              onOpenChange={(next) => {
                Keyboard.dismiss();
                setOpenDropdown(next ? 'destination' : null);
              }}
              onCurrencyChange={onDestinationCurrencyChange}
              amountText={destinationText}
              onAmountChange={onDestinationAmountChange}
              onAmountFocus={() => {
                setActiveSide('destination');
              }}
              inputAccessoryViewID={accessoryId}
            />
          </View>

          <TravelCurrencyRatePanel
            originCurrency={originCurrency}
            destinationCurrency={destinationCurrency}
            rateText={rateText}
            onRateChange={onRateChange}
            isCustom={isCustomRate}
            marketRateLabel={
              marketRate !== undefined ? formatRateInput(marketRate) : undefined
            }
            sourceLabel={rates?.sourceLabel}
            statusLabel={statusLabel}
            refreshing={refreshing || (stale && loading)}
            unavailable={!rates && !isCustomRate}
            inputAccessoryViewID={accessoryId}
            onRefresh={() => {
              void refreshRates({ force: true, soft: true, clearOverride: true });
            }}
            onUseMarket={useMarketRate}
          />

          {summaryPrimary ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Summary: ${summaryPrimary}`}
              onPress={() => {
                haptics.select();
                Keyboard.dismiss();
              }}
              style={({ pressed }) => [
                styles.summary,
                {
                  backgroundColor: softSurface,
                  borderRadius: radii.lg,
                  paddingHorizontal: rs.md,
                  paddingVertical: rs.md,
                  gap: rs.md,
                  minHeight: Math.max(layout.minTapTarget, s(64)),
                  opacity: pressed ? 0.88 : 1,
                },
              ]}>
              <View
                style={[
                  styles.summaryBadge,
                  {
                    width: badgeSize,
                    height: badgeSize,
                    borderRadius: badgeSize / 2,
                    backgroundColor: chrome.accent,
                  },
                ]}>
                <Symbol name="calculator" size="sm" color={chrome.onAccent} />
              </View>
              <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                <AppText
                  variant="caption"
                  fit
                  numberOfLines={1}
                  style={{ color: chrome.label }}>
                  Summary
                </AppText>
                <AppText
                  variant="callout"
                  fit
                  numberOfLines={1}
                  style={{
                    color: chrome.title,
                    fontWeight: '600',
                    flexShrink: 1,
                    minWidth: 0,
                  }}>
                  {summaryPrimary}
                </AppText>
                <AppText
                  variant="caption"
                  fit
                  numberOfLines={1}
                  style={{ color: chrome.subtitle, flexShrink: 1, minWidth: 0 }}>
                  {isCustomRate
                    ? `Custom rate${rateDateLabel ? ` · ${rateDateLabel}` : ''}`
                    : `Rate may change${rateDateLabel ? ` · ${rateDateLabel}` : ''}`}
                </AppText>
              </View>
              <Symbol name="chevron-right" size="sm" color={chrome.label} />
            </Pressable>
          ) : null}
          </Pressable>
        </View>
      )}
    </TravelSheetModal>
  );
}
