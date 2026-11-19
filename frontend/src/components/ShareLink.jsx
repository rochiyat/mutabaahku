import { useId, useState } from 'react';
import { formatDateTime } from '../lib/format';
import { Button } from './ui';

/**
 * Shows a password/invite link the murabbi passes on personally:
 * copy the ready-made message, or open WhatsApp with it.
 */
export function ShareLink({ title, share, onClose }) {
  const [copied, setCopied] = useState(null);
  const id = useId();

  async function copy(what, text) {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // Clipboard API butuh HTTPS; fallback: pilih teks supaya bisa disalin manual.
      document.getElementById(`${id}-msg`)?.select();
      return;
    }
    setCopied(what);
    setTimeout(() => setCopied(null), 2000);
  }

  return (
    <section className="rounded-xl bg-brand-50 p-4 ring-1 ring-brand-200" aria-labelledby={`${id}-title`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 id={`${id}-title`} className="font-bold text-brand-900">
            {title}
          </h2>
          <p className="mt-0.5 text-sm text-brand-800">
            Kirim pesan ini secara pribadi. Link hanya bisa dipakai sekali, berlaku sampai{' '}
            {formatDateTime(share.expiresAt)}.
            {share.emailed && ' Salinannya juga sudah dikirim ke email.'}
          </p>
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup"
            className="-m-1 rounded-lg p-2 text-brand-800 hover:bg-brand-100"
          >
            ✕
          </button>
        )}
      </div>

      <label htmlFor={`${id}-msg`} className="sr-only">
        Pesan undangan
      </label>
      <textarea
        id={`${id}-msg`}
        readOnly
        rows={6}
        value={share.message}
        onFocus={(e) => e.target.select()}
        className="mt-3 block w-full resize-none rounded-lg border border-brand-200 bg-white px-3 py-2 text-sm"
      />

      <div className="mt-3 flex flex-wrap gap-2">
        <a
          href={`https://wa.me/?text=${encodeURIComponent(share.message)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-11 items-center rounded-lg bg-brand-700 px-4 text-sm font-semibold text-white hover:bg-brand-800"
        >
          Kirim lewat WhatsApp
        </a>
        <Button variant="secondary" onClick={() => copy('message', share.message)}>
          {copied === 'message' ? 'Tersalin ✓' : 'Salin pesan'}
        </Button>
        <Button variant="secondary" onClick={() => copy('link', share.link)}>
          {copied === 'link' ? 'Tersalin ✓' : 'Salin link saja'}
        </Button>
      </div>
      <p className="sr-only" aria-live="polite">
        {copied ? 'Tersalin ke clipboard' : ''}
      </p>
    </section>
  );
}
