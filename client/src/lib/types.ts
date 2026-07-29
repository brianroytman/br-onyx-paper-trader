export interface Market {
  id: string;
  symbol: string;
  name: string;
  sport: string | null;
  league: string | null;
  status: 'open' | 'closed' | 'halted';
  expiryDate: string | null;
  yesPriceCents: number | null;
  noPriceCents: number | null;
  tradable: boolean;
}

export interface MarketPage {
  markets: Market[];
  total: number;
  leagues: string[];
  fetchedAt: string;
}

export const formatCents = (c: number | null) => (c === null ? '—' : `${c}¢`);

export const formatDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : '—';
