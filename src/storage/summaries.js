/**
 * D1 queries for summaries table.
 */

export async function getSummary(db, periodType, periodKey) {
  const row = await db
    .prepare('SELECT * FROM summaries WHERE period_type = ? AND period_key = ? LIMIT 1')
    .bind(periodType, periodKey)
    .first();
  return row;
}

export async function listSummaries(db, opts = {}) {
  let query = 'SELECT * FROM summaries WHERE 1=1';
  const params = [];
  if (opts.period_type) {
    query += ' AND period_type = ?';
    params.push(opts.period_type);
  }
  query += ' ORDER BY period_key DESC';
  const limit = Math.min(opts.limit ?? 200, 500);
  query += ' LIMIT ?';
  params.push(limit);
  const stmt = db.prepare(query);
  const result = params.length ? await stmt.bind(...params).all() : await stmt.all();
  return result.results ?? [];
}

export async function upsertSummary(db, periodType, periodKey, content) {
  await db
    .prepare(
      `INSERT INTO summaries (period_type, period_key, content) VALUES (?, ?, ?)
       ON CONFLICT(period_type, period_key) DO UPDATE SET content = excluded.content, created_at = datetime('now')`
    )
    .bind(periodType, periodKey, content)
    .run();
}
