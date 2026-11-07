// Pengujian integrasi: memakai PostgreSQL asli melalui DATABASE_URL.
// Jalankan: npm test  (tabel products dikosongkan sebelum pengujian dimulai).
import { after, before, describe, test } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { prisma } from "../lib/prisma.js";

const PORT = 3999;
const BASE = `http://localhost:${PORT}`;
let server;

async function startServer() {
  const child = spawn(process.execPath, ["src/server.js"], {
    env: { ...process.env, PORT: String(PORT) },
    stdio: ["ignore", "pipe", "inherit"],
  });
  await new Promise((resolve, reject) => {
    child.stdout.on("data", (chunk) => {
      if (String(chunk).includes("Server berjalan")) resolve();
    });
    child.once("exit", (code) => reject(new Error(`server berhenti (kode ${code})`)));
  });
  return child;
}

async function stopServer(child) {
  child.removeAllListeners("exit");
  child.kill("SIGTERM");
  await once(child, "exit");
}

async function call(method, path, body, raw) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: body !== undefined || raw !== undefined ? { "Content-Type": "application/json" } : {},
    body: raw ?? (body !== undefined ? JSON.stringify(body) : undefined),
  });
  return { status: res.status, body: await res.json() };
}

before(async () => {
  await prisma.product.deleteMany();
  server = await startServer();
});

after(async () => {
  await stopServer(server);
  await prisma.product.deleteMany();
  await prisma.$disconnect();
});

describe("GET /products", () => {
  test("200 dan array kosong saat tabel kosong", async () => {
    const res = await call("GET", "/products");
    assert.equal(res.status, 200);
    assert.deepEqual(res.body, []);
  });
});

describe("POST /products", () => {
  test("201 membuat produk dan menyimpannya ke database", async () => {
    const res = await call("POST", "/products", { name: "  Pulpen  ", price: 3000 });
    assert.equal(res.status, 201);
    assert.equal(res.body.name, "Pulpen");
    assert.equal(res.body.price, 3000);
    assert.ok(Number.isInteger(res.body.id));

    const inDb = await prisma.product.findUnique({ where: { id: res.body.id } });
    assert.equal(inDb.name, "Pulpen");
  });

  const invalid = [
    ["name hilang", { price: 100 }],
    ["name kosong", { name: "   ", price: 100 }],
    ["name bukan string", { name: 123, price: 100 }],
    ["name terlalu panjang", { name: "x".repeat(101), price: 100 }],
    ["price hilang", { name: "A" }],
    ["price string", { name: "A", price: "100" }],
    ["price desimal", { name: "A", price: 10.5 }],
    ["price negatif", { name: "A", price: -1 }],
    ["price melebihi batas INTEGER", { name: "A", price: 2147483648 }],
  ];
  for (const [label, payload] of invalid) {
    test(`400 untuk ${label}`, async () => {
      const res = await call("POST", "/products", payload);
      assert.equal(res.status, 400);
      assert.equal(res.body.error, "Validasi gagal");
      assert.ok(res.body.details.length > 0);
    });
  }

  test("400 untuk body bukan JSON valid", async () => {
    const res = await call("POST", "/products", undefined, "{rusak");
    assert.equal(res.status, 400);
    assert.equal(res.body.error, "Body bukan JSON yang valid");
  });

  test("400 untuk request tanpa body", async () => {
    const res = await call("POST", "/products");
    assert.equal(res.status, 400);
  });

  test("data tidak tersimpan ketika validasi gagal", async () => {
    const before = await prisma.product.count();
    await call("POST", "/products", { name: "", price: -5 });
    assert.equal(await prisma.product.count(), before);
  });
});

describe("GET /products/:id", () => {
  test("200 untuk id yang ada", async () => {
    const created = (await call("POST", "/products", { name: "Spidol", price: 8000 })).body;
    const res = await call("GET", `/products/${created.id}`);
    assert.equal(res.status, 200);
    assert.equal(res.body.name, "Spidol");
  });
  test("404 untuk id yang tidak ada", async () => {
    const res = await call("GET", "/products/999999");
    assert.equal(res.status, 404);
  });
  test("400 untuk id bukan angka", async () => {
    const res = await call("GET", "/products/abc");
    assert.equal(res.status, 400);
  });
});

describe("PUT /products", () => {
  test("200 mengubah produk dan perubahan tersimpan di database", async () => {
    const created = (await call("POST", "/products", { name: "Penghapus", price: 2000 })).body;
    const res = await call("PUT", "/products", { id: created.id, name: "Penghapus Besar", price: 2500 });
    assert.equal(res.status, 200);
    assert.equal(res.body.id, created.id);
    assert.equal(res.body.name, "Penghapus Besar");

    const inDb = await prisma.product.findUnique({ where: { id: created.id } });
    assert.equal(inDb.price, 2500);
    assert.ok(inDb.updatedAt >= inDb.createdAt);
  });
  test("404 untuk id yang tidak ada", async () => {
    const res = await call("PUT", "/products", { id: 999999, name: "X", price: 1 });
    assert.equal(res.status, 404);
  });
  test("400 jika id tidak ada di body", async () => {
    const res = await call("PUT", "/products", { name: "X", price: 1 });
    assert.equal(res.status, 400);
    assert.match(res.body.details[0], /id/);
  });
  test("400 jika id bukan integer", async () => {
    const res = await call("PUT", "/products", { id: "1", name: "X", price: 1 });
    assert.equal(res.status, 400);
  });
  test("400 jika name/price tidak valid dan data tidak berubah", async () => {
    const created = (await call("POST", "/products", { name: "Penggaris", price: 4000 })).body;
    const res = await call("PUT", "/products", { id: created.id, name: "", price: "abc" });
    assert.equal(res.status, 400);
    assert.equal(res.body.details.length, 2);
    const inDb = await prisma.product.findUnique({ where: { id: created.id } });
    assert.equal(inDb.name, "Penggaris");
  });
});

describe("DELETE /products/:id", () => {
  test("200 menghapus produk dari database", async () => {
    const created = (await call("POST", "/products", { name: "Stapler", price: 15000 })).body;
    const res = await call("DELETE", `/products/${created.id}`);
    assert.equal(res.status, 200);
    assert.equal(res.body.product.id, created.id);
    assert.equal(await prisma.product.findUnique({ where: { id: created.id } }), null);
    assert.equal((await call("GET", `/products/${created.id}`)).status, 404);
  });
  test("404 untuk id yang tidak ada", async () => {
    const res = await call("DELETE", "/products/999999");
    assert.equal(res.status, 404);
  });
  test("400 untuk id tidak valid", async () => {
    const res = await call("DELETE", "/products/-1");
    assert.equal(res.status, 400);
  });
});

describe("Route lain", () => {
  test("404 untuk route yang tidak dikenal", async () => {
    const res = await call("GET", "/tidak-ada");
    assert.equal(res.status, 404);
  });
});

describe("Persistensi setelah restart Express", () => {
  test("produk hasil POST masih tersedia setelah server dimulai ulang", async () => {
    const created = (await call("POST", "/products", { name: "Produk Restart", price: 7777 })).body;

    await stopServer(server);
    server = await startServer();

    const res = await call("GET", "/products");
    assert.equal(res.status, 200);
    const found = res.body.find((p) => p.id === created.id);
    assert.ok(found, "produk harus tetap ada setelah restart");
    assert.equal(found.name, "Produk Restart");
    assert.equal(found.price, 7777);
  });
});
