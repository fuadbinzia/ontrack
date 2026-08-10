import {
    InputAccessoryView,
    Keyboard,
    Platform,
    Pressable,
    View,
} from 'react-native';

import { AppText, Button, LoadingBlock, Symbol } from '@/components/primitives';
import { radii } from '@/design-system';
import { TravelCurrencyRatePanel } from '@/features/travel/travel-currency-rate-panel';
import { TravelCurrencySideCard } from '@/features/travel/travel-currency-side-card';
import { TravelSheetModal } from '@/features/travel/travel-sheet';
import { AgentTestId, AgentUiIds } from '@/utils/agent-ui';
import { travelCurrencySheetStyles as styles } from './travel-currency-sheet.styles';
import {
  formatFxMoney,
  formatPlainAmount,
} from './travel-currency-formatters';
import type { TravelCurrencySheetState } from './use-travel-currency-sheet-state';

export function TravelCurrencySheetBody({
  state,
  onClose,
}: {
  state: TravelCurrencySheetState;
  onClose: () => void;
}) {
  const {
    accessoryId,
    badgeSize,
    chrome,
    currencyOptions,
    destinationCurrency,
    destinationLabel,
    destinationText,
    formatRateInput,
    haptics,
    isCustomRate,
    layout,
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
    plan,
    rateDateLabel,
    rateOverride,
    rateText,
    rates,
    refreshRates,
    refreshing,
    rs,
    s,
    setActiveSide,
    setOpenDropdown,
    sheetMinHeight,
    softSurface,
    stale,
    statusLabel,
    summaryPrimary,
    swapCurrencies,
    useMarketRate,
    visible,
  } = state;

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
