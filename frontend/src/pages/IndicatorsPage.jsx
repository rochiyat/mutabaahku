import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { errorMessage, fieldErrors } from '../api/client';
import { adminApi } from '../api/endpoints';
import { Alert, Button, Card, SelectField, Spinner, TextField } from '../components/ui';

const KEY = ['admin-indicators'];

function useIndicatorMutation(fn, onDone) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess(indicators) {
      queryClient.setQueryData(KEY, indicators);
      // Form anggota & dashboard memakai daftar amalan aktif.
      queryClient.invalidateQueries({ queryKey: ['indicators'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      onDone?.(indicators);
    },
  });
}

export default function IndicatorsPage() {
  const indicators = useQuery({ queryKey: KEY, queryFn: adminApi.indicators });

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div>
        <h1 className="text-2xl font-bold">Amalan & skor</h1>
        <p className="mt-1 text-muted">
          Atur pertanyaan di form mutaba'ah dan skor (0–100) tiap jawaban. Skor laporan = rata-rata skor semua amalan.
        </p>
      </div>
      <Alert tone="info">
        Perubahan skor hanya berlaku untuk laporan yang dikirim atau diperbarui setelahnya. Laporan lama tetap memakai skor
        saat dikirim.
      </Alert>

      <AddIndicatorForm />

      {indicators.isPending && (
        <div className="grid place-items-center py-10 text-brand-700">
          <Spinner label="Memuat amalan" />
        </div>
      )}
      {indicators.isError && <Alert>{errorMessage(indicators.error, 'Gagal memuat amalan')}</Alert>}
      {indicators.data && (
        <ol className="space-y-3">
          {indicators.data.map((ind, index) => (
            <li key={ind.id}>
              <IndicatorCard indicator={ind} number={index + 1} />
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

function IndicatorCard({ indicator, number }) {
  const [editing, setEditing] = useState(false);
  const toggle = useIndicatorMutation(() => adminApi.updateIndicator(indicator.id, { isActive: !indicator.isActive }));

  return (
    <Card className={`p-4 sm:p-5 ${indicator.isActive ? '' : 'bg-canvas'}`}>
      {editing ? (
        <EditIndicator indicator={indicator} onClose={() => setEditing(false)} />
      ) : (
        <>
          <div className="flex flex-wrap items-start justify-between gap-2">
            <h2 className="font-semibold">
              <span className="text-muted tabular-nums">{number}.</span> {indicator.label}
              {!indicator.isActive && (
                <span className="ml-2 rounded-full bg-line px-2 py-0.5 text-xs font-semibold text-muted">Nonaktif</span>
              )}
            </h2>
            <span className="text-xs text-muted">{indicator.type === 'boolean' ? 'Ya / Tidak' : 'Pilihan'}</span>
          </div>
          <ul className="mt-3 divide-y divide-line text-sm">
            {indicator.options.map((o) => (
              <li key={o.id} className="flex justify-between gap-4 py-1.5">
                <span>{o.label}</span>
                <span className="font-semibold tabular-nums">{o.score}</span>
              </li>
            ))}
          </ul>
          {toggle.isError && (
            <div className="mt-3">
              <Alert>{errorMessage(toggle.error)}</Alert>
            </div>
          )}
          <div className="mt-3 flex flex-wrap gap-2">
            <Button variant="secondary" className="min-h-9 px-3" onClick={() => setEditing(true)}>
              Ubah label & skor
            </Button>
            <Button
              variant="ghost"
              className={`min-h-9 px-3 ${indicator.isActive ? 'text-rose-700 hover:bg-rose-50' : ''}`}
              loading={toggle.isPending}
              onClick={() => {
                if (
                  indicator.isActive &&
                  !window.confirm(`Sembunyikan "${indicator.label}" dari form mutaba'ah? Jawaban lama tetap tersimpan.`)
                ) {
                  return;
                }
                toggle.mutate();
              }}
            >
              {indicator.isActive ? 'Nonaktifkan' : 'Aktifkan'}
            </Button>
          </div>
        </>
      )}
    </Card>
  );
}

function EditIndicator({ indicator, onClose }) {
  const queryClient = useQueryClient();
  const [label, setLabel] = useState(indicator.label);
  const [options, setOptions] = useState(indicator.options.map((o) => ({ ...o, score: String(o.score) })));
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  const invalid = options.some((o) => !/^\d+$/.test(o.score) || Number(o.score) > 100 || !o.label.trim()) || !label.trim();

  async function save(e) {
    e.preventDefault();
    if (invalid) return;
    setSaving(true);
    setError(null);
    try {
      let latest;
      if (label.trim() !== indicator.label) latest = await adminApi.updateIndicator(indicator.id, { label: label.trim() });
      for (const o of options) {
        const before = indicator.options.find((x) => x.id === o.id);
        const body = {};
        if (o.label.trim() !== before.label) body.label = o.label.trim();
        if (Number(o.score) !== before.score) body.score = Number(o.score);
        if (Object.keys(body).length) latest = await adminApi.updateOption(o.id, body);
      }
      if (latest) {
        queryClient.setQueryData(KEY, latest);
        queryClient.invalidateQueries({ queryKey: ['indicators'] });
        queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      }
      onClose();
    } catch (err) {
      setError(err);
      // Sebagian perubahan mungkin sudah tersimpan.
      queryClient.invalidateQueries({ queryKey: KEY });
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={save} noValidate className="space-y-4">
      <TextField label="Pertanyaan" value={label} onChange={(e) => setLabel(e.target.value)} />
      <fieldset>
        <legend className="mb-2 text-sm font-medium">Pilihan jawaban dan skor</legend>
        <div className="space-y-2">
          {options.map((o, i) => {
            const bad = !/^\d+$/.test(o.score) || Number(o.score) > 100;
            return (
              <div key={o.id} className="flex gap-2">
                <input
                  aria-label={`Label pilihan ${i + 1}`}
                  value={o.label}
                  onChange={(e) => setOptions((all) => all.map((x) => (x.id === o.id ? { ...x, label: e.target.value } : x)))}
                  className="min-h-11 min-w-0 flex-1 rounded-lg border border-line bg-white px-3 text-sm outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-100"
                />
                <input
                  aria-label={`Skor ${o.label}`}
                  inputMode="numeric"
                  value={o.score}
                  aria-invalid={bad || undefined}
                  onChange={(e) => setOptions((all) => all.map((x) => (x.id === o.id ? { ...x, score: e.target.value } : x)))}
                  className={`min-h-11 w-20 rounded-lg border bg-white px-3 text-right text-sm tabular-nums outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-100 ${
                    bad ? 'border-rose-400' : 'border-line'
                  }`}
                />
              </div>
            );
          })}
        </div>
        {invalid && <p className="mt-2 text-sm text-rose-700">Label wajib diisi dan skor harus angka 0–100.</p>}
      </fieldset>
      {error && <Alert>{errorMessage(error)}</Alert>}
      <div className="flex gap-2">
        <Button type="submit" loading={saving} disabled={invalid}>
          Simpan
        </Button>
        <Button type="button" variant="secondary" onClick={onClose}>
          Batal
        </Button>
      </div>
    </form>
  );
}

const BOOLEAN_OPTIONS = [
  { label: 'Ya', score: '100' },
  { label: 'Tidak', score: '0' },
];
const CHOICE_OPTIONS = [
  { label: '', score: '100' },
  { label: '', score: '50' },
  { label: '', score: '0' },
];

function AddIndicatorForm() {
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState('');
  const [type, setType] = useState('boolean');
  const [options, setOptions] = useState(BOOLEAN_OPTIONS);
  const create = useIndicatorMutation(adminApi.createIndicator, () => {
    setOpen(false);
    setLabel('');
    setType('boolean');
    setOptions(BOOLEAN_OPTIONS);
  });
  const errors = fieldErrors(create.error);

  if (!open) {
    return <Button onClick={() => setOpen(true)}>+ Tambah amalan</Button>;
  }

  return (
    <Card className="p-5">
      <h2 className="font-bold">Tambah amalan</h2>
      <form
        className="mt-4 space-y-4"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          create.mutate({
            label: label.trim(),
            type,
            options: options.map((o) => ({ label: o.label.trim(), score: Number(o.score) })),
          });
        }}
      >
        <TextField
          label="Pertanyaan"
          placeholder="contoh: Membaca buku pekan ini"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          error={errors.label}
        />
        <SelectField
          label="Jenis jawaban"
          value={type}
          onChange={(e) => {
            setType(e.target.value);
            setOptions(e.target.value === 'boolean' ? BOOLEAN_OPTIONS : CHOICE_OPTIONS);
          }}
        >
          <option value="boolean">Ya / Tidak</option>
          <option value="choice">Pilihan bertingkat</option>
        </SelectField>
        <fieldset>
          <legend className="mb-2 text-sm font-medium">Pilihan jawaban dan skor (urut dari terbaik)</legend>
          <div className="space-y-2">
            {options.map((o, i) => (
              <div key={i} className="flex gap-2">
                <input
                  aria-label={`Label pilihan ${i + 1}`}
                  placeholder={`Pilihan ${i + 1}`}
                  value={o.label}
                  onChange={(e) => setOptions((all) => all.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))}
                  className="min-h-11 min-w-0 flex-1 rounded-lg border border-line bg-white px-3 text-sm outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-100"
                />
                <input
                  aria-label={`Skor pilihan ${i + 1}`}
                  inputMode="numeric"
                  value={o.score}
                  onChange={(e) => setOptions((all) => all.map((x, j) => (j === i ? { ...x, score: e.target.value } : x)))}
                  className="min-h-11 w-20 rounded-lg border border-line bg-white px-3 text-right text-sm tabular-nums outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-100"
                />
                {type === 'choice' && options.length > 2 && (
                  <button
                    type="button"
                    aria-label={`Hapus pilihan ${i + 1}`}
                    onClick={() => setOptions((all) => all.filter((_, j) => j !== i))}
                    className="min-h-11 rounded-lg px-3 text-muted hover:bg-rose-50 hover:text-rose-700"
                  >
                    ✕
                  </button>
                )}
              </div>
            ))}
          </div>
          {type === 'choice' && options.length < 12 && (
            <Button
              type="button"
              variant="ghost"
              className="mt-2 min-h-9 px-3"
              onClick={() => setOptions((all) => [...all, { label: '', score: '0' }])}
            >
              + Pilihan
            </Button>
          )}
        </fieldset>
        {create.isError && (
          <Alert>
            {Object.keys(errors).length
              ? Object.values(errors).join('. ')
              : errorMessage(create.error)}
          </Alert>
        )}
        <div className="flex gap-2">
          <Button type="submit" loading={create.isPending}>
            Simpan amalan
          </Button>
          <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
            Batal
          </Button>
        </div>
      </form>
    </Card>
  );
}
