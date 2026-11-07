import { prisma } from "../lib/prisma.js";

const products = [
  { name: "Buku Tulis", price: 5000 },
  { name: "Pulpen", price: 3000 },
  { name: "Spidol", price: 8000 },
];

const count = await prisma.product.count();
if (count === 0) {
  await prisma.product.createMany({ data: products });
  console.log(`Seed selesai: ${products.length} produk ditambahkan`);
} else {
  console.log(`Seed dilewati: tabel products sudah berisi ${count} data`);
}
await prisma.$disconnect();
