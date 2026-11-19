import { Link } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { errorMessage } from '../api/client';
import { reportApi } from '../api/endpoints';
import { ReportList } from '../components/ReportList';
import { TrendChart, historyToPoints } from '../components/TrendChart';
import { Alert, Card, Spinner } from '../components/ui';
import { formatScore } from '../lib/format';

export default function HistoryPage() {
  const history = useQuery({ queryKey: ['history'], queryFn: () => reportApi.history() });

  const reports = history.data ?? [];
  const average = reports.length ? reports.reduce((s, r) => s + r.totalScore, 0) / reports.length : 0;

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <h1 className="text-2xl font-bold">Riwayat mutaba'ah</h1>

      {history.isPending && (
        <div className="grid place-items-center py-16 text-brand-700">
          <Spinner label="Memuat riwayat" />
        </div>
      )}
      {history.isError && <Alert>{errorMessage(history.error, 'Gagal memuat riwayat')}</Alert>}

      {history.isSuccess && reports.length === 0 && (
        <Card className="p-6 text-center">
          <p className="text-muted">Belum ada laporan.</p>
          <Link to="/" className="mt-2 inline-block font-semibold text-brand-700 hover:underline">
            Isi mutaba'ah pekan ini
          </Link>
        </Card>
      )}

      {reports.length > 0 && (
        <>
          <div className="grid grid-cols-2 gap-3">
            <Card className="p-4">
              <p className="text-sm text-muted">Laporan terkirim</p>
              <p className="mt-1 text-2xl font-bold tabular-nums">{reports.length}</p>
            </Card>
            <Card className="p-4">
              <p className="text-sm text-muted">Rata-rata skor</p>
              <p className="mt-1 text-2xl font-bold tabular-nums">{formatScore(average)}</p>
            </Card>
          </div>
          {reports.length > 1 && (
            <Card className="p-5">
              <h2 className="font-bold">Tren skor</h2>
              <div className="mt-4">
                <TrendChart points={historyToPoints(reports)} />
              </div>
            </Card>
          )}
          <ReportList reports={reports} loadReport={reportApi.mine} cacheKey={['report']} />
        </>
      )}
    </div>
  );
}
