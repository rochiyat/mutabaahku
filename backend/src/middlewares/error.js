import { HttpError } from '../lib/http-error.js';

export function notFoundHandler(_req, res) {
  res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Endpoint tidak ditemukan' } });
}

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, _req, res, _next) {
  if (err instanceof HttpError) {
    return res.status(err.status).json({
      error: { code: err.code, message: err.message, ...(err.details && { details: err.details }) },
    });
  }
  // serve-static passes the raw fs error (its message has server paths), so answer generically.
  if (err.status === 404 || err.statusCode === 404) {
    return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'File tidak ditemukan' } });
  }
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'JSON tidak valid' } });
  }
  console.error(err);
  res.status(500).json({ error: { code: 'INTERNAL', message: 'Terjadi kesalahan pada server' } });
}
