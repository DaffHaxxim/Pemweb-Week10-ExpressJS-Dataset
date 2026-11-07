import { prisma } from "../../lib/prisma.js";
import { parseId, validateCreate, validateUpdate } from "../middleware/validate.js";

const PRISMA_NOT_FOUND = "P2025";

function notFound(id) {
  const error = new Error(`Produk dengan id ${id} tidak ditemukan`);
  error.status = 404;
  return error;
}

// GET /products
export async function getProducts(req, res) {
  const products = await prisma.product.findMany({ orderBy: { id: "asc" } });
  res.status(200).json(products);
}

// GET /products/:id
export async function getProductById(req, res) {
  const id = parseId(req.params.id);
  const product = await prisma.product.findUnique({ where: { id } });
  if (!product) throw notFound(id);
  res.status(200).json(product);
}

// POST /products  { name, price }
export async function createProduct(req, res) {
  const data = validateCreate(req.body);
  const product = await prisma.product.create({ data });
  res.status(201).json(product);
}

// PUT /products  { id, name, price }
export async function updateProduct(req, res) {
  const { id, data } = validateUpdate(req.body);
  try {
    const product = await prisma.product.update({ where: { id }, data });
    res.status(200).json(product);
  } catch (error) {
    if (error.code === PRISMA_NOT_FOUND) throw notFound(id);
    throw error;
  }
}

// DELETE /products/:id
export async function deleteProduct(req, res) {
  const id = parseId(req.params.id);
  try {
    const product = await prisma.product.delete({ where: { id } });
    res.status(200).json({ message: `Produk dengan id ${id} berhasil dihapus`, product });
  } catch (error) {
    if (error.code === PRISMA_NOT_FOUND) throw notFound(id);
    throw error;
  }
}
