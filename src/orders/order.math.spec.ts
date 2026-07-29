import { Market } from '../markets/market.types';
import {
  assertSufficientFunds,
  assertValidQuantity,
  assertValidSide,
  averageEntryCents,
  mergePosition,
  orderCostCents,
  OrderValidationError,
  selectPriceCents,
} from './order.math';

const market: Market = {
  id: 'm1',
  symbol: 'NX.SYM',
  name: 'Test market',
  sport: 'OTHER',
  status: 'open',
  expiryDate: null,
  yesPriceCents: 58,
  noPriceCents: 42,
  tradable: true,
};

describe('assertValidQuantity', () => {
  it('accepts positive integers', () => {
    expect(assertValidQuantity(300)).toBe(300);
  });

  it('rejects zero and negatives', () => {
    expect(() => assertValidQuantity(0)).toThrow(OrderValidationError);
    expect(() => assertValidQuantity(-5)).toThrow(OrderValidationError);
  });

  it('rejects fractional contracts', () => {
    expect(() => assertValidQuantity(1.5)).toThrow(OrderValidationError);
  });

  it('rejects non-numbers', () => {
    expect(() => assertValidQuantity('300')).toThrow(OrderValidationError);
    expect(() => assertValidQuantity(NaN)).toThrow(OrderValidationError);
  });
});

describe('assertValidSide', () => {
  it('accepts YES and NO', () => {
    expect(assertValidSide('YES')).toBe('YES');
    expect(assertValidSide('NO')).toBe('NO');
  });

  it('rejects anything else', () => {
    expect(() => assertValidSide('MAYBE')).toThrow(OrderValidationError);
  });
});

describe('selectPriceCents', () => {
  it('picks the side-specific price', () => {
    expect(selectPriceCents(market, 'YES')).toBe(58);
    expect(selectPriceCents(market, 'NO')).toBe(42);
  });

  it('refuses a market that is not open', () => {
    expect(() => selectPriceCents({ ...market, status: 'closed' }, 'YES')).toThrow(
      OrderValidationError,
    );
  });

  it('refuses an unpriced side', () => {
    expect(() =>
      selectPriceCents({ ...market, yesPriceCents: null, noPriceCents: null }, 'YES'),
    ).toThrow(OrderValidationError);
  });
});

describe('orderCostCents', () => {
  it('multiplies price by quantity in integer cents', () => {
    expect(orderCostCents(58, 300)).toBe(17400);
  });

  it('stays exact where floating point would not', () => {
    // 0.58 * 300 in floats is 173.99999999999997
    expect(orderCostCents(58, 300)).toBe(17400);
    expect(orderCostCents(7, 3)).toBe(21);
  });
});

describe('assertSufficientFunds', () => {
  it('allows spending the entire balance', () => {
    expect(() => assertSufficientFunds(17400, 17400)).not.toThrow();
  });

  it('rejects one cent of overdraft', () => {
    expect(() => assertSufficientFunds(17399, 17400)).toThrow(OrderValidationError);
  });
});

describe('mergePosition', () => {
  it('opens a new position', () => {
    expect(mergePosition(null, 300, 17400)).toEqual({
      quantity: 300,
      totalCostCents: 17400,
    });
  });

  it('adds to an existing position', () => {
    const existing = { quantity: 300, totalCostCents: 17400 };
    expect(mergePosition(existing, 100, 6200)).toEqual({
      quantity: 400,
      totalCostCents: 23600,
    });
  });
});

describe('averageEntryCents', () => {
  it('is total cost over quantity', () => {
    expect(averageEntryCents({ quantity: 300, totalCostCents: 17400 })).toBe(58);
  });

  it('weights fills bought at different prices', () => {
    // 300 @ 58c then 100 @ 62c => 23600 / 400 = 59c
    const merged = mergePosition({ quantity: 300, totalCostCents: 17400 }, 100, 6200);
    expect(averageEntryCents(merged)).toBe(59);
  });

  it('is zero for an empty position', () => {
    expect(averageEntryCents({ quantity: 0, totalCostCents: 0 })).toBe(0);
  });
});
