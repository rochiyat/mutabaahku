import { Link, useParams } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { errorMessage } from '../api/client';
import { dashboardApi } from '../api/endpoints';
import { ReportList } from '../components/ReportList';
import { TrendChart, historyToPoints } from '../components/TrendChart';
import { Alert, Card, Spinner } from '../components/ui';
import { formatScore } from '../lib/format';

export default function MemberDetailPage() {
  const { id } = useParams();
  const detail = useQuery({ queryKey: ['member', id], queryFn: () => dashboardApi.member(id) });

  const reports = detail.data?.reports ?? [];
  const average = reports.length ? reports.reduce((s, r) => s + r.totalScore, 0) / reports.length : null;

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <Link to="/" className="inline-block text-sm font-semibold text-brand-700 hover:underline">
        ← Dashboard
      </Link>

      {detail.isPending && (
        <div className="grid place-items-center py-16 text-brand-700">
          <Spinner label="Memuat data anggota" />
        </div>
      )}
      {detail.isError && <Alert>{errorMessage(detail.error, 'Gagal memuat data anggota')}</Alert>}

      {detail.data && (
        <>
          <div>
            <h1 className="text-2xl font-bold">{detail.data.member.name}</h1>
            <p className="mt-1 text-muted">{detail.data.member.email}</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Card className="p-4">
              <p className="text-sm text-muted">Laporan terkirim</p>
              <p className="mt-1 text-2xl font-bold tabular-nums">{reports.length}</p>
            </Card>
            <Card className="p-4">
              <p className="text-sm text-muted">Rata-rata skor</p>
              <p className="mt-1 text-2xl font-bold tabular-nums">{average === null ? '—' : formatScore(average)}</p>
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

          {reports.length === 0 ? (
            <Card className="p-6 text-center text-muted">Belum ada laporan dari anggota ini.</Card>
          ) : (
            <ReportList
              reports={reports}
              loadReport={(p) => dashboardApi.memberReport(id, p)}
              cacheKey={['member-report', id]}
            />
          )}
        </>
      )}
    </div>
  );
}
