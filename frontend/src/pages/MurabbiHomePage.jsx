import { useAuth } from '../auth/AuthProvider';
import { Card } from '../components/ui';

/** Placeholder until the group dashboard lands in phase 4. */
export default function MurabbiHomePage() {
  const { user } = useAuth();
  return (
    <Card className="p-6">
      <h1 className="text-xl font-bold">Assalamu'alaikum, {user.name}</h1>
      <p className="mt-2 text-muted">
        Dashboard evaluasi pekanan kelompok sedang disiapkan: rekap per amalan, ranking anggota, dan daftar yang belum
        mengisi.
      </p>
    </Card>
  );
}
