# Mutaba'ahku

Aplikasi mutaba'ah yaumiah pekanan untuk satu UPA. Anggota mengisi amalan sepekan dari HP, murabbi melihat rekap, ranking, dan siapa yang belum mengisi. Pengganti Google Form + dashboard Apps Script. Rencana dan keputusan desain ada di [PLANNING.md](PLANNING.md).

- **Backend**: Node.js + Express 5, PostgreSQL 16 (Knex), Zod, JWT di cookie httpOnly
- **Frontend**: React 19 + Vite, Axios, TanStack Query, React Router, Tailwind CSS

## Fitur

**Anggota**
- Masuk dengan email; login pertama wajib membuat password sendiri lewat link undangan dari murabbi. Lupa password: minta link reset ke murabbi (atau lewat email bila SMTP diatur).
- Isi mutaba'ah pekan ini atau pekan lalu (untuk yang terlambat). Kirim ulang = memperbarui laporan yang sama.
- Riwayat laporan, rata-rata skor, grafik tren, dan detail jawaban per pekan.

**Murabbi**
- Dashboard: total laporan, sudah/belum mengisi, rata-rata kelompok, skor per amalan, ranking, grafik tren. Filter Tahun/Bulan/Pekan/Anggota (tersimpan di URL; default pekan berjalan). Unduh CSV.
- Detail anggota: riwayat, tren, dan jawaban lengkap.
- Pengguna: tambah anggota, buat link undangan/reset password lalu kirim sendiri (tombol **Kirim lewat WhatsApp** atau salin pesan), ubah nama/email, nonaktifkan.
- Amalan: ubah pertanyaan, label, dan skor; tambah atau nonaktifkan amalan.

**Aturan penting**
- **Pekan ke-** dihitung dari tanggal WIB: tgl 1–7 = I, 8–14 = II, 15–21 = III, 22–28 = IV, 29–31 = V.
- Skor laporan = rata-rata skor semua amalan (0–100). Skor tiap jawaban disimpan saat dikirim, jadi mengubah bobot tidak mengubah laporan lama.
- Anggota yang dinonaktifkan langsung keluar, tidak bisa masuk, dan tidak dihitung di dashboard; laporannya tetap tersimpan.

## Development

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

Seed development membuat akun `murabbi@mutabaahku.test` dan `<nama>@mutabaahku.test` (rochiyat, bhayu, herman, sabar, salman, arief, anto, ganjar) dengan password awal `SEED_DEFAULT_PASSWORD`.

`npm run seed` hanya mengisi tabel yang masih kosong, jadi aman dijalankan ulang: tidak menimpa akun, password, maupun amalan/skor yang sudah diubah.

### Test

```bash
docker exec mutabaahku-db createdb -U mutabaah mutabaahku_test   # sekali saja
npm test            # backend (node:test + supertest, database terpisah) lalu frontend (Vitest)
```

CI ([.github/workflows/ci.yml](.github/workflows/ci.yml)) menjalankan semua test, build frontend, dan build image Docker di setiap push ke `master` dan pull request.

## Deploy (Docker)

Satu container berisi API dan frontend hasil build (satu origin, jadi cookie sesi sederhana), ditambah container Postgres. Bisa dijalankan di VPS mana pun yang punya Docker.

