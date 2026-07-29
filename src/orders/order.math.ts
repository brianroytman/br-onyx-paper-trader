import { Market } from '../markets/market.types';

export type Side = 'YES' | 'NO';

/**
 * All order arithmetic lives here as pure functions: values in, values out, no
 * I/O. This is the part of the system where correctness matters most, so it is
 * the part that is easiest to test exhaustively.
 */

export class OrderValidationError extends Error {}

export function assertValidQuantity(quantity: unknown): number {
  if (typeof quantity !== 'number' || !Number.isFinite(quantity)) {
    throw new OrderValidationError('Quantity must be a number');
  }
  if (!Number.isInteger(quantity)) {
    throw new OrderValidationError('Quantity must be a whole number of contracts');
  }
  if (quantity <= 0) {
    throw new OrderValidationError('Quantity must be greater than zero');
  }
  return quantity;
}

export function assertValidSide(side: unknown): Side {
  if (side !== 'YES' && side !== 'NO') {
    throw new OrderValidationError('Side must be YES or NO');
  }
  return side;
}

/** The price the order fills at, taken from the server's view of the market. */
export function selectPriceCents(market: Market, side: Side): number {
  if (market.status !== 'open') {
    throw new OrderValidationError('Market is not open for trading');
  }
  const price = side === 'YES' ? market.yesPriceCents : market.noPriceCents;
  if (price === null) {
    throw new OrderValidationError('Market has no price for that side');
  }
  return price;
}

export function orderCostCents(priceCents: number, quantity: number): number {
  return priceCents * quantity;
}

export function assertSufficientFunds(cashCents: number, totalCents: number): void {
  if (totalCents > cashCents) {
    throw new OrderValidationError('Insufficient balance for this order');
  }
}

export interface PositionState {
  quantity: number;
  totalCostCents: number;
}

/** Buying more of a side adds to quantity and to cost basis. */
export function mergePosition(
  existing: PositionState | null,
  quantity: number,
  totalCents: number,
): PositionState {
  return {
    quantity: (existing?.quantity ?? 0) + quantity,
    totalCostCents: (existing?.totalCostCents ?? 0) + totalCents,
  };
}

/**
 * Derived rather than stored, so it can never disagree with quantity and cost.
 * Returns cents, unrounded, for display formatting by the caller.
 */
export function averageEntryCents(position: PositionState): number {
  if (position.quantity === 0) return 0;
  return position.totalCostCents / position.quantity;
}
