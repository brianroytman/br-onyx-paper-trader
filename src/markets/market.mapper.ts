import { Market, MarketStatus, OnyxMarket } from './market.types';

const VALID_STATUSES: MarketStatus[] = ['open', 'closed', 'halted'];

export function toStatus(raw: string | null | undefined): MarketStatus {
  const normalized = (raw ?? '').toLowerCase();
  return (VALID_STATUSES as string[]).includes(normalized)
    ? (normalized as MarketStatus)
    : 'closed';
}

/**
 * Onyx quotes probabilities in [0, 1] with two decimals. We store and display
 * integer cents so that no monetary value is ever a float.
 */
export function toCents(price: number | null | undefined): number | null {
  if (price === null || price === undefined) return null;
  if (!Number.isFinite(price)) return null;
  const cents = Math.round(price * 100);
  if (cents < 1 || cents > 99) return null;
  return cents;
}

/**
 * Onyx exposes only yes_price. These are binary contracts that settle at 100c,
 * so the NO side is the complement.
 */
export function noPriceFromYes(yesCents: number | null): number | null {
  return yesCents === null ? null : 100 - yesCents;
}

/** Cleans "Mets vs Phillies ; Mets -2.5 ; Citizens Bank Park ; 260716". */
export function toDisplayName(name: string | null | undefined): string {
  if (!name) return 'Untitled market';
  return name
    .split(';')
    .map((part) => part.trim())
    .filter(Boolean)
    .join(' · ');
}

/**
 * Upstream reports `sport: "OTHER"` for essentially everything, but the symbol
 * encodes the league: NX.F.OPT.MLB-00001-2026.O.1.10 -> MLB.
 */
export function toLeague(symbol: string | null | undefined): string | null {
  if (!symbol) return null;
  const segment = symbol.split('.')[3];
  if (!segment) return null;
  const league = segment.split('-')[0]?.trim().toUpperCase();
  return league && /^[A-Z0-9]{2,6}$/.test(league) ? league : null;
}

export function toMarket(raw: OnyxMarket): Market {
  const status = toStatus(raw.status);
  const yesPriceCents = toCents(raw.yes_price);

  return {
    id: raw.id,
    symbol: raw.symbol,
    name: toDisplayName(raw.name),
    sport: raw.sport ?? null,
    league: toLeague(raw.symbol),
    status,
    expiryDate: raw.expiry_date ?? null,
    yesPriceCents,
    noPriceCents: noPriceFromYes(yesPriceCents),
    tradable: status === 'open' && yesPriceCents !== null,
  };
}
