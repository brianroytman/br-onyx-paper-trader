import { useState } from 'react';
import { api, formatUsd } from '../lib/api';
import { formatCents, type Market } from '../lib/types';

export interface Ticket {
  market: Market;
  side: 'YES' | 'NO';
}

interface Props {
  ticket: Ticket;
  cashCents: number | null;
  onClose: () => void;
  onFilled: (message: string) => void;
}

export function OrderTicket({ ticket, cashCents, onClose, onFilled }: Props) {
  const [quantity, setQuantity] = useState(10);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { market, side } = ticket;
  const quotedCents = side === 'YES' ? market.yesPriceCents : market.noPriceCents;
  const estimatedCents = (quotedCents ?? 0) * quantity;

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await api<{ order: { quantity: number; fillPriceCents: number } }>(
        '/orders',
        {
          method: 'POST',
          body: JSON.stringify({ marketId: market.id, side, quantity }),
        },
      );
      onFilled(
        `Filled ${res.order.quantity} ${side} @ ${res.order.fillPriceCents}¢`,
      );
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Order failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="overlay" onClick={onClose}>
      <div className="ticket" onClick={(e) => e.stopPropagation()}>
        <h3>Buy {side.toLowerCase()}</h3>
        <p className="muted ticket-market">{market.name}</p>

        <div className="row">
          <span className="muted">Quoted price</span>
          <span className="num">{formatCents(quotedCents)}</span>
        </div>
        <div className="row">
          <span className="muted">Quantity</span>
          <input
            type="number"
            min={1}
            step={1}
            value={quantity}
            onChange={(e) => setQuantity(Math.max(1, Math.floor(+e.target.value || 1)))}
            style={{ minWidth: 90, width: 90 }}
          />
        </div>
        <div className="row divider">
          <span className="muted">Estimated cost</span>
          <span className="num">{formatUsd(estimatedCents)}</span>
        </div>
        {cashCents !== null && (
          <div className="row">
            <span className="muted">Cash after</span>
            <span className="num">{formatUsd(cashCents - estimatedCents)}</span>
          </div>
        )}

        <p className="muted note">
          Fills at the price the server fetches at execution time, which may differ from
          the quote above.
        </p>

        {error && <p className="error">{error}</p>}

        <div className="ticket-actions">
          <button onClick={onClose}>Cancel</button>
          <button onClick={() => void submit()} disabled={busy}>
            {busy ? 'Placing…' : 'Confirm order'}
          </button>
        </div>
      </div>
    </div>
  );
}
