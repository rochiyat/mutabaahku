import { useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { errorMessage, fieldErrors } from '../api/client';
import { authApi } from '../api/endpoints';
import { AuthLayout } from '../components/AppLayout';
import { Alert, Button, TextField } from '../components/ui';

export default function ResetPasswordPage() {
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const queryClient = useQueryClient();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [mismatch, setMismatch] = useState(false);

  const reset = useMutation({
    mutationFn: authApi.resetPassword,
    // Any session in this browser was signed out by the password change.
    onSuccess: () => queryClient.setQueryData(['me'], null),
  });
  const errors = fieldErrors(reset.error);

  if (!token) {
    return (
      <AuthLayout title="Link tidak valid">
        <Alert>Link reset password tidak lengkap. Pastikan link disalin utuh, atau minta link baru.</Alert>
        <Link to="/lupa-password" className="mt-4 block text-center text-sm font-semibold text-brand-700 hover:underline">
          Minta link baru
        </Link>
      </AuthLayout>
    );
  }

  if (reset.isSuccess) {
    return (
      <AuthLayout title="Password diganti">
        <Alert tone="success">Password baru sudah disimpan. Silakan masuk dengan password baru.</Alert>
        <Link to="/login" className="mt-4 block text-center text-sm font-semibold text-brand-700 hover:underline">
          Ke halaman masuk
        </Link>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title="Buat password baru">
      <form
        className="space-y-4"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          const differs = password !== confirm;
          setMismatch(differs);
          if (!differs) reset.mutate({ token, newPassword: password });
        }}
      >
        {reset.isError && !errors.newPassword && (
          <Alert>
            {errorMessage(reset.error)}{' '}
            <Link to="/lupa-password" className="font-semibold underline">
              Minta link baru
            </Link>
          </Alert>
        )}
        <TextField
          label="Password baru"
          type="password"
          autoComplete="new-password"
          hint="Minimal 8 karakter"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={errors.newPassword}
        />
        <TextField
          label="Ulangi password baru"
          type="password"
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          error={mismatch ? 'Password tidak sama' : undefined}
        />
        <Button type="submit" className="w-full" loading={reset.isPending}>
          Simpan password
        </Button>
      </form>
    </AuthLayout>
  );
}
