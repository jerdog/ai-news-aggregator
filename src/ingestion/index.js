/**
 * Ingestion orchestrator: run all fetchers, normalize, dedupe, insert into D1.
 * Called from the scheduled handler.
 */

import { insertStory, findStoryByUrl } from '../storage/stories.js';
import { fetchFromNewsApi } from './fetchers/newsapi.js';

/**
 * Run ingestion: fetch from Perigon for both topics, dedupe by URL (ignore duplicates), insert into D1.
 */
export async function runIngestion(env) {
  let added = 0;
  let skipped = 0;

  const [aiNative, agentic] = await Promise.all([
    fetchFromNewsApi(env, 'ai_native_development'),
    fetchFromNewsApi(env, 'agentic_ai_platforms'),
  ]);
  // Dedupe by URL so we only process each story once (same URL can appear in both topics)
  const byUrl = new Map();
  for (const s of [...aiNative, ...agentic]) byUrl.set(s.url, s);
  const rawStories = [...byUrl.values()];

  for (const raw of rawStories) {
    const existing = await findStoryByUrl(env.DB, raw.url);
    if (existing) {
      skipped++;
      continue;
    }
    await insertStory(env.DB, {
      external_id: raw.externalId,
      title: raw.title,
      url: raw.url,
      source: raw.source,
      topic: raw.topic,
      published_at: raw.publishedAt,
    });
    added++;
  }

  return { added, skipped };
}
