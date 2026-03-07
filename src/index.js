/**
 * AI News Aggregator — Worker entrypoint.
 * - fetch: GET /api/stories, GET /ingest (manual), static assets (public/), else 404
 * - scheduled: weekly ingestion (Cron Trigger)
 */

import { handleGetStories } from './api/stories.js';
import { runIngestion } from './ingestion/index.js';

export default {
  async fetch(request, env, _ctx) {
    const url = new URL(request.url);

    if (url.pathname === '/api/stories' && request.method === 'GET') {
      return handleGetStories(request, env);
    }

    // Manual ingestion trigger (deployed worker). Requires INGEST_SECRET.
    if (url.pathname === '/ingest' && request.method === 'GET') {
      const secret = env.INGEST_SECRET;
      if (!secret) {
        return new Response(JSON.stringify({ error: 'Ingest not configured (INGEST_SECRET not set)' }), {
          status: 501,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      const key = url.searchParams.get('key') ?? request.headers.get('Authorization')?.replace(/^Bearer\s+/i, '');
      if (key !== secret) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      try {
        const result = await runIngestion(env);
        return new Response(JSON.stringify({ ok: true, ...result }), {
          headers: { 'Content-Type': 'application/json' },
        });
      } catch (err) {
        console.error('[ingest] error', err);
        return new Response(JSON.stringify({ error: err.message, ok: false }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    }

    // Static assets (public/index.html). Serve / as index.html.
    if (env.ASSETS && request.method === 'GET') {
      let assetReq = request;
      if (url.pathname === '/' || url.pathname === '') {
        assetReq = new Request(new URL('/index.html', url.origin), { method: 'GET' });
      }
      const asset = await env.ASSETS.fetch(assetReq);
      if (asset.status !== 404) return asset;
    }

    return new Response('Not Found', { status: 404 });
  },

  async scheduled(event, env, _ctx) {
    console.log('[ingestion] started', { cron: event.cron, scheduledTime: event.scheduledTime });
    try {
      const result = await runIngestion(env);
      console.log('[ingestion] done', result);
    } catch (err) {
      console.error('[ingestion] error', err);
      throw err;
    }
  },
};
