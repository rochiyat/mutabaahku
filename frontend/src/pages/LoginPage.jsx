import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';
import { useMutation } from '@tanstack/react-query';
import { errorMessage, fieldErrors } from '../api/client';
import { authApi } from '../api/endpoints';
import { useAuth } from '../auth/AuthProvider';
import { AuthLayout } from '../components/AppLayout';
import { Alert, Button, TextField } from '../components/ui';

export default function LoginPage() {
  const { setUser } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({ email: '', password: '' });

  const login = useMutation({
    mutationFn: authApi.login,
    onSuccess(user) {
      setUser(user);
      const target = user.mustChangePassword ? '/ganti-password' : (location.state?.from ?? '/');
      navigate(target, { replace: true });
    },
  });

  const errors = fieldErrors(login.error);
  const update = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  return (
    <AuthLayout title="Masuk" subtitle="Mutaba'ah yaumiah pekanan UPA">
      <form
        className="space-y-4"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          login.mutate(form);
        }}
      >
        {login.isError && !Object.keys(errors).length && <Alert>{errorMessage(login.error)}</Alert>}
        <TextField
          label="Email"
          type="email"
          autoComplete="email"
          inputMode="email"
          required
          value={form.email}
          onChange={update('email')}
          error={errors.email}
        />
        <TextField
          label="Password"
          type="password"
          autoComplete="current-password"
          required
          value={form.password}
          onChange={update('password')}
          error={errors.password}
        />
        <Button type="submit" className="w-full" loading={login.isPending}>
          Masuk
        </Button>
        <p className="text-center text-sm">
          <Link to="/lupa-password" className="font-semibold text-brand-700 hover:underline">
            Lupa password?
          </Link>
        </p>
      </form>
    </AuthLayout>
  );
}
