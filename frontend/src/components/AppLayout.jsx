import { useState } from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router';
import { useAuth } from '../auth/AuthProvider';

const navClass = ({ isActive }) =>
  `rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
    isActive ? 'bg-brand-50 text-brand-800' : 'text-muted hover:text-ink'
  }`;

export function AppLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [loggingOut, setLoggingOut] = useState(false);

  async function handleLogout() {
    setLoggingOut(true);
    await logout();
    navigate('/login', { replace: true });
  }

  const links =
    user.role === 'anggota'
      ? [
          { to: '/', label: "Isi Mutaba'ah", end: true },
          { to: '/riwayat', label: 'Riwayat' },
        ]
      : user.role === 'admin'
        ? [
            { to: '/', label: 'Dashboard', end: true },
            { to: '/pengguna', label: 'Pengguna' },
            { to: '/amalan', label: 'Amalan' },
          ]
        : [
            // murabbi: dashboard + amalan only
            { to: '/', label: 'Dashboard', end: true },
            { to: '/amalan', label: 'Amalan' },
          ];

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-10 border-b border-line bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
          <Link to="/" className="mr-auto text-lg font-bold text-brand-800">
            Mutaba'ahku
          </Link>
          <div className="flex items-center gap-1 text-sm">
            <span className="hidden text-muted sm:inline">{user.name}</span>
            <NavLink to="/ganti-password" className={navClass}>
              Password
            </NavLink>
            <button
              type="button"
              onClick={handleLogout}
              disabled={loggingOut}
              className="rounded-lg px-3 py-2 font-medium text-muted hover:text-ink"
            >
              Keluar
            </button>
          </div>
          <nav aria-label="Menu utama" className="flex w-full gap-1 sm:order-none">
            {links.map((l) => (
              <NavLink key={l.to} to={l.to} end={l.end} className={navClass}>
                {l.label}
              </NavLink>
            ))}
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}

/** Centered card for login and password pages. */
export function AuthLayout({ title, subtitle, children }) {
  return (
    <main className="grid min-h-dvh place-items-center px-4 py-10">
      <div className="w-full max-w-sm">
        <p className="mb-6 text-center text-lg font-bold text-brand-800">Mutaba'ahku</p>
        <div className="rounded-2xl bg-white p-6 ring-1 ring-line sm:p-8">
          <h1 className="text-xl font-bold">{title}</h1>
          {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
          <div className="mt-6">{children}</div>
        </div>
      </div>
    </main>
  );
}
