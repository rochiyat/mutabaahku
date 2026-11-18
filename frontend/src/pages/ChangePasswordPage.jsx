import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { useMutation } from '@tanstack/react-query';
import { errorMessage, fieldErrors } from '../api/client';
import { authApi } from '../api/endpoints';
import { useAuth } from '../auth/AuthProvider';
import { AuthLayout } from '../components/AppLayout';
import { Alert, Button, TextField } from '../components/ui';

export default function ChangePasswordPage() {
  const { user, setUser, logout } = useAuth();
  const navigate = useNavigate();
  const forced = user.mustChangePassword;
  const [form, setForm] = useState({ currentPassword: '', newPassword: '', confirm: '' });
  const [mismatch, setMismatch] = useState(false);
  const [done, setDone] = useState(false);

  const change = useMutation({
    mutationFn: authApi.changePassword,
    onSuccess(updated) {
      setUser(updated);
      if (forced) navigate('/', { replace: true });
      else {
        setDone(true);
        setForm({ currentPassword: '', newPassword: '', confirm: '' });
      }
    },
  });

  const errors = fieldErrors(change.error);
  const update = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  return (
    <AuthLayout
      title={forced ? 'Buat password Anda' : 'Ganti password'}
      subtitle={
        forced
          ? `Assalamu'alaikum ${user.name}. Ganti password awal sebelum mulai mengisi mutaba'ah.`
          : 'Perangkat lain yang sedang masuk akan otomatis keluar.'
      }
    >
      <form
        className="space-y-4"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          setDone(false);
          const differs = form.newPassword !== form.confirm;
          setMismatch(differs);
          if (!differs) change.mutate({ currentPassword: form.currentPassword, newPassword: form.newPassword });
        }}
      >
        {done && <Alert tone="success">Password berhasil diganti.</Alert>}
        {change.isError && !Object.keys(errors).length && <Alert>{errorMessage(change.error)}</Alert>}
        <TextField
          label={forced ? 'Password awal' : 'Password lama'}
          type="password"
          autoComplete="current-password"
          value={form.currentPassword}
          onChange={update('currentPassword')}
          error={errors.currentPassword}
        />
        <TextField
          label="Password baru"
          type="password"
          autoComplete="new-password"
          hint="Minimal 8 karakter"
          value={form.newPassword}
          onChange={update('newPassword')}
          error={errors.newPassword}
        />
        <TextField
          label="Ulangi password baru"
          type="password"
          autoComplete="new-password"
          value={form.confirm}
          onChange={update('confirm')}
          error={mismatch ? 'Password tidak sama' : undefined}
        />
        <Button type="submit" className="w-full" loading={change.isPending}>
          Simpan password
        </Button>
        {forced ? (
          <button
            type="button"
            onClick={async () => {
              await logout();
              navigate('/login', { replace: true });
            }}
            className="block w-full text-center text-sm font-semibold text-muted hover:text-ink"
          >
            Keluar
          </button>
        ) : (
          <Link to="/" className="block text-center text-sm font-semibold text-brand-700 hover:underline">
            Kembali
          </Link>
        )}
      </form>
    </AuthLayout>
  );
}
