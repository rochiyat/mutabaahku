import { Link, Route, Routes } from 'react-router';
import { useAuth } from './auth/AuthProvider';
import { GuestOnly, RequireAuth } from './auth/guards';
import { AppLayout } from './components/AppLayout';
import ChangePasswordPage from './pages/ChangePasswordPage';
import FillReportPage from './pages/FillReportPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import HistoryPage from './pages/HistoryPage';
import LoginPage from './pages/LoginPage';
import MurabbiHomePage from './pages/MurabbiHomePage';
import ResetPasswordPage from './pages/ResetPasswordPage';

function Home() {
  const { user } = useAuth();
  return user.role === 'murabbi' ? <MurabbiHomePage /> : <FillReportPage />;
}

function NotFound() {
  return (
    <main className="grid min-h-dvh place-items-center px-4 text-center">
      <div>
        <h1 className="text-xl font-bold">Halaman tidak ditemukan</h1>
        <Link to="/" className="mt-3 inline-block font-semibold text-brand-700">
          Kembali ke beranda
        </Link>
      </div>
    </main>
  );
}

export default function App() {
  return (
    <Routes>
      <Route element={<GuestOnly />}>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/lupa-password" element={<ForgotPasswordPage />} />
      </Route>
      {/* Reachable signed in or out: the link comes from an email. */}
      <Route path="/reset-password" element={<ResetPasswordPage />} />

      <Route element={<RequireAuth allowMustChange />}>
        <Route path="/ganti-password" element={<ChangePasswordPage />} />
      </Route>

      <Route element={<RequireAuth />}>
        <Route element={<AppLayout />}>
          <Route index element={<Home />} />
          <Route element={<RequireAuth roles={['anggota']} />}>
            <Route path="/riwayat" element={<HistoryPage />} />
          </Route>
        </Route>
      </Route>

      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
