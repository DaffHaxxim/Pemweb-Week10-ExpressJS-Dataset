// Menjalankan seluruh skenario terhadap server + PostgreSQL asli,
// lalu menulis laporan ke docs/LAPORAN-PENGUJIAN.md.
// Peringatan: tabel products DIKOSONGKAN dan diisi data awal.
// Jalankan: npm run evidence
import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdir, writeFile } from "node:fs/promises";
import { prisma } from "../lib/prisma.js";

const PORT = 3998;
const BASE = `http://localhost:${PORT}`;
const steps = [];
let server;

async function startServer() {
  const child = spawn(process.execPath, ["src/server.js"], {
    env: { ...process.env, PORT: String(PORT) },
    stdio: ["ignore", "pipe", "inherit"],
  });
  await new Promise((resolve) =>
    child.stdout.on("data", (c) => String(c).includes("Server berjalan") && resolve()),
  );
  return child;
}

async function stopServer(child) {
  child.kill("SIGTERM");
  await once(child, "exit");
}

const dbRows = () =>
  prisma.$queryRaw`SELECT id, name, price, created_at, updated_at FROM products ORDER BY id`;

const iso = (d) => d.toISOString().replace("T", " ").slice(0, 19);

function table(rows) {
  if (rows.length === 0) return "_(tabel kosong, 0 baris)_";
  const head = "| id | name | price | created_at | updated_at |\n|---|---|---|---|---|";
  const body = rows
    .map((r) => `| ${r.id} | ${r.name} | ${r.price} | ${iso(r.created_at)} | ${iso(r.updated_at)} |`)
    .join("\n");
  return `${head}\n${body}\n\n_(${rows.length} baris)_`;
}

// Satu skenario: kirim request, rekam response, dan (opsional) snapshot DB.
async function scenario({ id, title, method, path, body, rawBody, expectStatus, mutating }) {
  const before = mutating ? await dbRows() : null;
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: body !== undefined || rawBody !== undefined ? { "Content-Type": "application/json" } : {},
    body: rawBody ?? (body !== undefined ? JSON.stringify(body) : undefined),
  });
  const json = await res.json();
  const after = mutating ? await dbRows() : null;
  const ok = res.status === expectStatus;
  steps.push({ id, title, method, path, body, rawBody, status: res.status, expectStatus, ok, json, before, after });
  console.log(`${ok ? "PASS" : "FAIL"}  ${id}  ${method} ${path} -> ${res.status} (harapan ${expectStatus})`);
  return json;
}

function curlOf(s) {
  const data = s.rawBody ?? (s.body !== undefined ? JSON.stringify(s.body) : undefined);
  const h = data !== undefined ? ` \\\n  -H "Content-Type: application/json"` : "";
  const d = data !== undefined ? ` \\\n  -d '${data}'` : "";
  return `curl -i -X ${s.method} http://localhost:3000${s.path}${h}${d}`;
}

function render(s) {
  const lines = [
    `### ${s.id} — ${s.title}`,
    "",
    `![${s.id}](evidence/${s.id}.png)`,
    "",
    "**Request**",
    "```bash",
    curlOf(s),
    "```",
    "",
    `**Response** — HTTP \`${s.status}\` (harapan: \`${s.expectStatus}\`) → ${s.ok ? "**LULUS**" : "**GAGAL**"}`,
    "```json",
    JSON.stringify(s.json, null, 2),
    "```",
  ];
  if (s.before) {
    lines.push("", "**Database sebelum (`SELECT * FROM products`)**", "", table(s.before));
    lines.push("", "**Database sesudah**", "", table(s.after));
  }
  return lines.join("\n");
}

// ---------------------------------------------------------------- persiapan
await prisma.$executeRaw`TRUNCATE TABLE products RESTART IDENTITY`;
await prisma.product.createMany({
  data: [
    { name: "Buku Tulis", price: 5000 },
    { name: "Pulpen", price: 3000 },
    { name: "Spidol", price: 8000 },
  ],
});
const initialRows = await dbRows();
server = await startServer();

