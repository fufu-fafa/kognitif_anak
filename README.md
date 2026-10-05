# CogniTrack

Skrining perkembangan anak (KPSP) dengan verifikasi dokter. Situs dan API berjalan dari satu server lokal.

## Menjalankan

Butuh Node.js 22.13 atau lebih baru. Tidak ada dependensi npm (database memakai `node:sqlite` bawaan Node).

```bash
npm start
```

Buka http://localhost:3000. Data tersimpan di folder `data/` (`cognitrack.db` dan `videos/`), yang tidak ikut di-commit.

## Akun

- **Orang tua** mendaftar sendiri di halaman masuk (email atau nomor HP + kata sandi minimal 8 karakter), dan hanya melihat anaknya sendiri.
- **Dokter** dibuat oleh pengelola lewat baris perintah. Dokter melihat semua skrining dengan kode anak, tanpa nama anak dan nama wali, dan hanya dapat menetapkan hasil atau meminta rekam ulang.

```bash
npm run user -- add-doctor dokter@contoh.id "dr. Nama, Sp.A"
npm run user -- add-parent 081234567890 "Nama Orang Tua"
npm run user -- reset-password dokter@contoh.id
npm run user -- list
npm run user -- claim ibu@contoh.id
```

Kata sandi diminta tanpa ditampilkan. `claim` memberikan data anak yang dibuat sebelum ada login (belum punya pemilik) ke akun orang tua tersebut.

Sesi masuk disimpan sebagai cookie HttpOnly selama 30 hari. Percobaan masuk yang gagal dibatasi 10 kali per 15 menit.

Variabel lingkungan:

| Nama | Bawaan | Keterangan |
| --- | --- | --- |
| `PORT` | `3000` | Port server |
| `HOST` | `127.0.0.1` | Pakai `0.0.0.0` agar bisa dibuka dari ponsel atau laptop lain di jaringan yang sama |
| `COGNITRACK_DATA` | `./data` | Folder database dan video |
| `MAX_VIDEO_MB` | `300` | Batas ukuran satu video |
| `ALLOW_REGISTER` | `1` | `0` = orang tua tidak dapat mendaftar sendiri (akun dibuat lewat `npm run user`) |

## API

Semua rute selain `/api/auth/*` membutuhkan login.

| Metode | Rute | Keterangan |
| --- | --- | --- |
| POST | `/api/auth/register` | Daftar akun orang tua `{ name, login, password }` |
| POST | `/api/auth/login` | Masuk `{ login, password }` |
| POST | `/api/auth/logout` | Keluar |
| GET | `/api/auth/me` | Akun yang sedang masuk |
| POST | `/api/demo` | Buat data contoh untuk akun orang tua yang masih kosong |
| GET | `/api/state` | Anak beserta sesinya dan daftar video per sesi (orang tua: anaknya sendiri; dokter: semua, tanpa nama) |
| PUT | `/api/children/:id` | Buat/ubah anak. Kirim `If-Match: <rev>` saat mengubah; 409 bila sudah diubah perangkat lain |
| DELETE | `/api/children/:id` | Hapus anak, semua sesinya, dan semua videonya |
| PUT | `/api/children/:cid/sessions/:sid` | Buat/ubah sesi skrining (dengan `If-Match` yang sama) |
| DELETE | `/api/sessions/:sid` | Hapus sesi beserta videonya |
| POST | `/api/sessions/:sid/videos` | Unggah video (badan = berkas mentah, `Content-Type: video/*`, `X-Filename`). Hanya bila orang tua menyetujui perekaman |
| GET | `/api/videos/:id` | Putar video (mendukung `Range`) |
| DELETE | `/api/videos/:id` | Hapus video |

Peran guru PAUD belum memiliki akun; izin "pengisian oleh guru" pada persetujuan belum dipakai.
