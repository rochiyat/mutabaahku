# Mutaba'ahku

Aplikasi mutaba'ah yaumiah pekanan untuk UPA: anggota mengisi amalan sepekan, murabbi melihat rekap dan ranking. Rencana lengkap ada di [PLANNING.md](PLANNING.md).

- **Backend**: Node.js + Express, PostgreSQL (Knex)
- **Frontend**: React + Vite + Axios, TanStack Query, React Router, Tailwind CSS

## Menjalankan (development)

Butuh Node.js 22+ dan Docker.

```bash
npm install
cp backend/.env.example backend/.env   # lalu isi JWT_SECRET dengan string acak
npm run db:up                          # Postgres di localhost:5432
npm run migrate
npm run seed
npm run dev:be                         # API di http://localhost:4000
npm run dev:fe                         # Web di http://localhost:5173 (proxy /api ke :4000)
```

Halaman web:

| Path | Isi |
|---|---|
| `/login`, `/lupa-password`, `/reset-password?token=…` | Masuk & pemulihan password |
| `/ganti-password` | Ganti password (wajib saat login pertama) |
| `/` | Anggota: form mutaba'ah pekan ini / pekan lalu. Murabbi: dashboard evaluasi pekanan |
| `/riwayat` | Riwayat laporan anggota beserta detail jawaban |
| `/anggota/:id` | Murabbi: riwayat, tren, dan detail jawaban satu anggota |
| `/pengguna` | Murabbi: tambah anggota (kirim undangan), ubah nama/email, kirim link password, nonaktifkan |
| `/amalan` | Murabbi: ubah pertanyaan & skor, tambah amalan, nonaktifkan amalan |

Dashboard murabbi menampilkan total laporan, sudah/belum mengisi, rata-rata kelompok, skor rata-rata per amalan, ranking anggota, dan daftar yang belum mengisi. Filter Tahun/Bulan/Pekan/Anggota disimpan di URL (bisa dibagikan); tanpa filter, yang tampil adalah pekan berjalan. Tombol **Unduh CSV** mengekspor laporan sesuai filter (bisa dibuka di Excel/Google Sheets), dan grafik tren menampilkan rata-rata 12 pekan terakhir.

Mengubah skor amalan hanya berlaku untuk laporan yang dikirim/diperbarui setelahnya; skor laporan lama disimpan apa adanya. Anggota yang dinonaktifkan tidak bisa masuk dan tidak dihitung di dashboard, tetapi laporannya tetap tersimpan.

`npm run seed` hanya membuat akun bila tabel `users` masih kosong, jadi aman dijalankan ulang setelah email anggota diganti.

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
| GET | `/api/dashboard?year&month&week&userId` | Murabbi. Ringkasan, skor per amalan, ranking, belum mengisi. Filter kosong = semua |
| GET | `/api/dashboard/filters` | Murabbi. Tahun yang ada, daftar anggota, pekan berjalan |
| GET | `/api/dashboard/trend?userId&limit` | Murabbi. Rata-rata & jumlah laporan per pekan (default 12 pekan) |
| GET | `/api/dashboard/export.csv?year&month&week&userId` | Murabbi. Ekspor CSV (UTF-8 BOM) |
| GET/POST | `/api/admin/users` | Murabbi. Daftar pengguna / tambah anggota `{ name, email }` + kirim undangan |
| PATCH | `/api/admin/users/:id` | Murabbi. `{ name?, email?, isActive? }` |
| POST | `/api/admin/users/:id/password-link` | Murabbi. Kirim ulang undangan / link reset |
| GET/POST | `/api/admin/indicators` | Murabbi. Semua amalan / tambah `{ label, type, options: [{ label, score }] }` |
| PATCH | `/api/admin/indicators/:id` | Murabbi. `{ label?, isActive? }` |
| PATCH | `/api/admin/options/:id` | Murabbi. `{ label?, score? }` |
| GET | `/api/dashboard/members/:id` | Murabbi. Data anggota + riwayat laporannya |
| GET | `/api/dashboard/members/:id/reports/:year/:month/:week` | Murabbi. Satu laporan lengkap |

Endpoint di luar `/api/auth` dan `/api/health` mengembalikan `403 PASSWORD_CHANGE_REQUIRED` sampai user mengganti password awal.

**Pekan ke-** dihitung dari tanggal (WIB): tgl 1–7 = I, 8–14 = II, 15–21 = III, 22–28 = IV, 29–31 = V. Laporan boleh diisi untuk pekan ini atau pekan lalu (untuk yang terlambat).
