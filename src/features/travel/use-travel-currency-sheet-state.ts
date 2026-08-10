import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import {
    AppState,
    Keyboard,
    Platform,
    useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

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
import type { TravelPlan } from '@/features/travel/types';
import { useResponsive } from '@/hooks/use-responsive';
import { useTheme } from '@/hooks/use-theme';
import { usePreferences } from '@/store/preferences';
import { haptics } from '@/utils/haptics';
import { sanitizeNumericInput } from '@/utils/parse';
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

export function useTravelCurrencySheetState({
  plan,
  visible,
}: {
  plan: TravelPlan;
  visible: boolean;
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


  return {
    plan,
    visible,
    accessoryId,
    formatRateInput,
    haptics,
    layout,
    rs,
    s,
    badgeSize,
    chrome,
    currencyOptions,
    destinationCurrency,
    destinationLabel,
    destinationText,
    isCustomRate,
    loading,
    marketRate,
    onDestinationAmountChange,
    onDestinationCurrencyChange,
    onOriginAmountChange,
    onOriginCurrencyChange,
    onRateChange,
    openDropdown,
    originCurrency,
    originText,
    rateDateLabel,
    rateOverride,
    rateText,
    rates,
    refreshRates,
    refreshing,
    setActiveSide,
    setOpenDropdown,
    sheetMinHeight,
    softSurface,
    stale,
    statusLabel,
    summaryPrimary,
    swapCurrencies,
    useMarketRate,
  };
}

export type TravelCurrencySheetState = ReturnType<typeof useTravelCurrencySheetState>;