// ------------------------------------------------------------------ GET
await scenario({ id: "S01", title: "GET semua produk (sukses)", method: "GET", path: "/products", expectStatus: 200 });
await scenario({ id: "S02", title: "GET produk berdasarkan id (sukses)", method: "GET", path: "/products/2", expectStatus: 200 });
await scenario({ id: "S03", title: "GET produk dengan id yang tidak ada", method: "GET", path: "/products/9999", expectStatus: 404 });
await scenario({ id: "S04", title: "GET produk dengan id bukan angka", method: "GET", path: "/products/abc", expectStatus: 400 });

// ------------------------------------------------------------------ POST
const created = await scenario({
  id: "S05", title: "POST produk baru (sukses)", method: "POST", path: "/products",
  body: { name: "Penghapus", price: 2000 }, expectStatus: 201, mutating: true,
});
await scenario({
  id: "S06", title: "POST tanpa field name (validasi gagal)", method: "POST", path: "/products",
  body: { price: 2000 }, expectStatus: 400, mutating: true,
});
await scenario({
  id: "S07", title: "POST dengan price berupa teks (validasi gagal)", method: "POST", path: "/products",
  body: { name: "Penggaris", price: "abc" }, expectStatus: 400, mutating: true,
});
await scenario({
  id: "S08", title: "POST dengan price negatif dan name kosong (dua kesalahan sekaligus)", method: "POST", path: "/products",
  body: { name: "", price: -100 }, expectStatus: 400, mutating: true,
});
await scenario({
  id: "S09", title: "POST dengan body bukan JSON valid", method: "POST", path: "/products",
  rawBody: '{"name": "Rusak", price: }', expectStatus: 400, mutating: true,
});

// ------------------------------------------------------------------ PUT
await scenario({
  id: "S10", title: "PUT mengubah produk (sukses)", method: "PUT", path: "/products",
  body: { id: created.id, name: "Penghapus Besar", price: 2500 }, expectStatus: 200, mutating: true,
});
await scenario({
  id: "S11", title: "PUT tanpa id (validasi gagal)", method: "PUT", path: "/products",
  body: { name: "Tanpa Id", price: 1000 }, expectStatus: 400, mutating: true,
});
await scenario({
  id: "S12", title: "PUT dengan id yang tidak ada", method: "PUT", path: "/products",
  body: { id: 9999, name: "Hantu", price: 1000 }, expectStatus: 404, mutating: true,
});
await scenario({
  id: "S13", title: "PUT dengan name/price tidak valid", method: "PUT", path: "/products",
  body: { id: created.id, name: 123, price: 12.5 }, expectStatus: 400, mutating: true,
});

// --------------------------------------------------------------- DELETE
await scenario({
  id: "S14", title: "DELETE produk (sukses)", method: "DELETE", path: `/products/${created.id}`,
  expectStatus: 200, mutating: true,
});
await scenario({
  id: "S15", title: "DELETE produk yang sudah terhapus / tidak ada", method: "DELETE", path: `/products/${created.id}`,
  expectStatus: 404, mutating: true,
});
await scenario({
  id: "S16", title: "DELETE dengan id tidak valid", method: "DELETE", path: "/products/-1",
  expectStatus: 400, mutating: true,
});

// ------------------------------------------------- uji restart (persistensi)
const restartPost = await scenario({
  id: "S17", title: "Uji restart — langkah 1: POST produk baru", method: "POST", path: "/products",
  body: { name: "Produk Uji Restart", price: 12345 }, expectStatus: 201, mutating: true,
});
const listBefore = await (await fetch(`${BASE}/products`)).json();
await stopServer(server);
console.log("Server ExpressJS dihentikan");
server = await startServer();
console.log("Server ExpressJS dimulai ulang");
await scenario({
  id: "S18", title: "Uji restart — langkah 2: GET setelah server dimulai ulang", method: "GET", path: "/products",
  expectStatus: 200,
});
const restartStep = steps.at(-1);
const survived = restartStep.json.some((p) => p.id === restartPost.id && p.name === restartPost.name);
restartStep.ok = restartStep.ok && survived;
console.log(`${survived ? "PASS" : "FAIL"}  produk id ${restartPost.id} masih ada setelah restart`);

const finalRows = await dbRows();
await stopServer(server);
await prisma.$disconnect();

