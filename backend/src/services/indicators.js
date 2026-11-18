import { db } from '../db/knex.js';

/** Active indicators with their options, in form order. */
export async function listActiveIndicators(trx = db) {
  const indicators = await trx('indicators')
    .where({ is_active: true })
    .orderBy('sort_order')
    .select('id', 'code', 'label', 'type');
  const options = await trx('indicator_options')
    .whereIn('indicator_id', indicators.map((i) => i.id))
    .orderBy(['indicator_id', 'sort_order'])
    .select('id', 'indicator_id', 'label', 'score');

  return indicators.map((i) => ({
    ...i,
    options: options
      .filter((o) => o.indicator_id === i.id)
      .map(({ id, label, score }) => ({ id, label, score })),
  }));
}
