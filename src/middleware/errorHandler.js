export function notFoundHandler(req, res) {
  res.status(404).json({ error: `Route ${req.method} ${req.originalUrl} tidak ditemukan` });
}

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  // Body JSON rusak (dilempar oleh express.json()).
  if (err.type === "entity.parse.failed") {
    return res.status(400).json({ error: "Body bukan JSON yang valid" });
  }
  if (err.type === "entity.too.large") {
    return res.status(413).json({ error: "Body terlalu besar" });
  }
  if (err.status && err.status < 500) {
    const body = { error: err.message };
    if (err.details) body.details = err.details;
    return res.status(err.status).json(body);
  }
  console.error(err);
  res.status(500).json({ error: "Terjadi kesalahan pada server" });
}
