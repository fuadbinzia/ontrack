import { View } from 'react-native';

import {
  appPrompt,
  AppText,
  Button,
  Card,
  Input,
  PanelTitle,
  SheetScaffold,
} from '@/components/primitives';
import { useResponsive } from '@/hooks/use-responsive';
import { useFinance } from '@/store/finance';
import { AgentTestId, AgentUiIds } from '@/utils/agent-ui';
import { openHttpsUrl } from '@/utils/safe-url';

import { shareTaxExportPackage } from './share-tax-package';
import { buildTaxExportPackage } from './tax-export';
import {
  TAX_HANDOFF_DESTINATIONS,
  type TaxHandoffId,
} from './tax-handoff';
import type { FinanceTaxYear } from './types';

export function openTaxHandoffUrl(url: string): Promise<boolean> {
  return openHttpsUrl(url);
}

export async function openTaxHandoffUrlOrAlert(
  url: string,
  onInvalidUrl?: () => void,
): Promise<boolean> {
  const opened = await openTaxHandoffUrl(url);
  if (!opened) onInvalidUrl?.();
  return opened;
}

export function FinanceTaxHandoffSheet({
  visible,
  taxYear,
  onClose,
}: {
  visible: boolean;
  taxYear: FinanceTaxYear | undefined;
  onClose: () => void;
}) {
  const { spacing: gap } = useResponsive();
  const entities = useFinance((s) => s.entities);
  const transactions = useFinance((s) => s.transactions);
  const documents = useFinance((s) => s.documents);
  const customHandoffUrl = useFinance((s) => s.customHandoffUrl);
  const setCustomHandoffUrl = useFinance((s) => s.setCustomHandoffUrl);

  const openTaxDestination = async (url: string): Promise<boolean> => {
    const opened = await openTaxHandoffUrlOrAlert(url, () => {
      appPrompt.alert(
        'Couldn’t Open That Site',
        'Open the site in your browser after sharing your package.',
      );
    });
    if (!opened) {
      return false;
    }
    return true;
  };

  const runHandoff = async (id: TaxHandoffId) => {
    if (!taxYear) return;
    const dest = TAX_HANDOFF_DESTINATIONS.find((d) => d.id === id);
    if (!dest) return;

    const pack = buildTaxExportPackage({
      taxYear,
      entities,
      transactions,
      documents,
    });

    if (dest.sharePackage) {
      try {
        await shareTaxExportPackage(pack);
      } catch (error) {
        appPrompt.alert(
          'Could not share package',
          error instanceof Error ? error.message : 'Share failed.',
        );
      }
    }

    let url = dest.url;
    if (id === 'other' && customHandoffUrl?.trim()) {
      url = customHandoffUrl.trim();
    }
    if (url) {
      const opened = await openTaxDestination(url);
      if (!opened) {
        onClose();
        return;
      }
    }

    if (dest.eligibilityNote) {
      appPrompt.alert(dest.label, dest.eligibilityNote);
    }
    onClose();
  };

  return (
    <SheetScaffold
      visible={visible}
      onClose={onClose}
      title="File Elsewhere"
      subtitle="onTrack prepared your package — finish filing with the service you choose."
      closeTestID={AgentUiIds.finance.tax.handoffClose}>
      <AgentTestId testID={AgentUiIds.finance.tax.fileElsewhere} label="File elsewhere">
      <View style={{ gap: gap.md }}>
        <AppText variant="caption" color="secondary">
          Choose IRS Direct File / Free File, TurboTax, FreeTaxUSA, April, your CPA, or
          another tool. onTrack does not e-file returns.
        </AppText>
        {TAX_HANDOFF_DESTINATIONS.map((dest) => (
          <Card
            key={dest.id}
            onPress={() => void runHandoff(dest.id)}
            testID={AgentUiIds.finance.tax.handoff(dest.id)}
            accessibilityLabel={dest.label}>
            <PanelTitle>{dest.label}</PanelTitle>
            <AppText variant="caption" color="secondary">
              {dest.description}
            </AppText>
          </Card>
        ))}
        <Input
          label="Custom URL (Other)"
          value={customHandoffUrl ?? ''}
          onChangeText={(text) => setCustomHandoffUrl(text || undefined)}
          autoCapitalize="none"
          autoCorrect={false}
          placeholder="https://"
          testID={AgentUiIds.finance.tax.customUrl}
        />
        <Button  variant="secondary" onPress={onClose} >
            Close
          </Button>
      </View>
      </AgentTestId>
    </SheetScaffold>
  );
}