// ------------------------------------------------------------- tulis laporan
const passed = steps.filter((s) => s.ok).length;
const report = `# Laporan Pengujian — API Produk ExpressJS + Prisma + PostgreSQL

Laporan ini dihasilkan otomatis oleh \`npm run evidence\` (\`scripts/evidence.js\`). Setiap request dikirim ke server ExpressJS
yang berjalan sungguhan, dan isi tabel \`products\` dibaca langsung dari PostgreSQL (\`SELECT\` melalui Prisma) sebelum dan sesudah request.

- Dijalankan pada: ${new Date().toISOString()}
- Stack: Node.js ${process.version}, Express 5, Prisma 7, PostgreSQL 16
- **Hasil: ${passed} dari ${steps.length} skenario lulus**

## 1. Ringkasan skenario

| ID | Skenario | Method & path | Status | Harapan | Hasil |
|---|---|---|---|---|---|
${steps
  .map((s) => `| ${s.id} | ${s.title} | \`${s.method} ${s.path}\` | ${s.status} | ${s.expectStatus} | ${s.ok ? "LULUS" : "GAGAL"} |`)
  .join("\n")}

## 2. Data awal di database

Tabel \`products\` dikosongkan (\`TRUNCATE ... RESTART IDENTITY\`) lalu diisi tiga baris:

${table(initialRows)}

## 3. Detail skenario (request, response, perubahan database)

${steps.map(render).join("\n\n---\n\n")}

---

## 4. Uji restart ExpressJS (bukti data tersimpan di database)

Prosedur yang dijalankan:

1. **S17** — \`POST /products\` membuat produk id **${restartPost.id}** (\`${restartPost.name}\`).
2. \`GET /products\` sebelum restart mengembalikan **${listBefore.length}** produk.
3. Proses ExpressJS dihentikan (\`SIGTERM\`), lalu dijalankan kembali sebagai proses baru.
4. **S18** — \`GET /products\` dipanggil lagi.

Hasil: produk id **${restartPost.id}** ${survived ? "**masih tersedia**" : "**HILANG**"} setelah restart
(response S18 berisi ${restartStep.json.length} produk).
Pada versi minggu ke-9 (array di memori) produk ini akan hilang, karena array kembali ke nilai awal saat proses dimulai ulang.

Isi tabel \`products\` di PostgreSQL pada akhir pengujian:

${table(finalRows)}

## 5. Screenshot Prisma Studio (before — after)

Diambil dari Prisma Studio (\`npm run studio\`, tabel \`products\`) pada database PostgreSQL yang sama dengan server.
Urutan operasi: data awal → POST → PUT → DELETE → POST produk uji → restart ExpressJS.

| Tahap | Screenshot |
|---|---|
| 1. Sebelum (3 produk: id 1, 2, 3) | ![sebelum](screenshots/01-studio-sebelum.png) |
| 2. Sesudah \`POST\` (id 4 \`Penghapus\` ditambahkan) | ![post](screenshots/02-studio-sesudah-post.png) |
| 3. Sesudah \`PUT\` (id 4 menjadi \`Penghapus Besar\`, 2500) | ![put](screenshots/03-studio-sesudah-put.png) |
| 4. Sesudah \`DELETE /products/2\` (id 2 \`Pulpen\` hilang) | ![delete](screenshots/04-studio-sesudah-delete.png) |
| 5. Sesudah \`POST\` id 5 dan restart ExpressJS (id 5 tetap ada) | ![restart](screenshots/05-studio-sesudah-restart.png) |

## 6. Catatan

- Gambar \`docs/evidence/Sxx.png\` adalah **render otomatis** (\`scripts/render-images.js\`) dari data request/response/database
  yang direkam \`scripts/evidence.js\` saat server berjalan. Gambar tersebut bukan tangkapan layar Postman/Bruno/Hoppscotch.
  Koleksi siap impor tersedia di \`docs/postman_collection.json\` bila pengajar mewajibkan tangkapan layar dari aplikasi tersebut.
- Tes otomatis: \`npm test\` (27 pengujian, termasuk uji restart).
`;

await mkdir("docs/evidence", { recursive: true });
await writeFile("docs/evidence/scenarios.json", JSON.stringify(steps, null, 2));
await writeFile("docs/LAPORAN-PENGUJIAN.md", report);
console.log(`\nLaporan ditulis ke docs/LAPORAN-PENGUJIAN.md — ${passed}/${steps.length} lulus`);
process.exit(passed === steps.length && survived ? 0 : 1);
