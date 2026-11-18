import { Link, useSearchParams } from 'react-router';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { errorMessage } from '../api/client';
import { dashboardApi } from '../api/endpoints';
import { TrendChart } from '../components/TrendChart';
import { Alert, Button, Card, ScoreBar, SelectField, Spinner } from '../components/ui';
import { MONTHS, formatScore, scoreTone } from '../lib/format';

const ROMAN = ['I', 'II', 'III', 'IV', 'V'];
const FILTER_KEYS = ['year', 'month', 'week', 'userId'];

export default function DashboardPage() {
  const options = useQuery({ queryKey: ['dashboard-filters'], queryFn: dashboardApi.filters });

  if (options.isError) return <Alert>{errorMessage(options.error, 'Gagal memuat dashboard')}</Alert>;
  if (!options.data) {
    return (
      <div className="grid place-items-center py-16 text-brand-700">
        <Spinner label="Memuat dashboard" />
      </div>
    );
  }
  return <Dashboard options={options.data} />;
}

function Dashboard({ options }) {
  const [params, setParams] = useSearchParams();
  const { current } = options;

  // Without any filter in the URL, show this week. An explicit "" means "semua".
  const untouched = !FILTER_KEYS.some((k) => params.has(k));
  const defaults = { year: String(current.year), month: String(current.month), week: String(current.week), userId: '' };
  const filter = Object.fromEntries(FILTER_KEYS.map((k) => [k, untouched ? defaults[k] : (params.get(k) ?? '')]));

  const overview = useQuery({
    queryKey: ['dashboard', filter],
    queryFn: () => dashboardApi.overview(filter),
    placeholderData: keepPreviousData,
  });

  function setFilter(key, value) {
    setParams({ ...filter, [key]: value }, { replace: true });
  }

  const isCurrentWeek =
    filter.year === defaults.year && filter.month === defaults.month && filter.week === defaults.week && !filter.userId;
  const data = overview.data;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">Dashboard evaluasi pekanan</h1>
        <p className="mt-1 text-muted">{describeFilter(filter, options.members)}</p>
      </div>

      <Card className="p-4">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <SelectField label="Tahun" value={filter.year} onChange={(e) => setFilter('year', e.target.value)}>
            <option value="">Semua tahun</option>
            {options.years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </SelectField>
          <SelectField label="Bulan" value={filter.month} onChange={(e) => setFilter('month', e.target.value)}>
            <option value="">Semua bulan</option>
            {MONTHS.map((m, i) => (
              <option key={m} value={i + 1}>
                {m}
              </option>
            ))}
          </SelectField>
          <SelectField label="Pekan" value={filter.week} onChange={(e) => setFilter('week', e.target.value)}>
            <option value="">Semua pekan</option>
            {ROMAN.map((r, i) => (
              <option key={r} value={i + 1}>
                Pekan {r}
              </option>
            ))}
          </SelectField>
          <SelectField label="Anggota" value={filter.userId} onChange={(e) => setFilter('userId', e.target.value)}>
            <option value="">Semua anggota</option>
            {options.members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </SelectField>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {!isCurrentWeek && (
            <Button variant="ghost" onClick={() => setParams({}, { replace: true })}>
              Kembali ke pekan ini
            </Button>
          )}
          <a
            href={dashboardApi.exportUrl(filter)}
            download
            className="inline-flex min-h-11 items-center rounded-lg px-4 text-sm font-semibold text-brand-700 ring-1 ring-line hover:bg-brand-50"
          >
            Unduh CSV
          </a>
        </div>
      </Card>

      {overview.isError && <Alert>{errorMessage(overview.error, 'Gagal memuat data')}</Alert>}
      {!data && !overview.isError && (
        <div className="grid place-items-center py-16 text-brand-700">
          <Spinner label="Memuat data" />
        </div>
      )}

      {data && (
        <div className={`space-y-5 transition-opacity ${overview.isPlaceholderData ? 'opacity-60' : ''}`} aria-busy={overview.isFetching}>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat label="Total laporan" value={data.summary.totalReports} />
            <Stat
              label="Sudah mengisi"
              value={
                <>
                  {data.summary.submitted}
                  <span className="text-base font-semibold text-muted"> / {data.summary.members}</span>
                </>
              }
              tone="text-brand-700"
            />
            <Stat label="Belum mengisi" value={data.summary.notSubmitted} tone={data.summary.notSubmitted ? 'text-rose-700' : ''} />
            <Stat
              label="Rata-rata kelompok"
              value={data.summary.average === null ? '—' : formatScore(data.summary.average)}
            />
          </div>

          <div className="grid gap-5 lg:grid-cols-2">
            <Card className="p-5">
              <h2 className="font-bold">Skor rata-rata per amalan</h2>
              <ul className="mt-4 space-y-3">
                {data.perIndicator.map((i) => (
                  <li key={i.id}>
                    <div className="flex justify-between gap-3 text-sm">
                      <span>{i.label}</span>
                      <span className="font-semibold tabular-nums">
                        {i.average === null ? '—' : formatScore(i.average)}
                      </span>
                    </div>
                    <div className="mt-1.5">
                      <ScoreBar value={i.average ?? 0} className={scoreTone(i.average ?? 0).bar} />
                    </div>
                  </li>
                ))}
              </ul>
            </Card>

            <div className="space-y-5">
              <Card className="p-5">
                <h2 className="font-bold">Ranking anggota</h2>
                {data.ranking.length === 0 ? (
                  <p className="mt-3 text-sm text-muted">Belum ada laporan pada periode ini.</p>
                ) : (
                  <ol className="mt-3 divide-y divide-line">
                    {data.ranking.map((r) => {
                      const tone = scoreTone(r.average);
                      return (
                        <li key={r.userId}>
                          <Link
                            to={`/anggota/${r.userId}`}
                            className="-mx-2 flex items-center gap-3 rounded-lg px-2 py-2.5 hover:bg-canvas"
                          >
                            <span className="w-6 text-center font-bold tabular-nums text-muted">{r.rank}</span>
                            <span className="min-w-0 flex-1">
                              <span className="block truncate font-medium">{r.name}</span>
                              {r.reports > 1 && <span className="block text-xs text-muted">{r.reports} laporan</span>}
                            </span>
                            <span className={`rounded-full px-2.5 py-0.5 text-sm font-semibold tabular-nums ${tone.className}`}>
                              {formatScore(r.average)}
                            </span>
                          </Link>
                        </li>
                      );
                    })}
                  </ol>
                )}
              </Card>

              <Card className="p-5">
                <h2 className="font-bold">Belum mengisi</h2>
                {data.notSubmitted.length === 0 ? (
                  <p className="mt-3 text-sm text-brand-700">Alhamdulillah, semua anggota sudah mengisi.</p>
                ) : (
                  <ul className="mt-3 flex flex-wrap gap-2">
                    {data.notSubmitted.map((m) => (
                      <li key={m.userId}>
                        <Link
                          to={`/anggota/${m.userId}`}
                          className="inline-flex min-h-9 items-center rounded-full bg-rose-50 px-3 text-sm font-medium text-rose-800 ring-1 ring-rose-200 hover:bg-rose-100"
                        >
                          {m.name}
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            </div>
          </div>
        </div>
      )}

      <GroupTrend userId={filter.userId} memberName={options.members.find((m) => String(m.id) === filter.userId)?.name} />
    </div>
  );
}

function GroupTrend({ userId, memberName }) {
  const trend = useQuery({
    queryKey: ['dashboard', 'trend', userId],
    queryFn: () => dashboardApi.trend({ userId }),
  });
  return (
    <Card className="p-5">
      <h2 className="font-bold">Tren skor {memberName ? memberName : 'kelompok'}</h2>
      <p className="mt-0.5 text-sm text-muted">Rata-rata per pekan, 12 pekan terakhir yang ada laporannya</p>
      <div className="mt-4">
        {trend.isError && <Alert>{errorMessage(trend.error)}</Alert>}
        {trend.isPending && <Spinner small label="Memuat tren" />}
        {trend.data && <TrendChart points={trend.data} showSubmitted />}
      </div>
    </Card>
  );
}

function Stat({ label, value, tone = '' }) {
  return (
    <Card className="p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-muted">{label}</p>
      <p className={`mt-1 text-2xl font-bold tabular-nums ${tone}`}>{value}</p>
    </Card>
  );
}

function describeFilter(filter, members) {
  const parts = [];
  if (filter.week) parts.push(`Pekan ${ROMAN[filter.week - 1]}`);
  if (filter.month) parts.push(MONTHS[filter.month - 1]);
  if (filter.year) parts.push(filter.year);
  let text = parts.length ? parts.join(' ') : 'Semua periode';
  if (!filter.week && parts.length) text = `Semua pekan · ${text}`;
  const member = members.find((m) => String(m.id) === filter.userId);
  return member ? `${text} · ${member.name}` : text;
}
