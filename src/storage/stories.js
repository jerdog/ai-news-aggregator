/**
 * D1 queries for stories table.
 * Binding: env.DB
 * D1 only accepts primitives; coerce so we never bind objects.
 */
function toD1Value(v) {
  if (v == null) return null;
  if (typeof v === 'object') return typeof v.name === 'string' ? v.name : JSON.stringify(v);
  return typeof v === 'number' && !Number.isFinite(v) ? null : v;
}

export async function insertStory(db, story) {
  const discovered_at = new Date().toISOString();
  await db
    .prepare(
      `INSERT INTO stories (external_id, title, url, source, topic, published_at, discovered_at, score, summary)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      toD1Value(story.external_id),
      toD1Value(story.title),
      toD1Value(story.url),
      toD1Value(story.source),
      toD1Value(story.topic),
      toD1Value(story.published_at),
      discovered_at,
      story.score != null && Number.isFinite(story.score) ? story.score : null,
      toD1Value(story.summary)
    )
    .run();
}

export async function findStoryByUrl(db, url) {
  const row = await db
    .prepare('SELECT * FROM stories WHERE url = ? LIMIT 1')
    .bind(url)
    .first();
  return row;
}

export async function listStories(db, opts = {}) {
  const limit = Math.min(opts.limit ?? 50, 500);
  const offset = opts.offset ?? 0;

  let query = 'SELECT * FROM stories WHERE 1=1';
  const params = [];

  if (opts.topic) {
    query += ' AND topic = ?';
    params.push(opts.topic);
  }
  if (opts.since) {
    query += ' AND published_at >= ?';
    params.push(opts.since);
  }
  if (opts.until) {
    query += ' AND published_at <= ?';
    params.push(opts.until);
  }

  query += ' ORDER BY COALESCE(score, 0) DESC, published_at DESC LIMIT ? OFFSET ?';
  params.push(limit, offset);

  const stmt = db.prepare(query);
  const bound = params.length ? stmt.bind(...params) : stmt;
  const result = await bound.all();
  return result.results ?? [];
}
