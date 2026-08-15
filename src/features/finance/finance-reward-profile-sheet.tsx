import { useEffect, useState } from 'react';
import { View } from 'react-native';

import {
  AppText,
  Button,
  Card,
  DateField,
  Dropdown,
  ErrorMessage,
  Input,
  SettingsToggleRow,
  SheetScaffold,
} from '@/components/primitives';
import { ChipRow } from '@/components/shared';
import { useResponsive } from '@/hooks/use-responsive';
import { AgentTestId, AgentUiIds } from '@/utils/agent-ui';
import { newUuid } from '@/utils/id';
import { parseFiniteNumber } from '@/utils/parse';

import type {
  FinanceRewardBenefit,
  FinanceRewardCardProfile,
  FinanceRewardOwnership,
  FinanceRewardProfileDraft,
  FinanceRewardRule,
} from './rewards-types';

type RewardProfileInput = FinanceRewardCardProfile | FinanceRewardProfileDraft;

function blankDraft(): FinanceRewardProfileDraft {
  return {
    issuer: '',
    name: '',
    ownership: 'owned',
    rewardCurrency: 'points',
    pointValueCents: 1,
    baseMultiplier: 1,
    annualFee: 0,
    rules: [],
    benefits: [],
    source: { kind: 'manual', warnings: [] },
    editedFields: [],
  };
}

function addEdited(fields: string[], field: string): string[] {
  return fields.includes(field) ? fields : [...fields, field];
}

