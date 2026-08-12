/** Curated File-elsewhere destinations — open URL + share export package. */

export type TaxHandoffId =
  | 'irs_direct_file'
  | 'irs_free_file'
  | 'turbotax'
  | 'freetaxusa'
  | 'april'
  | 'cpa'
  | 'other';

export interface TaxHandoffDestination {
  id: TaxHandoffId;
  label: string;
  description: string;
  /** Official landing URL when applicable. */
  url?: string;
  /** Share the export package via OS share sheet. */
  sharePackage: boolean;
  eligibilityNote?: string;
}

export const TAX_HANDOFF_DESTINATIONS: readonly TaxHandoffDestination[] = [
  {
    id: 'irs_direct_file',
    label: 'IRS Direct File',
    description: 'File for free with the IRS in supported states.',
    url: 'https://directfile.irs.gov/',
    sharePackage: false,
    eligibilityNote: 'Available only in participating states and for supported return types.',
  },
  {
    id: 'irs_free_file',
    label: 'IRS Free File',
    description: 'Guided free filing through IRS Free File partners.',
    url: 'https://www.irs.gov/filing/free-file-do-your-federal-taxes-for-free',
    sharePackage: false,
  },
  {
    id: 'turbotax',
    label: 'TurboTax',
    description: 'Open TurboTax and import your onTrack export package.',
    url: 'https://turbotax.intuit.com/',
    sharePackage: true,
  },
  {
    id: 'freetaxusa',
    label: 'FreeTaxUSA',
    description: 'Open FreeTaxUSA with your categorized export ready to share.',
    url: 'https://www.freetaxusa.com/',
    sharePackage: true,
  },
  {
    id: 'april',
    label: 'April',
    description: 'Open April and finish filing with your prepared package.',
    url: 'https://www.april.com/',
    sharePackage: true,
  },
  {
    id: 'cpa',
    label: 'CPA / email',
    description: 'Share your tax package with your accountant.',
    sharePackage: true,
  },
  {
    id: 'other',
    label: 'Other',
    description: 'Share files only, or open a custom URL you saved.',
    sharePackage: true,
  },
] as const;

export function taxHandoffById(id: TaxHandoffId): TaxHandoffDestination {
  const found = TAX_HANDOFF_DESTINATIONS.find((d) => d.id === id);
  if (!found) throw new Error(`Unknown tax handoff: ${id}`);
  return found;
}
