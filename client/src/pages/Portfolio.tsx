import { useEffect, useState } from 'react';
import { api, formatUsd } from '../lib/api';
import { formatCents } from '../lib/types';

interface PositionRow {
  marketId: string;
  marketName: string;
  side: 'YES' | 'NO';
  quantity: number;
  averageEntryCents: number;
  currentPriceCents: number | null;
  marketValueCents: number;
  unrealizedPnlCents: number;
}

interface OrderRow {
  id: string;
  marketName: string;
  side: 'YES' | 'NO';
  quantity: number;
  fillPriceCents: number;
  totalCents: number;
  createdAt: string;
}

interface PortfolioData {
  cashCents: number;
  positionsValueCents: number;
  unrealizedPnlCents: number;
  totalEquityCents: number;
  positions: PositionRow[];
  orders: OrderRow[];
}

const pnlClass = (cents: number) => (cents >= 0 ? 'pnl-up' : 'pnl-down');
const signed = (cents: number) => `${cents >= 0 ? '+' : '−'}${formatUsd(Math.abs(cents))}`;

export function Portfolio({ refreshKey }: { refreshKey: number }) {
  const [data, setData] = useState<PortfolioData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = () =>
      api<PortfolioData>('/portfolio')
        .then((d) => !cancelled && setData(d))
        .catch((e) => !cancelled && setError(e.message));

    void load();
    const timer = setInterval(load, 5000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [refreshKey]);

  if (error) return <p className="error">{error}</p>;
  if (!data) return <p className="muted">Loading portfolio…</p>;

  return (
    <section>
      <div className="cards">
        <div className="card">
          <p className="muted">Cash</p>
          <p className="card-value">{formatUsd(data.cashCents)}</p>
        </div>
        <div className="card">
          <p className="muted">Positions</p>
          <p className="card-value">{formatUsd(data.positionsValueCents)}</p>
        </div>
        <div className="card">
          <p className="muted">Unrealized P&amp;L</p>
          <p className={`card-value ${pnlClass(data.unrealizedPnlCents)}`}>
            {signed(data.unrealizedPnlCents)}
          </p>
        </div>
        <div className="card">
          <p className="muted">Total equity</p>
          <p className="card-value">{formatUsd(data.totalEquityCents)}</p>
        </div>
      </div>

      <h3 className="section-title">Positions</h3>
      {data.positions.length === 0 ? (
        <p className="muted">No open positions. Buy YES or NO on the Markets tab.</p>
      ) : (
        <table className="table">
          <thead>
            <tr>
              <th>Market</th>
              <th>Side</th>
              <th className="num">Qty</th>
              <th className="num">Avg entry</th>
              <th className="num">Current</th>
              <th className="num">Value</th>
              <th className="num">Unrealized P&amp;L</th>
            </tr>
          </thead>
          <tbody>
            {data.positions.map((p) => (
              <tr key={`${p.marketId}-${p.side}`}>
                <td>{p.marketName}</td>
                <td>
                  <span className={`badge badge-${p.side.toLowerCase()}`}>{p.side}</span>
                </td>
                <td className="num">{p.quantity}</td>
                <td className="num">{p.averageEntryCents.toFixed(1)}¢</td>
                <td className="num">{formatCents(p.currentPriceCents)}</td>
                <td className="num">{formatUsd(p.marketValueCents)}</td>
                <td className={`num ${pnlClass(p.unrealizedPnlCents)}`}>
                  {signed(p.unrealizedPnlCents)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <h3 className="section-title">Order history</h3>
      {data.orders.length === 0 ? (
        <p className="muted">No orders yet.</p>
      ) : (
        <table className="table">
          <thead>
            <tr>
              <th>Time</th>
              <th>Market</th>
              <th>Side</th>
              <th className="num">Qty</th>
              <th className="num">Fill</th>
              <th className="num">Cost</th>
            </tr>
          </thead>
          <tbody>
            {data.orders.map((o) => (
              <tr key={o.id}>
                <td className="muted">{new Date(o.createdAt).toLocaleTimeString()}</td>
                <td>{o.marketName}</td>
                <td>
                  <span className={`badge badge-${o.side.toLowerCase()}`}>{o.side}</span>
                </td>
                <td className="num">{o.quantity}</td>
                <td className="num">{o.fillPriceCents}¢</td>
                <td className="num">{formatUsd(o.totalCents)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
