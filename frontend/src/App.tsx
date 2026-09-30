import { Link, Navigate, Route, Routes } from 'react-router-dom';

export function App() {
  return (
    <div className="app-shell">
      <header className="topbar">
        <Link className="brand" to="/" aria-label="Fieldnote home">
          <span className="brand-mark">F</span>
          <span>fieldnote</span>
        </Link>
        <nav aria-label="Main navigation">
          <Link to="/">Field reports</Link>
          <Link to="/coordinator">Coordinator</Link>
        </nav>
        <label className="role-switch">
          <span>Viewing as</span>
          <select aria-label="Viewing as" defaultValue="field_worker">
            <option value="field_worker">Field worker</option>
            <option value="coordinator">Coordinator</option>
          </select>
        </label>
      </header>
      <main>
        <Routes>
          <Route path="/" element={<section className="welcome"><p className="eyebrow">FIELD OPERATIONS</p><h1>Issues, captured wherever the work takes you.</h1><p>Your reports will stay on this device and sync when you’re back online.</p></section>} />
          <Route path="/coordinator" element={<section className="welcome"><p className="eyebrow">COORDINATOR DESK</p><h1>Review and move issues forward.</h1><p>Live reports and status actions will appear here.</p></section>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      <footer>Fieldnote <span>·</span> Offline-ready issue tracking</footer>
    </div>
  );
}
