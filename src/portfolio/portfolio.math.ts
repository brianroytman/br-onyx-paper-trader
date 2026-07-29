/**
 * Portfolio valuation as pure functions. Nothing here touches the database or
 * the network, so every rule is directly testable.
 */

export interface HeldPosition {
  quantity: number;
  totalCostCents: number;
}

/** Average price paid per contract, derived rather than stored. */
export function averageEntryCents(position: HeldPosition): number {
  if (position.quantity === 0) return 0;
  return position.totalCostCents / position.quantity;
}

/**
 * Worth of a holding at the current price. When upstream has no price for the
 * market we fall back to cost basis rather than failing the whole request or
 * reporting a phantom loss.
 */
export function marketValueCents(
  position: HeldPosition,
  currentPriceCents: number | null,
): number {
  if (currentPriceCents === null) return position.totalCostCents;
  return currentPriceCents * position.quantity;
}

export function unrealizedPnlCents(
  position: HeldPosition,
  currentPriceCents: number | null,
): number {
  return marketValueCents(position, currentPriceCents) - position.totalCostCents;
}

/** Cash plus the mark-to-market value of every open position. */
export function totalEquityCents(
  cashCents: number,
  positionValuesCents: number[],
): number {
  return positionValuesCents.reduce((sum, v) => sum + v, cashCents);
}
