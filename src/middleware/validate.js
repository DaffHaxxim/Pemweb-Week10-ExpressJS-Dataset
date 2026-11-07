const MAX_NAME_LENGTH = 100;
const MAX_PRICE = 2147483647; // batas tipe INTEGER PostgreSQL

export class ValidationError extends Error {
  constructor(details) {
    super("Validasi gagal");
    this.name = "ValidationError";
    this.status = 400;
    this.details = details;
  }
}

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function parseId(value, field = "id") {
  const id = typeof value === "string" && /^\d+$/.test(value) ? Number(value) : value;
  if (!Number.isSafeInteger(id) || id < 1 || id > MAX_PRICE) {
    throw new ValidationError([`${field} harus berupa bilangan bulat positif`]);
  }
  return id;
}

// Validasi name dan price (dipakai POST dan PUT).
function collectProductErrors(body) {
  const errors = [];

  if (typeof body.name !== "string" || body.name.trim() === "") {
    errors.push("name wajib diisi dan berupa teks tidak kosong");
  } else if (body.name.trim().length > MAX_NAME_LENGTH) {
    errors.push(`name maksimal ${MAX_NAME_LENGTH} karakter`);
  }

  if (typeof body.price !== "number" || !Number.isInteger(body.price)) {
    errors.push("price wajib diisi dan berupa bilangan bulat");
  } else if (body.price < 0 || body.price > MAX_PRICE) {
    errors.push(`price harus antara 0 dan ${MAX_PRICE}`);
  }

  return errors;
}

export function validateCreate(body) {
  if (!isPlainObject(body)) {
    throw new ValidationError(["body harus berupa objek JSON dengan name dan price"]);
  }
  const errors = collectProductErrors(body);
  if (errors.length > 0) throw new ValidationError(errors);
  return { name: body.name.trim(), price: body.price };
}

// PUT: body sama dengan POST ditambah id.
export function validateUpdate(body) {
  if (!isPlainObject(body)) {
    throw new ValidationError(["body harus berupa objek JSON dengan id, name, dan price"]);
  }
  const errors = collectProductErrors(body);
  if (!Number.isSafeInteger(body.id) || body.id < 1 || body.id > MAX_PRICE) {
    errors.unshift("id wajib diisi dan berupa bilangan bulat positif");
  }
  if (errors.length > 0) throw new ValidationError(errors);
  return { id: body.id, data: { name: body.name.trim(), price: body.price } };
}
