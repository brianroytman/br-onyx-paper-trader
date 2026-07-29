import { useEffect, useRef, useState } from 'react';
import { MarketsTable } from '../components/MarketsTable';
import type { MarketPage } from '../lib/types';

const POLL_MS = 3000;
const PAGE_SIZE = 50;

export function Markets() {
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('open');
  const [page, setPage] = useState<MarketPage | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Refs so the polling interval always reads current filters without resubscribing.
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

      {error && <p className="error">Could not load markets: {error}</p>}
      {!page && !error && <p className="muted">Loading markets…</p>}
      {page && <MarketsTable markets={page.markets} />}
      {page && page.total > PAGE_SIZE && (
        <p className="muted">
          Showing the first {PAGE_SIZE} of {page.total.toLocaleString()} — refine your search
          to narrow the list.
        </p>
      )}
    </section>
  );
}
