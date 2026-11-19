import { useState } from 'react';
import { Link } from 'react-router';
import { useMutation, useQuery } from '@tanstack/react-query';
import { errorMessage, fieldErrors } from '../api/client';
import { authApi } from '../api/endpoints';
import { AuthLayout } from '../components/AppLayout';
import { Alert, Button, Spinner, TextField } from '../components/ui';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const forgot = useMutation({ mutationFn: authApi.forgotPassword });
  const options = useQuery({ queryKey: ['auth-options'], queryFn: authApi.options, staleTime: Infinity });
  const errors = fieldErrors(forgot.error);

  if (options.isPending) {
    return (
      <AuthLayout title="Lupa password">
        <Spinner label="Memuat" />
      </AuthLayout>
    );
  }

  if (options.data && !options.data.emailEnabled) {
    return (
      <AuthLayout title="Lupa password">
        <div className="space-y-4">
          <p className="text-sm">
            Hubungi murabbi Antum dan minta <strong>link reset password</strong>. Murabbi akan mengirimkannya secara
            pribadi, misalnya lewat WhatsApp. Buka link itu untuk membuat password baru.
          </p>
          <Link to="/login" className="block text-center text-sm font-semibold text-brand-700 hover:underline">
            Kembali ke halaman masuk
          </Link>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title="Lupa password" subtitle="Kami kirim link untuk membuat password baru ke email Anda.">
      {forgot.isSuccess ? (
        <div className="space-y-4">
          <Alert tone="success">
            Jika <strong>{email}</strong> terdaftar, link reset password sudah dikirim. Cek kotak masuk atau folder spam.
            Link berlaku 60 menit.
          </Alert>
          <Link to="/login" className="block text-center text-sm font-semibold text-brand-700 hover:underline">
            Kembali ke halaman masuk
          </Link>
        </div>
      ) : (
        <form
          className="space-y-4"
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            forgot.mutate({ email });
          }}
        >
          {forgot.isError && !errors.email && <Alert>{errorMessage(forgot.error)}</Alert>}
          <TextField
            label="Email"
            type="email"
            autoComplete="email"
            inputMode="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            error={errors.email}
          />
          <Button type="submit" className="w-full" loading={forgot.isPending}>
            Kirim link reset
          </Button>
          <Link to="/login" className="block text-center text-sm font-semibold text-brand-700 hover:underline">
            Kembali ke halaman masuk
          </Link>
        </form>
      )}
    </AuthLayout>
  );
}
