import { useState } from 'react';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  type User,
} from 'firebase/auth';
import { auth } from '../lib/firebase';
import { formatUsd, type Account } from '../lib/api';

interface Props {
  user: User | null;
  account: Account | null;
}

export function AuthPanel({ user, account }: Props) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (err) {
      setError(err instanceof Error ? err.message.replace('Firebase: ', '') : 'Failed');
    } finally {
      setBusy(false);
    }
  };

  if (user) {
    return (
      <div className="account">
        {account && (
          <span className="stat">
            <span className="muted">Cash</span> {formatUsd(account.cashCents)}
          </span>
        )}
        <span className="muted">{user.email}</span>
        <button onClick={() => void signOut(auth)}>Log out</button>
      </div>
    );
  }

  return (
    <div className="account">
      <input
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="email"
        style={{ minWidth: 180 }}
      />
      <input
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        type="password"
        placeholder="password"
        style={{ minWidth: 140 }}
      />
      <button
        disabled={busy}
        onClick={() => void run(() => signInWithEmailAndPassword(auth, email, password))}
      >
        Log in
      </button>
      <button
        disabled={busy}
        onClick={() => void run(() => createUserWithEmailAndPassword(auth, email, password))}
      >
        Sign up
      </button>
      {error && <span className="error">{error}</span>}
    </div>
  );
}
