# Planning — Mutaba'ahku

Aplikasi pengganti Google Form "Mutaba'ah Yaumiah UPA Cilbar" + dashboard Apps Script "Evaluasi Pekanan".

## 1. Stack

| Lapisan  | Pilihan                                                                 |
|----------|-------------------------------------------------------------------------|
| Backend  | Node.js + Express (JavaScript, ESM), `pg` / Knex untuk query & migrasi, Zod untuk validasi, JWT (httpOnly cookie) |
| Frontend | React + Vite, React Router, Axios (HTTP client), TanStack Query, Tailwind CSS, Recharts untuk grafik |
| Database | PostgreSQL 16                                                           |
| Dev      | Monorepo `backend/` + `frontend/`, `docker-compose.yml` untuk Postgres  |

> Catatan: Axios adalah HTTP client, jadi dipakai di FE untuk memanggil API Express. Di BE dipakai hanya jika butuh memanggil layanan luar.

## 2. Analisis sumber

### Form (input pekanan)
- Periode: Tahun, Bulan, Pekan ke- (I–V)
- Nama anggota UPA (8 orang)
- 8 amalan bertingkat (pilihan ganda) + 4 amalan Ya/Tidak + 1 isian teks (resume materi)

### Dashboard (laporan)
- Filter: Tahun, Bulan, Pekan, Anggota
- Kartu: Total laporan, Sudah mengisi (x / y), Belum mengisi, Rata-rata kelompok (%)
- Skor rata-rata per amalan (progress bar %)
- Ranking anggota

## 3. Penilaian (skor)

Setiap opsi jawaban diberi skor 0–100, skor laporan = rata-rata seluruh amalan.

| Amalan | Opsi → skor |
|---|---|
| Tilawah | 7 lbr=100, 6=86, 5=71, 4=57, 3=43, 2=29, 1=14, <1 lbr=5, tidak=0 |
| Dhuha, Qiyamul Lail | 7x=100 … 1x=14, tidak=0 (n/7) |
| Jamaah Shubuh, Isya | 7x=100, 4–6x=70, <4x=35, tidak pernah=0 |
| Al Ma'tsurat | >3x=100, 3x=75, <3x=40, tidak=0 |
| Rawatib | >4 rakaat=100, stabil 4=80, <4=40 |
| Istighfar & Sholawat | 100 rutin=100, 100 kadang=65, <100=35, hampir tidak=0 |
| Infaq, Silaturahmi, Olahraga, Birrul Walidain | Ya=100, Tidak=0 |

Skor disimpan di tabel master (`indicator_options.score`) sehingga bisa diubah admin tanpa ubah kode.

## 4. Skema database

```
users            id, name, email, password_hash, role(admin|murabbi|anggota), created_at
groups           id, name                                 -- contoh: "UPA Cilbar"
group_members    group_id, user_id, active
indicators       id, code, label, type(choice|boolean), sort_order, active
indicator_options id, indicator_id, label, score, sort_order
reports          id, user_id, group_id, year, month, week(1-5), resume_text,
                 total_score, created_at, updated_at
                 UNIQUE(user_id, year, month, week)
report_answers   report_id, indicator_id, option_id, score
```

- Indikator dinamis → form di FE di-render dari `GET /indicators`, bukan di-hardcode.
- `UNIQUE(user_id, year, month, week)` → satu laporan per anggota per pekan; kirim ulang = update.
- `total_score` disimpan (denormalisasi) supaya ranking cepat.

## 5. API (Express)

```
POST   /api/auth/login | /logout        GET /api/auth/me
GET    /api/indicators                  (opsi + skor)
GET    /api/reports/me?year&month&week  laporan saya
PUT    /api/reports                     buat/update laporan pekan ini (upsert)
GET    /api/dashboard/summary?year&month&week&userId
         → { total, submitted, members, notSubmitted[], groupAvg }
GET    /api/dashboard/indicators?...    → rata-rata per amalan
GET    /api/dashboard/ranking?...       → ranking anggota
GET    /api/dashboard/trend?userId&year → tren skor per pekan
CRUD   /api/admin/users | groups | indicators   (role admin/murabbi)
GET    /api/export.csv?...              ekspor rekap
```

## 6. Halaman (React)

1. **Login**
2. **Isi Mutaba'ah** — pilih periode (default pekan berjalan), kartu per amalan dengan tombol pilihan besar (mobile-first), resume materi, simpan. Kalau sudah pernah mengisi, form terisi otomatis untuk diedit.
3. **Riwayat Saya** — daftar laporan + grafik tren skor.
4. **Dashboard Kelompok** (murabbi/admin) — replika dashboard Apps Script: filter, 4 kartu, bar per amalan, ranking, daftar yang belum mengisi.
5. **Detail Anggota** — semua jawaban + resume per pekan.
6. **Admin** — kelola anggota, kelompok, indikator & skor.

## 7. Struktur folder

```
mutabaahku/
├── docker-compose.yml
├── backend/
│   ├── src/{app.js, server.js, db/, routes/, controllers/, services/, middlewares/, validators/}
│   ├── migrations/  seeds/   (seed: 8 anggota + 13 indikator sesuai form)
│   └── .env.example
└── frontend/
    └── src/{api/axios.js, pages/, components/, hooks/, lib/}
```

## 8. Tahapan

| Fase | Isi | Hasil |
|---|---|---|
| 1 | Setup monorepo, docker Postgres, migrasi + seed | DB siap dengan data form |
| 2 | Auth + endpoint indikator & laporan (upsert) | API isi laporan jalan |
| 3 | FE: login + form mutaba'ah + riwayat | Anggota bisa mengisi |
| 4 | Endpoint & halaman dashboard (summary, per amalan, ranking, belum mengisi) | Setara dashboard Apps Script |
| 5 | Admin CRUD, ekspor CSV, tren | Fitur tambahan |
| 6 | Tes (Vitest + Supertest), README, deploy | Siap dipakai |

## 9. Keputusan (2026-11-18)

1. **Login**: email + password, ada lupa password (link reset via email) dan ganti password.
2. **Skala**: satu UPA, satu murabbi → tidak perlu tabel `groups`/`group_members`; peran cukup `murabbi` | `anggota`, nama UPA disimpan di `settings`.
3. **Pekan ke-**: otomatis dari tanggal — `pekan = ceil(tanggal / 7)` (tgl 1–7 = I, 8–14 = II, 15–21 = III, 22–28 = IV, 29–31 = V).
4. **Data lama**: tidak diimpor.
5. **Bobot skor**: sesuai bagian 3.

Tambahan skema karena keputusan di atas:

```
password_reset_tokens  id, user_id, token_hash, expires_at, used_at, created_at
users.must_change_password  -- akun hasil seed wajib ganti password saat login pertama
settings               key, value                -- group_name = "UPA Cilbar"
```
