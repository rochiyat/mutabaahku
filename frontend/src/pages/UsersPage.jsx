import { useState } from 'react';
import { Link } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { errorMessage, fieldErrors } from '../api/client';
import { adminApi } from '../api/endpoints';
import { useAuth } from '../auth/AuthProvider';
import { Alert, Button, Card, Spinner, TextField } from '../components/ui';
import { formatDateTime } from '../lib/format';

const USERS_KEY = ['admin-users'];

export default function UsersPage() {
  const users = useQuery({ queryKey: USERS_KEY, queryFn: adminApi.users });
  const [notice, setNotice] = useState(null);

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div>
        <h1 className="text-2xl font-bold">Pengguna</h1>
        <p className="mt-1 text-muted">
          Tambah anggota, ganti email, kirim link password, atau nonaktifkan anggota yang sudah tidak ikut UPA.
        </p>
      </div>

      {notice && <Alert tone="success">{notice}</Alert>}
      <AddMemberForm onAdded={(u) => setNotice(`${u.name} ditambahkan. Link undangan dikirim ke ${u.email}.`)} />

      {users.isPending && (
        <div className="grid place-items-center py-10 text-brand-700">
          <Spinner label="Memuat pengguna" />
        </div>
      )}
      {users.isError && <Alert>{errorMessage(users.error, 'Gagal memuat pengguna')}</Alert>}
      {users.data && (
        <ul className="space-y-3">
          {users.data.map((u) => (
            <li key={u.id}>
              <UserRow user={u} onNotice={setNotice} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function AddMemberForm({ onAdded }) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: '', email: '' });
  const create = useMutation({
    mutationFn: adminApi.createUser,
    onSuccess(user) {
      queryClient.invalidateQueries({ queryKey: USERS_KEY });
      queryClient.invalidateQueries({ queryKey: ['dashboard-filters'] });
      setForm({ name: '', email: '' });
      setOpen(false);
      onAdded(user);
    },
  });
  const errors = fieldErrors(create.error);

  if (!open) {
    return <Button onClick={() => setOpen(true)}>+ Tambah anggota</Button>;
  }

  return (
    <Card className="p-5">
      <h2 className="font-bold">Tambah anggota</h2>
      <p className="mt-1 text-sm text-muted">Anggota akan menerima email berisi link untuk membuat password.</p>
      <form
        className="mt-4 space-y-4"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          create.mutate(form);
        }}
      >
        {create.isError && !Object.keys(errors).length && <Alert>{errorMessage(create.error)}</Alert>}
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            label="Nama"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            error={errors.name}
            autoComplete="off"
          />
          <TextField
            label="Email"
            type="email"
            value={form.email}
            onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            error={errors.email}
            autoComplete="off"
          />
        </div>
        <div className="flex gap-2">
          <Button type="submit" loading={create.isPending}>
            Tambah & kirim undangan
          </Button>
          <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
            Batal
          </Button>
        </div>
      </form>
    </Card>
  );
}

function UserRow({ user, onNotice }) {
  const { user: me } = useAuth();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ name: user.name, email: user.email });
  const isSelf = user.id === me.id;

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: USERS_KEY });
    queryClient.invalidateQueries({ queryKey: ['dashboard-filters'] });
    queryClient.invalidateQueries({ queryKey: ['dashboard'] });
  };

  const update = useMutation({
    mutationFn: (body) => adminApi.updateUser(user.id, body),
    onSuccess(updated, body) {
      refresh();
      setEditing(false);
      if (isSelf) queryClient.invalidateQueries({ queryKey: ['me'] });
      if (body.isActive === false) onNotice(`${updated.name} dinonaktifkan.`);
      else if (body.isActive === true) onNotice(`${updated.name} diaktifkan kembali.`);
      else onNotice(`Data ${updated.name} disimpan.`);
    },
  });
  const sendLink = useMutation({
    mutationFn: () => adminApi.sendPasswordLink(user.id),
    onSuccess: () => onNotice(`Link password dikirim ke ${user.email}.`),
  });
  const errors = fieldErrors(update.error);
  const failure = (update.isError && !Object.keys(errors).length && update.error) || sendLink.error;

  return (
    <Card className={`p-4 ${user.isActive ? '' : 'bg-canvas'}`}>
      {editing ? (
        <form
          className="space-y-4"
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            const body = {};
            if (form.name !== user.name) body.name = form.name;
            if (form.email !== user.email) body.email = form.email;
            if (Object.keys(body).length) update.mutate(body);
            else setEditing(false);
          }}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField
              label="Nama"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              error={errors.name}
            />
            <TextField
              label="Email"
              type="email"
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              error={errors.email}
            />
          </div>
          {failure && <Alert>{errorMessage(failure)}</Alert>}
          <div className="flex gap-2">
            <Button type="submit" loading={update.isPending}>
              Simpan
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setForm({ name: user.name, email: user.email });
                update.reset();
                setEditing(false);
              }}
            >
              Batal
            </Button>
          </div>
        </form>
      ) : (
        <>
          <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
            <div className="min-w-0">
              <p className="flex flex-wrap items-center gap-2 font-semibold">
                {user.role === 'anggota' && user.isActive ? (
                  <Link to={`/anggota/${user.id}`} className="hover:underline">
                    {user.name}
                  </Link>
                ) : (
                  user.name
                )}
                {user.role === 'murabbi' && <Badge className="bg-brand-100 text-brand-800">Murabbi</Badge>}
                {!user.isActive && <Badge className="bg-line text-muted">Nonaktif</Badge>}
                {user.isActive && user.mustChangePassword && (
                  <Badge className="bg-amber-100 text-amber-800">Belum membuat password</Badge>
                )}
              </p>
              <p className="truncate text-sm text-muted">{user.email}</p>
              {user.role === 'anggota' && (
                <p className="mt-1 text-xs text-muted">
                  {user.reportCount} laporan
                  {user.lastReportAt && ` · terakhir ${formatDateTime(user.lastReportAt)}`}
                </p>
              )}
            </div>
          </div>
          {failure && (
            <div className="mt-3">
              <Alert>{errorMessage(failure)}</Alert>
            </div>
          )}
          <div className="mt-3 flex flex-wrap gap-2">
            <Button variant="secondary" className="min-h-9 px-3" onClick={() => setEditing(true)}>
              Ubah
            </Button>
            {user.isActive && !isSelf && (
              <Button
                variant="secondary"
                className="min-h-9 px-3"
                loading={sendLink.isPending}
                onClick={() => sendLink.mutate()}
              >
                {user.mustChangePassword ? 'Kirim ulang undangan' : 'Kirim link reset password'}
              </Button>
            )}
            {!isSelf && (
              <Button
                variant="ghost"
                className={`min-h-9 px-3 ${user.isActive ? 'text-rose-700 hover:bg-rose-50' : ''}`}
                loading={update.isPending && !editing}
                onClick={() => {
                  if (
                    user.isActive &&
                    !window.confirm(
                      `Nonaktifkan ${user.name}? Ia tidak bisa masuk dan tidak dihitung di dashboard. Laporan lamanya tetap tersimpan.`,
                    )
                  ) {
                    return;
                  }
                  update.mutate({ isActive: !user.isActive });
                }}
              >
                {user.isActive ? 'Nonaktifkan' : 'Aktifkan kembali'}
              </Button>
            )}
          </div>
        </>
      )}
    </Card>
  );
}

function Badge({ className, children }) {
  return <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${className}`}>{children}</span>;
}
