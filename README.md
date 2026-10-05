# CogniTrack

Skrining perkembangan anak (KPSP) dengan verifikasi dokter. Situs dan API berjalan dari satu server lokal.

## Menjalankan

Butuh Node.js 22.13 atau lebih baru. Tidak ada dependensi npm (database memakai `node:sqlite` bawaan Node).

```bash
npm start
```

Buka http://localhost:3000. Data tersimpan di folder `data/` (`cognitrack.db` dan `videos/`), yang tidak ikut di-commit.

Variabel lingkungan:

| Nama | Bawaan | Keterangan |
| --- | --- | --- |
| `PORT` | `3000` | Port server |
| `HOST` | `127.0.0.1` | Pakai `0.0.0.0` agar bisa dibuka dari ponsel atau laptop lain di jaringan yang sama |
| `COGNITRACK_DATA` | `./data` | Folder database dan video |
| `MAX_VIDEO_MB` | `300` | Batas ukuran satu video |

## API

| Metode | Rute | Keterangan |
| --- | --- | --- |
| GET | `/api/state` | Semua anak beserta sesinya, plus daftar video per sesi |
| PUT | `/api/children/:id` | Buat/ubah anak. Kirim `If-Match: <rev>` saat mengubah; 409 bila sudah diubah perangkat lain |
| DELETE | `/api/children/:id` | Hapus anak, semua sesinya, dan semua videonya |
| PUT | `/api/children/:cid/sessions/:sid` | Buat/ubah sesi skrining (dengan `If-Match` yang sama) |
| DELETE | `/api/sessions/:sid` | Hapus sesi beserta videonya |
| POST | `/api/sessions/:sid/videos` | Unggah video (badan = berkas mentah, `Content-Type: video/*`, `X-Filename`). Hanya bila orang tua menyetujui perekaman |
| GET | `/api/videos/:id` | Putar video (mendukung `Range`) |
| DELETE | `/api/videos/:id` | Hapus video |

Belum ada login: peran (orang tua, guru, dokter) masih dipilih di aplikasi seperti pada prototipe.
