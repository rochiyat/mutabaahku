# Mutaba'ahku

Aplikasi mutaba'ah yaumiah pekanan untuk UPA: anggota mengisi amalan sepekan, murabbi melihat rekap dan ranking. Rencana lengkap ada di [PLANNING.md](PLANNING.md).

- **Backend**: Node.js + Express, PostgreSQL (Knex)
- **Frontend**: React + Vite + Axios *(Fase 3)*

## Menjalankan (development)

Butuh Node.js 22+ dan Docker.

```bash
npm install
cp backend/.env.example backend/.env   # lalu isi JWT_SECRET dengan string acak
npm run db:up                          # Postgres di localhost:5432
npm run migrate
npm run seed
npm run dev:be                         # API di http://localhost:4000
```

Akun hasil seed: `murabbi@mutabaahku.test` dan `<nama>@mutabaahku.test` (rochiyat, bhayu, herman, sabar, salman, arief, anto, ganjar), password awal = `SEED_DEFAULT_PASSWORD`. Semua akun wajib ganti password saat login pertama.

Jika `SMTP_HOST` kosong, email reset password dicetak di console server.

## Test

```bash
docker exec mutabaahku-db createdb -U mutabaah mutabaahku_test   # sekali saja
npm test
```

Test memakai `TEST_DATABASE_URL` dan mereset skema database test di setiap file.

## API

Semua respons error berbentuk `{ "error": { "code", "message", "details?" } }`. Sesi disimpan di cookie httpOnly.

| Method | Path | Keterangan |
|---|---|---|
| GET | `/api/health` | Cek API & database |
| POST | `/api/auth/login` | `{ email, password }` |
| POST | `/api/auth/logout` | |
| GET | `/api/auth/me` | User yang sedang login |
| POST | `/api/auth/change-password` | `{ currentPassword, newPassword }` — sesi lain ikut keluar |
| POST | `/api/auth/forgot-password` | `{ email }` — kirim link reset (berlaku 60 menit) |
| POST | `/api/auth/reset-password` | `{ token, newPassword }` |
| GET | `/api/indicators` | Daftar amalan + pilihan + skor |
| GET | `/api/reports/periods` | Pekan ini & pekan lalu (yang boleh diisi) |
| GET | `/api/reports/me?year&month&week` | Laporan saya (default pekan ini) |
| GET | `/api/reports/me/history?limit` | Riwayat laporan saya |
| PUT | `/api/reports` | Anggota saja. `{ period?, answers: [{ indicatorId, optionId }], resumeText }` — buat/ubah laporan |

Endpoint di luar `/api/auth` dan `/api/health` mengembalikan `403 PASSWORD_CHANGE_REQUIRED` sampai user mengganti password awal.

**Pekan ke-** dihitung dari tanggal (WIB): tgl 1–7 = I, 8–14 = II, 15–21 = III, 22–28 = IV, 29–31 = V. Laporan boleh diisi untuk pekan ini atau pekan lalu (untuk yang terlambat).