1. Siapkan konfigurasi:

   ```bash
   cp .env.production.example .env.production
   ```

   Isi `APP_URL` (alamat HTTPS publik), `POSTGRES_PASSWORD`, dan `JWT_SECRET` (`openssl rand -hex 48`). SMTP **opsional** — lihat [Undangan tanpa email](#undangan--reset-password-tanpa-email).

2. Jalankan:

   ```bash
   docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build
   ```

   Setiap start, container menjalankan migrasi dan seed (hanya mengisi amalan bawaan bila kosong; tidak ada akun contoh di produksi). Aplikasi menolak start bila `JWT_SECRET` lemah atau `APP_URL` kosong.

3. Buat akun murabbi pertama. Perintah ini mencetak link untuk membuat password (dan mengirimnya ke email bila SMTP diatur):

   ```bash
   docker compose -f docker-compose.prod.yml --env-file .env.production exec app npm run create-murabbi -- "Nama Murabbi" email@contoh.com
   ```

   Setelah masuk, murabbi menambah anggota dari halaman **Pengguna**.

4. Pasang reverse proxy HTTPS ke `127.0.0.1:8080` (port dari `APP_PORT`). Contoh Caddy:

   ```
   mutabaah.contoh.com {
       reverse_proxy 127.0.0.1:8080
   }
   ```

   Cookie sesi bertanda `Secure`, jadi aplikasi produksi harus diakses lewat HTTPS.

### Undangan & reset password tanpa email

SMTP tidak wajib. Tanpa SMTP:

- Saat murabbi menambah anggota atau menekan **Buat link undangan / Buat link reset password** di halaman Pengguna, aplikasi menampilkan pesan berisi link sekali pakai (berlaku `INVITE_TOKEN_TTL_HOURS`, default 7 hari). Murabbi mengirimnya sendiri lewat tombol **Kirim lewat WhatsApp** atau menyalinnya.
- Halaman **Lupa password** meminta anggota menghubungi murabbi, dan tidak membuat token baru (link yang sudah dibagikan murabbi tetap berlaku).
- Isi pesan tidak pernah ditulis ke log produksi.

Jika SMTP diatur, link yang sama juga dikirim ke email anggota dan lupa password bekerja mandiri (link 60 menit).

**Backup database**

```bash
docker compose -f docker-compose.prod.yml --env-file .env.production exec -T db pg_dump -U mutabaah mutabaahku > backup-$(date +%F).sql
```

Restore: `... exec -T db psql -U mutabaah mutabaahku < backup.sql`.

## API

Semua respons error berbentuk `{ "error": { "code", "message", "details?" } }`. Sesi disimpan di cookie httpOnly. Endpoint di luar `/api/auth` dan `/api/health` mengembalikan `403 PASSWORD_CHANGE_REQUIRED` sampai user membuat password sendiri.

| Method | Path | Keterangan |
|---|---|---|
| GET | `/api/health` | Cek API & database |
| POST | `/api/auth/login` | `{ email, password }` |
| POST | `/api/auth/logout` | |
| GET | `/api/auth/me` | User yang sedang login |
| POST | `/api/auth/change-password` | `{ currentPassword, newPassword }` — sesi lain ikut keluar |
| GET | `/api/auth/options` | `{ emailEnabled }` — apakah SMTP diatur |
| POST | `/api/auth/forgot-password` | `{ email }` — kirim link reset (berlaku 60 menit); tanpa SMTP tidak melakukan apa-apa |
| POST | `/api/auth/reset-password` | `{ token, newPassword }` |
| GET | `/api/indicators` | Amalan aktif + pilihan + skor |
| GET | `/api/reports/periods` | Pekan ini & pekan lalu (yang boleh diisi) |
| GET | `/api/reports/me?year&month&week` | Laporan saya (default pekan ini) |
| GET | `/api/reports/me/history?limit` | Riwayat laporan saya |
| PUT | `/api/reports` | Anggota. `{ period?, answers: [{ indicatorId, optionId }], resumeText }` |
| GET | `/api/dashboard?year&month&week&userId` | Murabbi. Ringkasan, skor per amalan, ranking, belum mengisi. Filter kosong = semua |
| GET | `/api/dashboard/filters` | Murabbi. Tahun yang ada, daftar anggota, pekan berjalan |
| GET | `/api/dashboard/trend?userId&limit` | Murabbi. Rata-rata & jumlah laporan per pekan (default 12) |
| GET | `/api/dashboard/export.csv?year&month&week&userId` | Murabbi. Ekspor CSV (UTF-8 BOM) |
| GET | `/api/dashboard/members/:id` | Murabbi. Data anggota + riwayat laporannya |
| GET | `/api/dashboard/members/:id/reports/:year/:month/:week` | Murabbi. Satu laporan lengkap |
| GET / POST | `/api/admin/users` | Murabbi. Daftar pengguna / tambah anggota `{ name, email }` → `{ user, invite: { link, message, expiresAt, emailed } }` |
| PATCH | `/api/admin/users/:id` | Murabbi. `{ name?, email?, isActive? }` |
| POST | `/api/admin/users/:id/password-link` | Murabbi. Buat link undangan/reset baru → `{ link, message, expiresAt, emailed }` |
| GET / POST | `/api/admin/indicators` | Murabbi. Semua amalan / tambah `{ label, type, options: [{ label, score }] }` |
| PATCH | `/api/admin/indicators/:id` | Murabbi. `{ label?, isActive? }` |
| PATCH | `/api/admin/options/:id` | Murabbi. `{ label?, score? }` |
