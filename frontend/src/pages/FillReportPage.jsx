import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { errorMessage, fieldErrors } from '../api/client';
import { reportApi } from '../api/endpoints';
import { Alert, Button, Card, ScoreBar, Spinner } from '../components/ui';
import { formatDateTime, formatScore, periodKey, periodTitle, scoreTone } from '../lib/format';

const RESUME_MAX = 5000;

export default function FillReportPage() {
  const [which, setWhich] = useState('current');
  const periods = useQuery({ queryKey: ['periods'], queryFn: reportApi.periods });
  const indicators = useQuery({ queryKey: ['indicators'], queryFn: reportApi.indicators, staleTime: 10 * 60 * 1000 });
  const period = periods.data?.[which];
  const report = useQuery({
    queryKey: ['report', period && periodKey(period)],
    queryFn: () => reportApi.mine(period),
    enabled: !!period,
  });

  const failed = periods.error ?? indicators.error ?? report.error;
  const ready = period && indicators.data && report.isSuccess;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">Mutaba'ah pekanan</h1>
        {period && <p className="mt-1 text-muted">{periodTitle(period)}</p>}
      </div>

      {periods.data && (
        <div role="radiogroup" aria-label="Pilih pekan" className="inline-flex rounded-lg bg-white p-1 ring-1 ring-line">
          {[
            ['current', 'Pekan ini'],
            ['previous', 'Pekan lalu'],
          ].map(([key, label]) => (
            <button
              key={key}
              type="button"
              role="radio"
              aria-checked={which === key}
              onClick={() => setWhich(key)}
              className={`min-h-10 rounded-md px-4 text-sm font-semibold transition-colors ${
                which === key ? 'bg-brand-700 text-white' : 'text-muted hover:text-ink'
              }`}
            >
              {label}
              <span className="sr-only"> ({periodTitle(periods.data[key])})</span>
            </button>
          ))}
        </div>
      )}

      {failed && <Alert>{errorMessage(failed, 'Gagal memuat data')}</Alert>}
      {!failed && !ready && (
        <div className="grid place-items-center py-16 text-brand-700">
          <Spinner label="Memuat form" />
        </div>
      )}
      {ready && (
        <ReportForm key={periodKey(period)} period={period} indicators={indicators.data} existing={report.data} />
      )}
    </div>
  );
}

