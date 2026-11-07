// Merender satu gambar PNG per skenario dari docs/evidence/scenarios.json.
// Membutuhkan Chromium: set CHROME_PATH bila bukan di /opt/pw-browsers/chromium.
import { readFile } from "node:fs/promises";
import { chromium } from "playwright-core";

const steps = JSON.parse(await readFile("docs/evidence/scenarios.json", "utf8"));
const esc = (v) => String(v).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const iso = (d) => d.replace("T", " ").slice(0, 19);

function dbTable(title, rows) {
  const body = rows.length
    ? rows
        .map((r) => `<tr><td>${r.id}</td><td>${esc(r.name)}</td><td>${r.price}</td><td>${iso(r.created_at)}</td><td>${iso(r.updated_at)}</td></tr>`)
        .join("")
    : `<tr><td colspan="5" class="empty">tabel kosong</td></tr>`;
  return `<div class="db"><h3>${title} <span>(${rows.length} baris)</span></h3>
    <table><tr><th>id</th><th>name</th><th>price</th><th>created_at</th><th>updated_at</th></tr>${body}</table></div>`;
}

function html(s) {
  const reqBody = s.rawBody ?? (s.body !== undefined ? JSON.stringify(s.body, null, 2) : "(tanpa body)");
  const cls = s.status < 300 ? "ok" : s.status < 500 ? "warn" : "bad";
  return `<!doctype html><meta charset="utf-8"><style>
  body{margin:0;padding:24px;width:1052px;background:#f4f5f7;font:14px/1.45 system-ui,sans-serif;color:#1d2330}
  .card{background:#fff;border:1px solid #d9dde5;border-radius:8px;padding:18px 20px}
  .top{display:flex;align-items:center;gap:12px}
  .id{font-weight:700;color:#5b6577}
  .m{font:700 13px monospace;padding:4px 10px;border-radius:5px;background:#e8edf7;color:#27427a}
  .url{font:15px monospace;flex:1}
  .badge{font:700 13px monospace;padding:4px 10px;border-radius:5px}
  .ok{background:#d9f4e3;color:#146c3b}.warn{background:#fdecc8;color:#8a5a00}.bad{background:#fbd9d9;color:#9b1c1c}
  .title{margin:6px 0 14px;font-size:16px;font-weight:600}
  .cols{display:grid;grid-template-columns:1fr 1fr;gap:14px}
  h3{margin:0 0 6px;font-size:12px;text-transform:uppercase;letter-spacing:.06em;color:#5b6577}
  h3 span{text-transform:none;letter-spacing:0;font-weight:400}
  pre{margin:0;padding:12px;background:#10151f;color:#e6edf7;border-radius:6px;font:12.5px/1.5 monospace;white-space:pre-wrap;min-height:20px}
  .dbs{margin-top:16px;display:grid;gap:12px}
  table{border-collapse:collapse;width:100%;font:12px monospace}
  th,td{border:1px solid #d9dde5;padding:4px 8px;text-align:left}th{background:#eef1f6}
  .empty{text-align:center;color:#8a93a3}
  .foot{margin-top:12px;font-size:11px;color:#8a93a3}
  </style><body><div class="card">
  <div class="top"><span class="id">${s.id}</span><span class="m">${s.method}</span>
  <span class="url">http://localhost:3000${esc(s.path)}</span>
  <span class="badge ${cls}">${s.status} ${s.ok ? "✔ sesuai harapan" : "✘ tidak sesuai"} (${s.expectStatus})</span></div>
  <div class="title">${esc(s.title)}</div>
  <div class="cols"><div><h3>Request body (Content-Type: application/json)</h3><pre>${esc(reqBody)}</pre></div>
  <div><h3>Response body</h3><pre>${esc(JSON.stringify(s.json, null, 2))}</pre></div></div>
  ${s.before ? `<div class="dbs">${dbTable("Database SEBELUM", s.before)}${dbTable("Database SESUDAH", s.after)}</div>` : ""}
  <div class="foot">Render otomatis dari data yang direkam scripts/evidence.js (server Express + PostgreSQL asli). Bukan tangkapan layar aplikasi Postman/Bruno/Hoppscotch.</div>
  </div></body>`;
}

const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || "/opt/pw-browsers/chromium", args: ["--no-sandbox"] });
const page = await browser.newPage({ viewport: { width: 1100, height: 400 }, deviceScaleFactor: 2 });
for (const s of steps) {
  await page.setContent(html(s));
  await page.locator(".card").screenshot({ path: `docs/evidence/${s.id}.png` });
  console.log(`docs/evidence/${s.id}.png`);
}
await browser.close();
