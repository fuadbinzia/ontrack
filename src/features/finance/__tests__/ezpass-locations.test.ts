import { displayEzPassMerchantName } from '../ezpass-locations';

describe('E-ZPass facility names', () => {
  it('expands Garden State Parkway plaza codes shown by E-ZPass', () => {
    expect(displayEzPassMerchantName('Gsp Uni')).toBe('UNI - Union');
    expect(displayEzPassMerchantName('Gsp Irs')).toBe('IRS - Irvington South');
    expect(displayEzPassMerchantName('Gsp Unr')).toBe('UNR - Union Ramp');
    expect(displayEzPassMerchantName('Gsp Bls')).toBe('BLS - Bloomfield South');
    expect(displayEzPassMerchantName('Gsp Eor')).toBe('EOR - East Orange');
    expect(displayEzPassMerchantName('Gsp Ras')).toBe('RAS - Raritan South');
  });

  it('expands regional crossing codes and toll credits', () => {
    expect(displayEzPassMerchantName('Panynj Ht')).toBe('HT - Holland Tunnel');
    expect(displayEzPassMerchantName('Mtab&T Vnb')).toBe(
      'VNB - Verrazzano-Narrows Bridge',
    );
    expect(displayEzPassMerchantName('Toll Credit · Crz')).toBe(
      'Toll Credit · CRZ - Congestion Relief Zone',
    );
  });

  it('does not guess unknown or already descriptive merchant names', () => {
    expect(displayEzPassMerchantName('Gsp XYZ')).toBe('Gsp XYZ');
    expect(displayEzPassMerchantName('RFK Bridge')).toBe('RFK Bridge');
    expect(displayEzPassMerchantName('E-ZPass NY Payment')).toBe('E-ZPass NY Payment');
  });
});
