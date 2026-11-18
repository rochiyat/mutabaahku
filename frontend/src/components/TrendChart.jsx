import { MONTHS, formatScore, scoreTone } from '../lib/format';

const shortMonth = (m) => MONTHS[m - 1].slice(0, 3);

/**
 * Weekly score bars, oldest on the left.
 * `points`: [{ year, month, week, weekLabel, average, submitted? }]
 */
export function TrendChart({ points, showSubmitted = false }) {
  if (!points.length) return <p className="text-sm text-muted">Belum ada data.</p>;

  return (
    <figure>
      <div className="flex items-end gap-1.5 overflow-x-auto pb-1" aria-hidden>
        {points.map((p) => (
          <div key={`${p.year}-${p.month}-${p.week}`} className="flex min-w-8 flex-1 flex-col items-center">
            <span className="mb-1 text-[11px] font-semibold tabular-nums">{formatScore(p.average)}</span>
            <div className="flex h-28 w-full items-end justify-center">
              <div
                className={`w-full max-w-10 rounded-t-md ${scoreTone(p.average).bar}`}
                style={{ height: `${Math.max(2, p.average)}%` }}
              />
            </div>
            <span className="mt-1 text-[11px] leading-tight text-muted">{p.weekLabel}</span>
            <span className="text-[10px] leading-tight text-muted">{shortMonth(p.month)}</span>
          </div>
        ))}
      </div>
      <table className="sr-only">
        <caption>Skor rata-rata per pekan</caption>
        <thead>
          <tr>
            <th>Pekan</th>
            <th>Skor</th>
            {showSubmitted && <th>Laporan</th>}
          </tr>
        </thead>
        <tbody>
          {points.map((p) => (
            <tr key={`${p.year}-${p.month}-${p.week}`}>
              <td>
                Pekan {p.weekLabel} {MONTHS[p.month - 1]} {p.year}
              </td>
              <td>{formatScore(p.average)}</td>
              {showSubmitted && <td>{p.submitted}</td>}
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}

/** Last `n` entries of a newest-first report history, as chart points. */
export function historyToPoints(reports, n = 12) {
  return reports
    .slice(0, n)
    .reverse()
    .map((r) => ({ year: r.year, month: r.month, week: r.week, weekLabel: r.weekLabel, average: r.totalScore }));
}
