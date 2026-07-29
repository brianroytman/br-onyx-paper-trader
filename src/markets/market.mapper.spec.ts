import {
  noPriceFromYes,
  toCents,
  toDisplayName,
  toMarket,
  toStatus,
} from './market.mapper';
import { OnyxMarket } from './market.types';

const raw: OnyxMarket = {
  id: 'abc',
  symbol: 'NX.F.OPT.MLB-1',
  sport: 'OTHER',
  name: 'Mets vs Phillies ; Juan Soto To Get A Hit ; 260716',
  event_name: null,
  status: 'open',
  expiry_date: '2026-11-30T23:59:59Z',
  min_price: 0.01,
  max_price: 0.99,
  yes_price: 0.49,
};

describe('toCents', () => {
  it('converts a probability to integer cents', () => {
    expect(toCents(0.49)).toBe(49);
    expect(toCents(0.4)).toBe(40);
    expect(toCents(0.14)).toBe(14);
  });

  it('absorbs binary floating-point error in the upstream price', () => {
    // 0.29 * 100 is 28.999999999999996 in IEEE 754.
    expect(toCents(0.29)).toBe(29);
    expect(toCents(0.57)).toBe(57);
  });

  it('returns null for a missing price', () => {
    expect(toCents(null)).toBeNull();
    expect(toCents(undefined)).toBeNull();
  });

  it('rejects prices outside the tradable band', () => {
    expect(toCents(0)).toBeNull();
    expect(toCents(1)).toBeNull();
    expect(toCents(1.5)).toBeNull();
  });
});

describe('noPriceFromYes', () => {
  it('is the complement of the yes price', () => {
    expect(noPriceFromYes(49)).toBe(51);
    expect(noPriceFromYes(1)).toBe(99);
  });

  it('is null when yes is unpriced', () => {
    expect(noPriceFromYes(null)).toBeNull();
  });
});

describe('toStatus', () => {
  it('passes through known statuses', () => {
    expect(toStatus('open')).toBe('open');
    expect(toStatus('halted')).toBe('halted');
  });

  it('defaults unknown or missing statuses to closed', () => {
    expect(toStatus('something-new')).toBe('closed');
    expect(toStatus(null)).toBe('closed');
  });
});

describe('toDisplayName', () => {
  it('collapses the semicolon-delimited upstream name', () => {
    expect(toDisplayName('A ; B ; C')).toBe('A · B · C');
  });

  it('drops empty trailing segments', () => {
    expect(toDisplayName('Pro Baseball Champion 2026 ; Dodgers ;')).toBe(
      'Pro Baseball Champion 2026 · Dodgers',
    );
  });
});

describe('toMarket', () => {
  it('maps a priced open market', () => {
    const market = toMarket(raw);
    expect(market.yesPriceCents).toBe(49);
    expect(market.noPriceCents).toBe(51);
    expect(market.status).toBe('open');
    expect(market.tradable).toBe(true);
  });

  it('marks an unpriced market as not tradable', () => {
    const market = toMarket({ ...raw, yes_price: null });
    expect(market.yesPriceCents).toBeNull();
    expect(market.noPriceCents).toBeNull();
    expect(market.tradable).toBe(false);
  });

  it('marks a closed market as not tradable even when priced', () => {
    const market = toMarket({ ...raw, status: 'closed' });
    expect(market.yesPriceCents).toBe(49);
    expect(market.tradable).toBe(false);
  });
});
