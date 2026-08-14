type EzPassFacilityMap = Readonly<Record<string, string>>;

const FACILITIES_BY_AGENCY: Readonly<Record<string, EzPassFacilityMap>> = {
  GSP: {
    BLN: 'Bloomfield North',
    BLS: 'Bloomfield South',
    EOR: 'East Orange',
    ESS: 'Essex',
    IRS: 'Irvington South',
    RAS: 'Raritan South',
    SAB: 'Saddle Brook',
    UNI: 'Union',
    UNR: 'Union Ramp',
  },
  PANYNJ: {
    BB: 'Bayonne Bridge',
    GB: 'Goethals Bridge',
    GWL: 'George Washington Bridge Lower Level',
    GWU: 'George Washington Bridge Upper Level',
    HT: 'Holland Tunnel',
    LT: 'Lincoln Tunnel',
    OBX: 'Outerbridge Crossing',
  },
  'MTAB&T': {
    HCT: 'Hugh L. Carey Tunnel',
    QMT: 'Queens-Midtown Tunnel',
    TNB: 'Throgs Neck Bridge',
    VNB: 'Verrazzano-Narrows Bridge',
  },
  CBDTP: {
    CRZ: 'Congestion Relief Zone',
  },
};

const FACILITY_ENTRIES = Object.values(FACILITIES_BY_AGENCY)
  .flatMap((facilities) => Object.entries(facilities));
const FACILITY_CODE_COUNTS = FACILITY_ENTRIES.reduce<Record<string, number>>(
  (counts, [code]) => ({ ...counts, [code]: (counts[code] ?? 0) + 1 }),
  {},
);
const UNAMBIGUOUS_FACILITIES: EzPassFacilityMap = Object.fromEntries(
  FACILITY_ENTRIES.filter(([code]) => FACILITY_CODE_COUNTS[code] === 1),
);

function codeAndName(code: string, name: string): string {
  return `${code} - ${name}`;
}

/**
 * Expands the terse plaza codes found in E-ZPass downloads for display without
 * changing the stored merchant or its import fingerprint. Unknown values are
 * deliberately returned unchanged rather than guessed.
 */
export function displayEzPassMerchantName(merchant: string): string {
  const trimmed = merchant.trim();
  if (!trimmed) return merchant;

  const creditMatch = trimmed.match(/^Toll Credit\s*[·-]\s*(.+)$/i);
  if (creditMatch) {
    const expanded = displayEzPassMerchantName(creditMatch[1]);
    return expanded === creditMatch[1]
      ? trimmed
      : `Toll Credit · ${expanded}`;
  }

  const normalized = trimmed.toUpperCase();
  const agencyMatch = normalized.match(/^(GSP|PANYNJ|MTAB&T|CBDTP)\s+([A-Z0-9]+)$/);
  if (agencyMatch) {
    const [, agency, code] = agencyMatch;
    const name = FACILITIES_BY_AGENCY[agency]?.[code];
    return name ? codeAndName(code, name) : merchant;
  }

  const name = UNAMBIGUOUS_FACILITIES[normalized];
  return name ? codeAndName(normalized, name) : merchant;
}
