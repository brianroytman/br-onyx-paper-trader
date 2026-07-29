import {
  averageEntryCents,
  marketValueCents,
  totalEquityCents,
  unrealizedPnlCents,
} from './portfolio.math';

const position = { quantity: 300, totalCostCents: 17400 }; // 300 @ 58c

describe('averageEntryCents', () => {
  it('is total cost over quantity', () => {
    expect(averageEntryCents(position)).toBe(58);
  });

  it('is zero for an empty position', () => {
    expect(averageEntryCents({ quantity: 0, totalCostCents: 0 })).toBe(0);
  });
});

describe('marketValueCents', () => {
  it('marks the position to the current price', () => {
    expect(marketValueCents(position, 64)).toBe(19200);
  });

  it('falls back to cost basis when the market is unpriced', () => {
    expect(marketValueCents(position, null)).toBe(17400);
  });
});

describe('unrealizedPnlCents', () => {
  it('is positive when the price has risen', () => {
    expect(unrealizedPnlCents(position, 64)).toBe(1800);
  });

  it('is negative when the price has fallen', () => {
    expect(unrealizedPnlCents(position, 50)).toBe(-2400);
  });

  it('is zero at the entry price', () => {
    expect(unrealizedPnlCents(position, 58)).toBe(0);
  });

  it('is zero rather than a phantom loss when unpriced', () => {
    expect(unrealizedPnlCents(position, null)).toBe(0);
  });
});

describe('totalEquityCents', () => {
  it('is cash plus every position value', () => {
    expect(totalEquityCents(82600, [19200, 8430])).toBe(110230);
  });

  it('is just cash with no positions', () => {
    expect(totalEquityCents(100000, [])).toBe(100000);
  });
});
