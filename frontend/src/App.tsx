import { Link, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { ReportForm } from './pages/ReportForm.js';
import { ReportList } from './pages/ReportList.js';
import { ConnectivityProvider } from './connectivity.js';
import { SyncBanner } from './components/SyncBanner.js';

export function App() {
  const location = useLocation();
  const navigate = useNavigate();
  const currentRole = location.pathname.startsWith('/coordinator') ? 'coordinator' : 'field_worker';

  return (
    <ConnectivityProvider>
    <div className="app-shell">
      <header className="topbar">
        <Link className="brand" to="/" aria-label="Fieldnote home">
          <span className="brand-mark">F</span>
          <span>fieldnote</span>
        </Link>
        <nav aria-label="Main navigation">
          <Link to="/" aria-current={currentRole === 'field_worker' ? 'page' : undefined}>Field reports</Link>
          <Link to="/coordinator" aria-current={currentRole === 'coordinator' ? 'page' : undefined}>Coordinator</Link>
        </nav>
        <label className="role-switch">
          <span>Viewing as</span>
          <select aria-label="Viewing as" value={currentRole} onChange={(event) => navigate(event.target.value === 'coordinator' ? '/coordinator' : '/')}>
            <option value="field_worker">Field worker</option>
            <option value="coordinator">Coordinator</option>
          </select>
        </label>
      </header>
      <SyncBanner />
      <main>
        <Routes>
          <Route path="/" element={<ReportList />} />
          <Route path="/reports/new" element={<ReportForm />} />
          <Route path="/coordinator" element={<section className="welcome"><p className="eyebrow">COORDINATOR DESK</p><h1>Review and move issues forward.</h1><p>Live reports and status actions will appear here.</p></section>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      <footer>Fieldnote <span>·</span> Offline-ready issue tracking</footer>
    </div>
    </ConnectivityProvider>
  );
}
