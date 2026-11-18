import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { errorMessage } from '../api/client';
import { reportApi } from '../api/endpoints';
import { formatDateTime, formatScore, periodKey, periodTitle, scoreTone } from '../lib/format';
import { Alert, Card, ScoreBar, Spinner } from './ui';

/**
 * Expandable list of weekly reports.
 * `loadReport(period)` fetches one full report; `cacheKey` scopes its query cache.
 */
export function ReportList({ reports, loadReport, cacheKey }) {
  const [openKey, setOpenKey] = useState(null);

  return (
    <ul className="space-y-3">
      {reports.map((r) => {
        const key = periodKey(r);
        const open = openKey === key;
        const tone = scoreTone(r.totalScore);
        return (
          <li key={r.id}>
            <Card>
              <button
                type="button"
                onClick={() => setOpenKey(open ? null : key)}
                aria-expanded={open}
                aria-controls={`report-${r.id}`}
                className="w-full p-4 text-left"
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="font-semibold">{periodTitle(r)}</span>
                  <span className={`rounded-full px-2.5 py-0.5 text-sm font-semibold tabular-nums ${tone.className}`}>
                    {formatScore(r.totalScore)}
                  </span>
                </div>
                <div className="mt-3">
                  <ScoreBar value={r.totalScore} className={tone.bar} />
                </div>
                <p className="mt-2 text-xs text-muted">
                  {tone.label} · diperbarui {formatDateTime(r.updatedAt)}
                </p>
              </button>
              {open && (
                <div id={`report-${r.id}`} className="border-t border-line p-4">
                  <ReportDetail period={r} loadReport={loadReport} cacheKey={cacheKey} />
                </div>
              )}
            </Card>
          </li>
        );
      })}
    </ul>
  );
}

function ReportDetail({ period, loadReport, cacheKey }) {
  const indicators = useQuery({ queryKey: ['indicators'], queryFn: reportApi.indicators, staleTime: 10 * 60 * 1000 });
  const report = useQuery({ queryKey: [...cacheKey, periodKey(period)], queryFn: () => loadReport(period) });

  if (indicators.isError || report.isError) return <Alert>{errorMessage(indicators.error ?? report.error)}</Alert>;
  if (!indicators.data || !report.data) return <Spinner small label="Memuat detail" />;

  const byIndicator = new Map(report.data.answers.map((a) => [a.indicatorId, a]));
  return (
    <div className="space-y-4">
      <dl className="divide-y divide-line text-sm">
        {indicators.data.map((ind) => {
          const answer = byIndicator.get(ind.id);
          const option = ind.options.find((o) => o.id === answer?.optionId);
          return (
            <div key={ind.id} className="flex justify-between gap-4 py-2">
              <dt className="text-muted">{ind.label}</dt>
              <dd className="text-right font-medium">{option?.label ?? '—'}</dd>
            </div>
          );
        })}
      </dl>
      <div>
        <p className="text-sm font-semibold">Resume materi</p>
        <p className="mt-1 whitespace-pre-line text-sm text-muted">{report.data.resumeText}</p>
      </div>
    </div>
  );
}