function ReportForm({ period, indicators, existing }) {
  const queryClient = useQueryClient();
  const [answers, setAnswers] = useState(() =>
    Object.fromEntries((existing?.answers ?? []).map((a) => [a.indicatorId, a.optionId])),
  );
  const [resume, setResume] = useState(existing?.resumeText ?? '');
  const [missing, setMissing] = useState(new Set());
  const [saved, setSaved] = useState(null);
  const [attempted, setAttempted] = useState(false);

  const save = useMutation({
    mutationFn: reportApi.save,
    onSuccess(report) {
      queryClient.setQueryData(['report', periodKey(period)], report);
      queryClient.invalidateQueries({ queryKey: ['history'] });
      setSaved(report);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    },
  });
  const serverErrors = fieldErrors(save.error);

  const chosen = indicators.map((i) => i.options.find((o) => o.id === answers[i.id])).filter(Boolean);
  const answeredCount = chosen.length;
  const preview = answeredCount ? chosen.reduce((s, o) => s + o.score, 0) / indicators.length : 0;

  function choose(indicatorId, optionId) {
    setAnswers((a) => ({ ...a, [indicatorId]: optionId }));
    setMissing((m) => {
      const next = new Set(m);
      next.delete(indicatorId);
      return next;
    });
    setSaved(null);
  }

  function submit(e) {
    e.preventDefault();
    setAttempted(true);
    const unanswered = indicators.filter((i) => !answers[i.id]).map((i) => i.id);
    setMissing(new Set(unanswered));
    if (unanswered.length || !resume.trim()) {
      const first = unanswered[0] ? `indicator-${unanswered[0]}` : 'resume';
      document.getElementById(first)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    save.mutate({
      period: { year: period.year, month: period.month, week: period.week },
      answers: indicators.map((i) => ({ indicatorId: i.id, optionId: answers[i.id] })),
      resumeText: resume,
    });
  }

  const resumeError =
    serverErrors.resumeText ?? (attempted && !resume.trim() ? 'Resume materi wajib diisi' : undefined);
  const tone = scoreTone(saved?.totalScore ?? preview);

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      {saved && (
        <Alert tone="success">
          Jazakallah khairan, laporan {periodTitle(period)} tersimpan dengan skor{' '}
          <strong>{formatScore(saved.totalScore)}</strong>.
        </Alert>
      )}
      {!saved && existing && (
        <Alert tone="info">
          Anda sudah mengisi pekan ini ({formatDateTime(existing.updatedAt)}). Perubahan akan memperbarui laporan.
        </Alert>
      )}
      {save.isError && !Object.keys(serverErrors).length && <Alert>{errorMessage(save.error)}</Alert>}
      {Object.keys(serverErrors).length > 0 && <Alert>Periksa kembali isian yang ditandai.</Alert>}

      {indicators.map((ind, index) => {
        const error =
          serverErrors[`answers.${ind.code}`] ?? (missing.has(ind.id) ? 'Pilih salah satu jawaban' : undefined);
        return (
          <Card key={ind.id} id={`indicator-${ind.id}`} className={`p-4 sm:p-5 ${error ? 'ring-rose-300' : ''}`}>
            <fieldset aria-describedby={error ? `indicator-${ind.id}-err` : undefined}>
              <legend className="flex gap-2 font-semibold">
                <span className="text-muted tabular-nums">{index + 1}.</span>
                {ind.label}
              </legend>
              <div className={`mt-3 grid gap-2 ${ind.type === 'boolean' ? 'grid-cols-2' : 'grid-cols-1 sm:grid-cols-2'}`}>
                {ind.options.map((opt) => (
                  <label key={opt.id} className="relative block cursor-pointer">
                    <input
                      type="radio"
                      name={`indicator-${ind.id}`}
                      value={opt.id}
                      checked={answers[ind.id] === opt.id}
                      onChange={() => choose(ind.id, opt.id)}
                      className="peer sr-only"
                    />
                    <span className="flex min-h-11 items-center rounded-lg px-3 py-2 text-sm ring-1 ring-line transition-colors peer-checked:bg-brand-700 peer-checked:font-semibold peer-checked:text-white peer-checked:ring-brand-700 peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-brand-600 hover:bg-brand-50 peer-checked:hover:bg-brand-700">
                      {opt.label}
                    </span>
                  </label>
                ))}
              </div>
              {error && (
                <p id={`indicator-${ind.id}-err`} className="mt-2 text-sm text-rose-700">
                  {error}
                </p>
              )}
            </fieldset>
          </Card>
        );
      })}

      <Card id="resume" className={`p-4 sm:p-5 ${resumeError ? 'ring-rose-300' : ''}`}>
        <label htmlFor="resume-text" className="font-semibold">
          <span className="text-muted tabular-nums">{indicators.length + 1}.</span> Resume materi UPA pekan ini
        </label>
        <textarea
          id="resume-text"
          rows={5}
          maxLength={RESUME_MAX}
          value={resume}
          onChange={(e) => {
            setResume(e.target.value);
            setSaved(null);
          }}
          aria-invalid={resumeError ? true : undefined}
          aria-describedby="resume-help"
          className={`mt-3 block w-full rounded-lg border bg-white px-3 py-2 text-base outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-100 ${
            resumeError ? 'border-rose-400' : 'border-line'
          }`}
          placeholder="Tuliskan poin-poin materi yang disampaikan"
        />
        <p id="resume-help" className={`mt-1 text-sm ${resumeError ? 'text-rose-700' : 'text-muted'}`}>
          {resumeError ?? `${resume.length}/${RESUME_MAX} karakter`}
        </p>
      </Card>

      <div className="sticky bottom-0 -mx-4 border-t border-line bg-white/95 px-4 py-3 backdrop-blur">
        <div className="flex items-center gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline justify-between text-sm">
              <span className="text-muted">
                {answeredCount}/{indicators.length} amalan terisi
              </span>
              <span className="font-semibold tabular-nums">Skor {formatScore(saved?.totalScore ?? preview)}</span>
            </div>
            <div className="mt-1.5">
              <ScoreBar value={saved?.totalScore ?? preview} className={tone.bar} />
            </div>
          </div>
          <Button type="submit" loading={save.isPending}>
            {existing || saved ? 'Perbarui' : 'Kirim'}
          </Button>
        </div>
      </div>
    </form>
  );
}
