import { useEffect, useState } from 'react';
import { Linking, View } from 'react-native';

import {
  appPrompt,
  AppText,
  Button,
  DateField,
  Input,
  SheetScaffold,
} from '@/components/primitives';
import { ChipRow } from '@/components/shared';
import { useResponsive } from '@/hooks/use-responsive';
import { useFinance } from '@/store/finance';
import { AgentTestId, AgentUiIds } from '@/utils/agent-ui';
import { todayKey } from '@/utils/date';

import { FINANCE_CREDIT_PROVIDERS } from './credit-providers';
import {
  FINANCE_CREDIT_BUREAU_LABEL,
  FINANCE_CREDIT_BUREAUS,
  FINANCE_CREDIT_MODEL_LABEL,
  FINANCE_CREDIT_MODELS,
  type FinanceCreditBureau,
  type FinanceCreditModel,
} from './types';

export function FinanceCreditSheet({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const { spacing: gap } = useResponsive();
  const current = useFinance((s) => s.creditScore?.current);
  const setCreditScore = useFinance((s) => s.setCreditScore);
  const [scoreText, setScoreText] = useState(
    current?.score != null ? String(current.score) : '',
  );
  const [bureau, setBureau] = useState<FinanceCreditBureau>(current?.bureau ?? 'equifax');
  const [model, setModel] = useState<FinanceCreditModel>(current?.model ?? 'vantage_4');
  const [asOf, setAsOf] = useState(current?.asOf ?? todayKey());

  useEffect(() => {
    if (!visible) return;
    setScoreText(current?.score != null ? String(current.score) : '');
    setBureau(current?.bureau ?? 'equifax');
    setModel(current?.model ?? 'vantage_4');
    setAsOf(current?.asOf ?? todayKey());
  }, [visible, current]);

  const save = () => {
    const score = Number.parseInt(scoreText.replace(/\D/g, ''), 10);
    if (!Number.isFinite(score) || score < 300 || score > 850) {
      appPrompt.alert('Invalid score', 'Enter a score between 300 and 850.');
      return;
    }
    setCreditScore({
      score,
      bureau,
      model,
      asOf,
      updatedAt: new Date().toISOString(),
    });
    onClose();
  };

  const openProvider = async (url: string) => {
    try {
      await Linking.openURL(url);
    } catch {
      appPrompt.alert('Could not open link', 'Open the site in a browser instead.');
    }
  };

  return (
    <SheetScaffold
      visible={visible}
      onClose={onClose}
      title="Credit Score"
      subtitle="Providers don’t share scores with other apps — enter what you see, or open a free checker."
      closeTestID={AgentUiIds.finance.credit.close}>
      <AgentTestId testID={AgentUiIds.finance.credit.edit} label="Edit credit score">
        <View style={{ gap: gap.md }}>
          <Input
            label="Score"
            value={scoreText}
            onChangeText={setScoreText}
            keyboardType="number-pad"
            testID={AgentUiIds.finance.credit.score}
          />
          <AppText variant="overline" color="secondary" fit>
            Bureau
          </AppText>
          <ChipRow
            options={FINANCE_CREDIT_BUREAUS.map((id) => ({
              value: id,
              label: FINANCE_CREDIT_BUREAU_LABEL[id],
            }))}
            selected={bureau}
            onSelect={setBureau}
            testIDForOption={(id) => AgentUiIds.finance.credit.bureau(id)}
          />
          <AppText variant="overline" color="secondary" fit>
            Model
          </AppText>
          <ChipRow
            options={FINANCE_CREDIT_MODELS.map((id) => ({
              value: id,
              label: FINANCE_CREDIT_MODEL_LABEL[id],
            }))}
            selected={model}
            onSelect={setModel}
            scrollable
            testIDForOption={(id) => AgentUiIds.finance.credit.model(id)}
          />
          <DateField
            label="As of"
            value={asOf}
            onChange={setAsOf}
            testID={AgentUiIds.finance.credit.asOf}
          />
          <Button onPress={save} testID={AgentUiIds.finance.credit.save}>
            Save score
          </Button>
          <AppText variant="caption" color="secondary">
            Check a free score, then enter it here.
          </AppText>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: gap.sm }}>
            {FINANCE_CREDIT_PROVIDERS.map((provider) => (
              <Button
                key={provider.id}
                size="sm"
                variant="secondary"
                onPress={() => void openProvider(provider.url)}
                testID={AgentUiIds.finance.credit.provider(provider.id)}>
                {provider.label}
              </Button>
            ))}
          </View>
        </View>
      </AgentTestId>
    </SheetScaffold>
  );
}
