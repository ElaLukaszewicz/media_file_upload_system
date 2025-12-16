import { Navigate, Route, Routes } from 'react-router-dom';
import UploadsPage from './pages/Uploads';
import HistoryPage from './pages/History';
import { NavLink } from './components';
import styles from './App.module.scss';

const navItems = [
  { to: '/uploads', label: 'uploads' },
  { to: '/history', label: 'history' },
];

export default function App() {
  return (
    <div className={styles.app}>
      <header className={styles.appHeader}>
        <h1 className={styles.headline}>Media upload system</h1>
        <nav className={styles.nav} aria-label="Primary navigation">
          {navItems.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.to === '/'}>
              {item.label}
            </NavLink>
          ))}
        </nav>
      </header>

      <main className={styles.appMain}>
        <Routes>
          <Route path="/" element={<Navigate to="/uploads" replace />} />
          <Route path="/uploads" element={<UploadsPage />} />
          <Route path="/history" element={<HistoryPage />} />
        </Routes>
      </main>
    </div>
  );
}
