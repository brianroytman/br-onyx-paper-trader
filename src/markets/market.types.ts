export type MarketStatus = 'open' | 'closed' | 'halted';

/** Raw shape returned by the Onyx Predictions API. */
export interface OnyxMarket {
  id: string;
  symbol: string;
  sport: string | null;
  name: string;
  event_name: string | null;
  status: string;
  expiry_date: string | null;
  min_price: number | null;
  max_price: number | null;
  yes_price: number | null;
}

/** Internal representation. Onyx's shape never leaves the mapper. */
export interface Market {
  id: string;
  symbol: string;
  name: string;
  sport: string | null;
  status: MarketStatus;
  expiryDate: string | null;
  /** 1-99, or null when upstream has no price for this market. */
  yesPriceCents: number | null;
  /** Complement of YES. Binary market, so NO = 100 - YES. */
  noPriceCents: number | null;
  /** Only tradable when open and priced. */
  tradable: boolean;
}
