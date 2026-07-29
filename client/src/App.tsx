import { useEffect, useState } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { AuthPanel } from './components/AuthPanel';
import { Markets } from './pages/Markets';
import { api, type Account } from './lib/api';
import { auth } from './lib/firebase';
import './App.css';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [account, setAccount] = useState<Account | null>(null);

  useEffect(() => onAuthStateChanged(auth, setUser), []);

  useEffect(() => {
    if (!user) {
      setAccount(null);
      return;
    }
    void api<Account>('/me').then(setAccount).catch(() => setAccount(null));
  }, [user]);

  return (
    <div className="app">
      <header className="header">
        <span className="brand">Onyx Paper Trader</span>
        <nav className="tabs">
          <button className="tab tab-active">Markets</button>
        </nav>
        <div className="spacer" />
        <AuthPanel user={user} account={account} />
      </header>
      <main>
        <Markets />
      </main>
    </div>
  );
}
