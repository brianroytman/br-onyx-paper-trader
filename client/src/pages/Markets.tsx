import { useEffect, useRef, useState } from 'react';
import { MarketsTable } from '../components/MarketsTable';
import { OrderTicket, type Ticket } from '../components/OrderTicket';
import type { Market, MarketPage } from '../lib/types';

const POLL_MS = 3000;
const PAGE_SIZE = 50;

interface Props {
  authed?: boolean;
  cashCents?: number | null;
  onFilled?: () => void;
}

export function Markets({ authed = false, cashCents = null, onFilled }: Props) {
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('open');
  const [page, setPage] = useState<MarketPage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  // Refs so the interval always reads current filters without resubscribing.
  const filters = useRef({ query, status });
  filters.current = { query, status };

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      const { query: q, status: s } = filters.current;
      const params = new URLSearchParams({ status: s, limit: String(PAGE_SIZE) });
      if (q) params.set('q', q);

      try {
        const res = await fetch(`/api/markets?${params}`);
        if (!res.ok) throw new Error(`Request failed (${res.status})`);
        const body: MarketPage = await res.json();
        if (!cancelled) {
          setPage(body);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Unknown error');
      }
    };

    void load();
    const timer = setInterval(load, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);

  const handleBuy = (market: Market, side: 'YES' | 'NO') => setTicket({ market, side });

  const handleFilled = (message: string) => {
    setToast(message);
    onFilled?.();
    setTimeout(() => setToast(null), 5000);
  };

  return (
    <section>
      <div className="toolbar">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search markets"
        />
        <select value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="open">Open</option>
          <option value="closed">Closed</option>
          <option value="halted">Halted</option>
          <option value="all">All</option>
        </select>
        {page && (
          <span className="muted">
            {page.total.toLocaleString()} markets · updated{' '}
            {new Date(page.fetchedAt).toLocaleTimeString()}
          </span>
        )}
      </div>

      {toast && <p className="toast">{toast}</p>}
      {error && <p className="error">Could not load markets: {error}</p>}
      {!page && !error && <p className="muted">Loading markets…</p>}
      {page && (
        <MarketsTable markets={page.markets} onBuy={authed ? handleBuy : undefined} />
      )}
      {page && !authed && (
        <p className="muted">Log in to place orders.</p>
      )}
      {page && page.total > PAGE_SIZE && (
        <p className="muted">
          Showing the first {PAGE_SIZE} of {page.total.toLocaleString()} — refine your
          search to narrow the list.
        </p>
      )}

      {ticket && (
        <OrderTicket
          ticket={ticket}
          cashCents={cashCents}
          onClose={() => setTicket(null)}
          onFilled={handleFilled}
        />
      )}
    </section>
  );
}
