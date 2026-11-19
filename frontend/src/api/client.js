import axios from 'axios';

export const api = axios.create({
  baseURL: '/api',
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
});

export const errorCode = (err) => err?.response?.data?.error?.code;

export function errorMessage(err, fallback = 'Terjadi kesalahan, coba lagi') {
  if (err?.response?.data?.error?.message) return err.response.data.error.message;
  if (err?.request && !err.response) return 'Tidak dapat terhubung ke server';
  return fallback;
}

/** `{ field: message }` from a 400 response's details. */
export function fieldErrors(err) {
  const details = err?.response?.data?.error?.details ?? [];
  return Object.fromEntries(details.map((d) => [d.field, d.message]));
}
