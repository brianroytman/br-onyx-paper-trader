import { Markets } from './pages/Markets';
import './App.css';

export default function App() {
  return (
    <div className="app">
      <header className="header">
        <span className="brand">Onyx Paper Trader</span>
        <nav className="tabs">
          <button className="tab tab-active">Markets</button>
        </nav>
      </header>
      <main>
        <Markets />
      </main>
    </div>
  );
}