export function FinanceRewardProfileSheet({
  visible,
  initial,
  onClose,
  onSave,
}: {
  visible: boolean;
  initial?: RewardProfileInput;
  onClose: () => void;
  onSave: (draft: FinanceRewardProfileDraft, id?: string) => void;
}) {
  const { spacing } = useResponsive();
  const [draft, setDraft] = useState<FinanceRewardProfileDraft>(blankDraft);
  const [error, setError] = useState<string>();

  useEffect(() => {
    if (!visible) return;
    const next = initial ?? blankDraft();
    const { id: _id, createdAt: _createdAt, updatedAt: _updatedAt, ...profileDraft } =
      next as FinanceRewardCardProfile;
    setDraft('id' in next ? profileDraft : next);
    setError(undefined);
  }, [initial, visible]);

  const update = <K extends keyof FinanceRewardProfileDraft>(
    key: K,
    value: FinanceRewardProfileDraft[K],
  ) => setDraft((current) => ({
    ...current,
    [key]: value,
    editedFields: addEdited(current.editedFields, key),
  }));

  const updateRule = (id: string, patch: Partial<FinanceRewardRule>) => {
    setDraft((current) => ({
      ...current,
      rules: current.rules.map((rule) => rule.id === id ? { ...rule, ...patch } : rule),
      editedFields: addEdited(current.editedFields, `rules.${id}`),
    }));
  };

  const updateBenefit = (id: string, patch: Partial<FinanceRewardBenefit>) => {
    setDraft((current) => ({
      ...current,
      benefits: current.benefits.map((benefit) =>
        benefit.id === id ? { ...benefit, ...patch } : benefit,
      ),
      editedFields: addEdited(current.editedFields, `benefits.${id}`),
    }));
  };

  const save = () => {
    if (!draft.name.trim() || !draft.issuer.trim()) {
      setError('Enter the card name and issuer.');
      return;
    }
    if (draft.baseMultiplier < 0 || draft.pointValueCents < 0 || draft.annualFee < 0) {
      setError('Rates, point value, and annual fee cannot be negative.');
      return;
    }
    onSave({
      ...draft,
      issuer: draft.issuer.trim(),
      name: draft.name.trim(),
      rewardCurrency: draft.rewardCurrency.trim() || 'points',
    }, 'id' in (initial ?? {}) ? (initial as FinanceRewardCardProfile).id : undefined);
  };

  return (
    <SheetScaffold
      visible={visible}
      eyebrow={draft.source.kind === 'manual' ? 'Rewards Profile' : 'Import Review'}
      title={initial ? 'Review Card Details' : 'Add Rewards Card'}
      subtitle="Confirm every estimate before it affects your comparisons."
      onClose={onClose}
      closeTestID={AgentUiIds.finance.rewards.profileClose}
      backdropTestID={AgentUiIds.finance.rewards.profileBackdrop}
      scrollKey={`${visible}-${draft.rules.length}-${draft.benefits.length}`}
      footer={<Button onPress={save} testID={AgentUiIds.finance.rewards.profileSave}>Save Card</Button>}>
      <AgentTestId testID={AgentUiIds.finance.rewards.profileSheet} label="Reward Profile Editor">
        <View style={{ gap: spacing.lg }}>
          {draft.source.url ? (
            <Card airy>
              <AppText variant="overline" color="accent" fit>
                {draft.source.kind === 'issuer' ? 'Issuer Source' : 'Third-Party Source'}
              </AppText>
              <AppText variant="caption" color="secondary" numberOfLines={2}>
                {draft.source.hostname}
                {draft.source.confidence != null
                  ? ` · ${Math.round(draft.source.confidence * 100)}% extraction confidence`
                  : ''}
              </AppText>
              {draft.source.retrievedAt ? (
                <AppText variant="caption" color="secondary">
                  Retrieved {new Date(draft.source.retrievedAt).toLocaleString()}
                </AppText>
              ) : null}
              {draft.source.warnings.map((warning) => (
                <AppText key={warning} variant="caption" color="danger">• {warning}</AppText>
              ))}
            </Card>
          ) : null}

          <View style={{ gap: spacing.md }}>
            <Input
              stackedLabel="Card Name"
              icon="finance"
              value={draft.name}
              onChangeText={(value) => update('name', value)}
              testID={AgentUiIds.finance.rewards.profileName}
            />
            <Input
              stackedLabel="Issuer"
              icon="building"
              value={draft.issuer}
              onChangeText={(value) => update('issuer', value)}
              testID={AgentUiIds.finance.rewards.profileIssuer}
            />
            <Input
              stackedLabel="Card Network"
              icon="finance"
              placeholder="Visa, Mastercard, American Express"
              value={draft.network ?? ''}
              onChangeText={(value) => update('network', value || undefined)}
              testID={AgentUiIds.finance.rewards.profileNetwork}
            />
            <View style={{ gap: spacing.sm }}>
              <AppText variant="overline" color="secondary" fit>Use In</AppText>
              <ChipRow
                options={[
                  { value: 'owned' as const, label: 'My Wallet' },
                  { value: 'market' as const, label: 'Market Comparison' },
                ]}
                selected={draft.ownership}
                onSelect={(value: FinanceRewardOwnership) => update('ownership', value)}
                testIDForOption={(value) => AgentUiIds.finance.rewards.profileOwnership(value)}
              />
            </View>
            <Input
              stackedLabel="Reward Currency"
              icon="finance"
              placeholder="Points, miles, or cash back"
              value={draft.rewardCurrency}
              onChangeText={(value) => update('rewardCurrency', value)}
              testID={AgentUiIds.finance.rewards.profileCurrency}
            />
            <Input
              stackedLabel="Base Points Per Dollar"
              icon="finance"
              value={String(draft.baseMultiplier)}
              onChangeText={(value) => update('baseMultiplier', parseFiniteNumber(value) ?? 0)}
              keyboardType="decimal-pad"
              testID={AgentUiIds.finance.rewards.profileBaseRate}
            />
            <Input
              stackedLabel="Cents Per Point"
              icon="finance"
              value={String(draft.pointValueCents)}
              onChangeText={(value) => update('pointValueCents', parseFiniteNumber(value) ?? 0)}
              keyboardType="decimal-pad"
              testID={AgentUiIds.finance.rewards.profilePointValue}
            />
            <Input
              stackedLabel="Annual Fee"
              icon="finance"
              value={String(draft.annualFee)}
              onChangeText={(value) => update('annualFee', parseFiniteNumber(value) ?? 0)}
              keyboardType="decimal-pad"
              testID={AgentUiIds.finance.rewards.profileAnnualFee}
            />
          </View>

          <View style={{ gap: spacing.md }}>
            <View style={{ gap: spacing.xs }}>
              <AppText variant="heading" fit>Bonus Rules</AppText>
              <AppText variant="caption" color="secondary">
                Use onTrack category ids such as dining, groceries, travel, shopping, or other.
              </AppText>
            </View>
            {draft.rules.map((rule) => (
              <Card key={rule.id} airy>
                <View style={{ gap: spacing.sm }}>
                  <Input
                    label="Rule Name"
                    value={rule.name}
                    onChangeText={(value) => updateRule(rule.id, { name: value })}
                    testID={AgentUiIds.finance.rewards.ruleName(rule.id)}
                  />
                  <Input
                    label="Points Per Dollar"
                    value={String(rule.multiplier)}
                    onChangeText={(value) => updateRule(rule.id, {
                      multiplier: parseFiniteNumber(value) ?? 0,
                    })}
                    keyboardType="decimal-pad"
                    testID={AgentUiIds.finance.rewards.ruleRate(rule.id)}
                  />
                  <Input
                    label="Categories"
                    placeholder="dining, groceries"
                    value={rule.categoryIds.join(', ')}
                    onChangeText={(value) => updateRule(rule.id, {
                      categoryIds: value.split(',').map((item) => item.trim()).filter(Boolean),
                    })}
                    testID={AgentUiIds.finance.rewards.ruleCategories(rule.id)}
                  />
                  <Input
                    label="Plaid Detailed Categories"
                    placeholder="FOOD_AND_DRINK_RESTAURANTS"
                    value={rule.sourceCategories.join(', ')}
                    onChangeText={(value) => updateRule(rule.id, {
                      sourceCategories: value
                        .split(',')
                        .map((item) => item.trim().toUpperCase())
                        .filter(Boolean),
                    })}
                    testID={AgentUiIds.finance.rewards.ruleSourceCategories(rule.id)}
                  />
                  <Input
                    label="Spend Cap"
                    placeholder="Optional"
                    value={rule.capAmount == null ? '' : String(rule.capAmount)}
                    onChangeText={(value) => updateRule(rule.id, {
                      capAmount: parseFiniteNumber(value),
                    })}
                    keyboardType="decimal-pad"
                    testID={AgentUiIds.finance.rewards.ruleCap(rule.id)}
                  />
                  <Dropdown
                    label="Cap Period"
                    value={rule.capPeriod ?? ''}
                    options={[
                      { value: '', label: 'No Period' },
                      { value: 'month', label: 'Monthly' },
                      { value: 'quarter', label: 'Quarterly' },
                      { value: 'year', label: 'Yearly' },
                      { value: 'lifetime', label: 'Lifetime' },
                    ]}
                    onChange={(value) => updateRule(rule.id, {
                      capPeriod: value || undefined,
                    })}
                    testID={AgentUiIds.finance.rewards.ruleCapPeriod(rule.id)}
                  />
                  <Input
                    label="Shared Cap Group"
                    placeholder="Optional key shared by multiple rules"
                    value={rule.capGroup ?? ''}
                    onChangeText={(value) => updateRule(rule.id, {
                      capGroup: value || undefined,
                    })}
                    testID={AgentUiIds.finance.rewards.ruleCapGroup(rule.id)}
                  />
                  <DateField
                    label="Starts On"
                    value={rule.startsOn ?? ''}
                    onChange={(startsOn) => updateRule(rule.id, { startsOn })}
                    testID={AgentUiIds.finance.rewards.ruleStartsOn(rule.id)}
                  />
                  {rule.startsOn ? (
                    <Button
                      size="sm"
                      variant="ghost"
                      onPress={() => updateRule(rule.id, { startsOn: undefined })}>
                      Clear Start Date
                    </Button>
                  ) : null}
                  <DateField
                    label="Ends On"
                    value={rule.endsOn ?? ''}
                    minimumDate={rule.startsOn}
                    onChange={(endsOn) => updateRule(rule.id, { endsOn })}
                    testID={AgentUiIds.finance.rewards.ruleEndsOn(rule.id)}
                  />
                  {rule.endsOn ? (
                    <Button
                      size="sm"
                      variant="ghost"
                      onPress={() => updateRule(rule.id, { endsOn: undefined })}>
                      Clear End Date
                    </Button>
                  ) : null}
                  <SettingsToggleRow
                    label="Rule Active"
                    detail={rule.requiresActivation
                      ? 'Activation is required; enable after activating with the issuer.'
                      : 'Include this category in reward estimates.'}
                    value={rule.active}
                    onValueChange={(active) => updateRule(rule.id, { active })}
                    testID={AgentUiIds.finance.rewards.ruleActive(rule.id)}
                  />
                  <Button
                    size="sm"
                    variant="ghost"
                    onPress={() => update('rules', draft.rules.filter((item) => item.id !== rule.id))}
                    testID={AgentUiIds.finance.rewards.ruleRemove(rule.id)}>
                    Remove Rule
                  </Button>
                </View>
              </Card>
            ))}
            <Button
              size="sm"
              variant="secondary"
              icon="add"
              onPress={() => update('rules', [...draft.rules, {
                id: newUuid(),
                name: 'Bonus Category',
                multiplier: 2,
                categoryIds: [],
                sourceCategories: [],
                active: true,
              }])}
              testID={AgentUiIds.finance.rewards.ruleAdd}>
              Add Bonus Rule
            </Button>
          </View>

          <View style={{ gap: spacing.md }}>
            <View style={{ gap: spacing.xs }}>
              <AppText variant="heading" fit>Annual Benefits</AppText>
              <AppText variant="caption" color="secondary">
                Benefits count as zero until you enable them and enter your realistic annual value.
              </AppText>
            </View>
            {draft.benefits.map((benefit) => (
              <Card key={benefit.id} airy>
                <View style={{ gap: spacing.sm }}>
                  <Input
                    label="Benefit"
                    value={benefit.name}
                    onChangeText={(value) => updateBenefit(benefit.id, { name: value })}
                    testID={AgentUiIds.finance.rewards.benefitName(benefit.id)}
                  />
                  <Input
                    label="Face Value"
                    value={String(benefit.faceValue)}
                    onChangeText={(value) => updateBenefit(benefit.id, {
                      faceValue: parseFiniteNumber(value) ?? 0,
                    })}
                    keyboardType="decimal-pad"
                    testID={AgentUiIds.finance.rewards.benefitFaceValue(benefit.id)}
                  />
                  <Input
                    label="My Annual Value"
                    value={String(benefit.userValue)}
                    onChangeText={(value) => updateBenefit(benefit.id, {
                      userValue: parseFiniteNumber(value) ?? 0,
                    })}
                    keyboardType="decimal-pad"
                    testID={AgentUiIds.finance.rewards.benefitUserValue(benefit.id)}
                  />
                  <SettingsToggleRow
                    label="Count This Benefit"
                    detail="Include your value in the annual comparison."
                    value={benefit.enabled}
                    onValueChange={(enabled) => updateBenefit(benefit.id, { enabled })}
                    testID={AgentUiIds.finance.rewards.benefitEnabled(benefit.id)}
                  />
                  <Button
                    size="sm"
                    variant="ghost"
                    onPress={() => update(
                      'benefits',
                      draft.benefits.filter((item) => item.id !== benefit.id),
                    )}
                    testID={AgentUiIds.finance.rewards.benefitRemove(benefit.id)}>
                    Remove Benefit
                  </Button>
                </View>
              </Card>
            ))}
            <Button
              size="sm"
              variant="secondary"
              icon="add"
              onPress={() => update('benefits', [...draft.benefits, {
                id: newUuid(),
                name: 'Annual Credit',
                faceValue: 0,
                userValue: 0,
                enabled: false,
              }])}
              testID={AgentUiIds.finance.rewards.benefitAdd}>
              Add Benefit
            </Button>
          </View>

          <View style={{ gap: spacing.sm }}>
            <AppText variant="heading" fit>Welcome Offer</AppText>
            <Input
              label="Offer Details"
              placeholder="Shown separately from ongoing value"
              value={draft.welcomeOffer?.description ?? ''}
              onChangeText={(description) => update(
                'welcomeOffer',
                description ? { ...draft.welcomeOffer, description } : undefined,
              )}
              multiline
              testID={AgentUiIds.finance.rewards.welcomeOffer}
            />
            <Input
              label="Offer Reward Amount"
              placeholder="Points, miles, or cash"
              value={draft.welcomeOffer?.rewardAmount == null
                ? ''
                : String(draft.welcomeOffer.rewardAmount)}
              onChangeText={(value) => update('welcomeOffer', {
                description: draft.welcomeOffer?.description ?? 'Welcome offer',
                ...draft.welcomeOffer,
                rewardAmount: parseFiniteNumber(value),
              })}
              keyboardType="decimal-pad"
              testID={AgentUiIds.finance.rewards.welcomeRewardAmount}
            />
            <Input
              label="Required Spend"
              value={draft.welcomeOffer?.spendRequirement == null
                ? ''
                : String(draft.welcomeOffer.spendRequirement)}
              onChangeText={(value) => update('welcomeOffer', {
                description: draft.welcomeOffer?.description ?? 'Welcome offer',
                ...draft.welcomeOffer,
                spendRequirement: parseFiniteNumber(value),
              })}
              keyboardType="decimal-pad"
              testID={AgentUiIds.finance.rewards.welcomeSpendRequirement}
            />
            <Input
              label="Months To Earn"
              value={draft.welcomeOffer?.monthsToEarn == null
                ? ''
                : String(draft.welcomeOffer.monthsToEarn)}
              onChangeText={(value) => update('welcomeOffer', {
                description: draft.welcomeOffer?.description ?? 'Welcome offer',
                ...draft.welcomeOffer,
                monthsToEarn: parseFiniteNumber(value),
              })}
              keyboardType="number-pad"
              testID={AgentUiIds.finance.rewards.welcomeMonths}
            />
          </View>

          {error ? <ErrorMessage message={error} variant="caption" /> : null}
        </View>
      </AgentTestId>
    </SheetScaffold>
  );
}
