# Pemweb-Week10-ExpressJS-Dataset

Lanjutan API produk minggu ke-9: penyimpanan array di memori diganti **PostgreSQL melalui Prisma 7**.
Endpoint: GET (semua & per id), POST, PUT, DELETE.

## Struktur

```
prisma/schema.prisma        model Product (tabel products)
prisma/migrations/          riwayat migration SQL
prisma/seed.js              data awal (opsional)
prisma.config.js            konfigurasi Prisma 7 (DATABASE_URL dari .env)
lib/prisma.js               PrismaClient + adapter PostgreSQL
src/app.js, server.js       aplikasi Express dan entry point
src/routes/                 routing /products
src/controllers/            logika endpoint (memanggil Prisma)
src/middleware/             validasi input dan error handler
test/                       pengujian integrasi (termasuk uji restart)
scripts/evidence.js         menghasilkan laporan pengujian
docs/LAPORAN-PENGUJIAN.md   laporan evidence + screenshot Prisma Studio
docs/postman_collection.json koleksi request (Postman/Bruno/Hoppscotch)
```

## Menjalankan

Prasyarat: Node.js >= 20.19 dan PostgreSQL yang berjalan.

```bash
npm install
cp .env.example .env            # lalu isi DATABASE_URL, mis. postgresql://postgres:postgres@localhost:5432/pemweb_products
createdb pemweb_products        # atau buat database lewat cara lain
npx prisma migrate deploy       # terapkan migration (pengembangan: npx prisma migrate dev)
npx prisma generate
npm run prisma:seed             # opsional
npm start                       # http://localhost:3000
npm run studio                  # Prisma Studio di http://localhost:51212
```

## Endpoint

| Method | Path | Body | Sukses | Gagal |
|---|---|---|---|---|
| GET | `/products` | - | 200 array produk | - |
| GET | `/products/:id` | - | 200 produk | 400 id tidak valid, 404 tidak ada |
| POST | `/products` | `{ "name": string, "price": int }` | 201 produk baru | 400 validasi |
| PUT | `/products` | `{ "id": int, "name": string, "price": int }` | 200 produk terbaru | 400 validasi, 404 id tidak ada |
| DELETE | `/products/:id` | - | 200 `{ message, product }` | 400 id tidak valid, 404 tidak ada |

Aturan validasi: `name` teks tidak kosong (maks. 100 karakter, spasi tepi dipangkas); `price` bilangan bulat 0–2147483647;
`id` bilangan bulat positif. Error validasi berbentuk `{ "error": "Validasi gagal", "details": [ ... ] }`.

## Uji restart

```bash
curl -X POST localhost:3000/products -H "Content-Type: application/json" -d '{"name":"Pulpen","price":3000}'
# hentikan server (Ctrl+C), jalankan lagi: npm start
curl localhost:3000/products     # produk masih ada
npm run studio                   # periksa tabel products di Prisma Studio
```

## Pengujian

```bash
npm test             # 27 pengujian integrasi ke PostgreSQL asli (mengosongkan tabel products)
npm run evidence     # menjalankan 18 skenario dan menulis docs/LAPORAN-PENGUJIAN.md (mengosongkan tabel products)
```

Laporan hasil pengujian: [docs/LAPORAN-PENGUJIAN.md](docs/LAPORAN-PENGUJIAN.md).
