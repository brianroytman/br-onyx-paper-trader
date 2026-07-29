import { useEffect, useRef } from 'react';
import { formatCents, formatDate, type Market } from '../lib/types';

/** Flashes a cell green or red when its price changes, so live updates are visible. */
function PriceCell({ cents }: { cents: number | null }) {
  const previous = useRef<number | null>(null);
  const ref = useRef<HTMLTableCellElement>(null);

  useEffect(() => {
    const before = previous.current;
    previous.current = cents;
    if (before === null || cents === null || before === cents || !ref.current) return;

    ref.current.style.background = cents > before ? '#1d9e75' : '#e24b4a';
    const timer = setTimeout(() => {
      if (ref.current) ref.current.style.background = 'transparent';
    }, 600);
    return () => clearTimeout(timer);
  }, [cents]);

  return (
    <td ref={ref} className="num" style={{ transition: 'background 400ms' }}>
      {formatCents(cents)}
    </td>
  );
}

interface Props {
  markets: Market[];
  onBuy?: (market: Market, side: 'YES' | 'NO') => void;
  disabled?: boolean;
}

export function MarketsTable({ markets, onBuy, disabled }: Props) {
  if (markets.length === 0) {
    return <p className="muted">No markets match this filter.</p>;
  }

  return (
    <table className="table">
      <thead>
        <tr>
          <th>Market</th>
          <th>Status</th>
          <th>Expires</th>
          <th className="num">Yes</th>
          <th className="num">No</th>
          <th />
        </tr>
      </thead>
      <tbody>
        {markets.map((m) => (
          <tr key={m.id}>
            <td>{m.name}</td>
            <td>
              <span className={`badge badge-${m.status}`}>{m.status}</span>
            </td>
            <td className="muted">{formatDate(m.expiryDate)}</td>
            <PriceCell cents={m.yesPriceCents} />
            <PriceCell cents={m.noPriceCents} />
            <td className="actions">
              {m.tradable && onBuy ? (
                <>
                  <button disabled={disabled} onClick={() => onBuy(m, 'YES')}>
                    Buy yes
                  </button>
                  <button disabled={disabled} onClick={() => onBuy(m, 'NO')}>
                    Buy no
                  </button>
                </>
              ) : (
                <span className="muted">
                  {m.status !== 'open' ? 'Market closed' : 'No price'}
                </span>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
