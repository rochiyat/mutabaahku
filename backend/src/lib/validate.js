import { badRequest } from './http-error.js';

/** Parse `data` with a zod schema or throw a 400 listing each invalid field. */
export function parse(schema, data) {
  const result = schema.safeParse(data);
  if (result.success) return result.data;
  const details = result.error.issues.map((i) => ({ field: i.path.join('.'), message: i.message }));
  throw badRequest('Data tidak valid', details);
}
