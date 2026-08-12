import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Share } from 'react-native';

import type { FinanceTaxExportPackage } from './tax-export';

/** Write CSV + summary and open the OS share sheet. */
export async function shareTaxExportPackage(
  pack: FinanceTaxExportPackage,
): Promise<void> {
  const canShare = await Sharing.isAvailableAsync();
  const summaryName = `ontrack-tax-${pack.year}-summary.txt`;
  const csvName = `ontrack-tax-${pack.year}.csv`;
  const summaryFile = new File(Paths.cache, summaryName);
  const csvFile = new File(Paths.cache, csvName);
  summaryFile.create({ overwrite: true, intermediates: true });
  csvFile.create({ overwrite: true, intermediates: true });
  summaryFile.write(pack.summaryText);
  csvFile.write(pack.csv);

  if (canShare) {
    await Sharing.shareAsync(csvFile.uri, {
      mimeType: 'text/csv',
      dialogTitle: `onTrack tax package ${pack.year}`,
    });
    return;
  }

  await Share.share({
    message: `${pack.summaryText}\n\n--- CSV ---\n${pack.csv}`,
    title: `onTrack tax package ${pack.year}`,
  });
}
