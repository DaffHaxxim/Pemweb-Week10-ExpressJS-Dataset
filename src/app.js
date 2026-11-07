import express from "express";
import productRoutes from "./routes/productRoutes.js";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler.js";

const app = express();

app.use(express.json());

app.get("/", (req, res) => {
  res.json({ message: "API Produk - ExpressJS + Prisma + PostgreSQL", endpoint: "/products" });
});

app.use("/products", productRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

export default app;
