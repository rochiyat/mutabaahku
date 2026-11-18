export const MONTHS = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
];

export const periodTitle = (p) => `Pekan ${p.weekLabel} · ${MONTHS[p.month - 1]} ${p.year}`;

export const periodKey = (p) => `${p.year}-${p.month}-${p.week}`;

export const formatScore = (n) => `${Number(n).toLocaleString('id-ID', { maximumFractionDigits: 1 })}`;

export function formatDateTime(iso) {
  return new Date(iso).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' });
}

/** Text + colour classes for a 0–100 score. */
export function scoreTone(score) {
  if (score >= 80) return { label: 'Sangat baik', className: 'bg-brand-100 text-brand-800', bar: 'bg-brand-600' };
  if (score >= 60) return { label: 'Baik', className: 'bg-lime-100 text-lime-800', bar: 'bg-lime-600' };
  if (score >= 40) return { label: 'Cukup', className: 'bg-amber-100 text-amber-800', bar: 'bg-amber-500' };
  return { label: 'Perlu ditingkatkan', className: 'bg-rose-100 text-rose-800', bar: 'bg-rose-500' };
}
