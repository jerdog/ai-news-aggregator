/**
 * Perigon news fetcher — uses env.PERIGON_API_KEY (or env.NEWSAPI_KEY as fallback).
 * Base: https://api.perigon.io/v1/
 */

const TOPIC_QUERIES = {
  ai_native_development: 'AI native development OR "AI-native development"',
  agentic_ai_platforms: 'agentic AI platforms OR "agentic AI"',
};

/**
 * Fetch stories from Perigon for one topic.
 * @param {object} env - Worker env (PERIGON_API_KEY or NEWSAPI_KEY)
 * @param {'ai_native_development'|'agentic_ai_platforms'} topic
 * @returns {Promise<Array<{externalId:string, title:string, url:string, source:string, topic:string, publishedAt:string}>>}
 */
export async function fetchFromNewsApi(env, topic) {
  const apiKey = env.PERIGON_API_KEY ?? env.NEWSAPI_KEY;
  if (!apiKey) {
    console.warn('[perigon] PERIGON_API_KEY (or NEWSAPI_KEY) not set, skipping');
    return [];
  }

  const query = TOPIC_QUERIES[topic];
  if (!query) return [];

  const from = new Date();
  from.setDate(from.getDate() - 7);
  const fromStr = from.toISOString().slice(0, 10);

  const PAGE_SIZE = 100;
  const MAX_PAGES = 100; // safety cap: up to 10k articles per topic
  const allArticles = [];

  for (let page = 1; page <= MAX_PAGES; page++) {
    const url = new URL('https://api.perigon.io/v1/articles/all');
    url.searchParams.set('q', query);
    url.searchParams.set('apiKey', apiKey);
    url.searchParams.set('size', String(PAGE_SIZE));
    url.searchParams.set('from', fromStr);
    url.searchParams.set('page', String(page));

    const res = await fetch(url.toString());
    if (!res.ok) {
      console.error('[perigon] request failed', res.status, await res.text());
      break;
    }

    const data = await res.json();
    const articles = data.articles ?? data.results ?? [];
    if (!Array.isArray(articles)) break;

    allArticles.push(...articles);
    if (articles.length < PAGE_SIZE) break;
  }

  const articles = allArticles;

  const toDateStr = (v) => {
    if (v == null) return new Date().toISOString();
    if (typeof v === 'string') return v;
    if (typeof v === 'number') return new Date(v).toISOString();
    if (v instanceof Date) return v.toISOString();
    return new Date().toISOString();
  };

  return articles
    .filter((a) => a?.url && a?.title)
    .map((a) => {
      const sourceVal = a.source;
      let sourceStr = 'Unknown';
      if (typeof sourceVal === 'string') sourceStr = sourceVal;
      else if (sourceVal && typeof sourceVal === 'object') {
        if (sourceVal.name != null) sourceStr = String(sourceVal.name);
        else if (sourceVal.domain != null) sourceStr = String(sourceVal.domain);
      }
      return {
        externalId: String(a.url || a.id || `${sourceStr}-${Date.now()}`),
        title: String(a.title),
        url: String(a.url),
        source: sourceStr,
        topic,
        publishedAt: toDateStr(a.pubDate ?? a.publishedAt ?? a.published),
      };
    });
}
