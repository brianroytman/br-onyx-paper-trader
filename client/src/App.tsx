import { useCallback, useEffect, useState } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { AuthPanel } from './components/AuthPanel';
import { Markets } from './pages/Markets';
import { Portfolio } from './pages/Portfolio';
import { api, type Account } from './lib/api';
import { auth } from './lib/firebase';
import './App.css';

type Tab = 'markets' | 'portfolio';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [account, setAccount] = useState<Account | null>(null);
  const [tab, setTab] = useState<Tab>('markets');
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => onAuthStateChanged(auth, setUser), []);

  const refreshAccount = useCallback(() => {
    if (!auth.currentUser) return;
    void api<Account>('/me').then(setAccount).catch(() => undefined);
    setRefreshKey((k) => k + 1);
  }, []);

  useEffect(() => {
    if (!user) {
      setAccount(null);
      setTab('markets');
      return;
    }
    refreshAccount();
  }, [user, refreshAccount]);

  return (
    <div className="app">
      <header className="header">
        <span className="brand">Onyx Paper Trader</span>
        <nav className="tabs">
          <button
            className={`tab ${tab === 'markets' ? 'tab-active' : ''}`}
            onClick={() => setTab('markets')}
          >
            Markets
          </button>
          {user && (
            <button
              className={`tab ${tab === 'portfolio' ? 'tab-active' : ''}`}
              onClick={() => setTab('portfolio')}
            >
              Portfolio
            </button>
          )}
        </nav>
        <div className="spacer" />
        <AuthPanel user={user} account={account} />
      </header>
      <main>
        {tab === 'markets' ? (
          <Markets
            authed={!!user}
            cashCents={account?.cashCents ?? null}
            onFilled={refreshAccount}
          />
        ) : (
          <Portfolio refreshKey={refreshKey} />
        )}
      </main>
    </div>
  );
}
