/**
 * AI News Aggregator — Worker entrypoint.
 * - fetch: GET /api/stories, GET /api/summaries, GET /ingest (manual), static assets (public/), else 404
 * - scheduled: daily ingestion + summary generation
 */

import { handleGetStories } from './api/stories.js';
import { handleGetSummaries } from './api/summaries.js';
import { runIngestion } from './ingestion/index.js';
import { ensureAllSummaries } from './summaries/generate.js';

export default {
  async fetch(request, env, _ctx) {
    const url = new URL(request.url);

    if (url.pathname === '/api/stories' && request.method === 'GET') {
      return handleGetStories(request, env);
    }

    if (url.pathname === '/api/summaries' && request.method === 'GET') {
      return handleGetSummaries(request, env);
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

    // Manual summary generation (yesterday's day; week if Sunday, month if 1st). Same auth as /ingest.
    if (url.pathname === '/ingest-summaries' && request.method === 'GET') {
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
        const summaries = await ensureAllSummaries(env);
        return new Response(JSON.stringify({ ok: true, generated: summaries?.length ?? 0, summaries: summaries ?? [] }), {
          headers: { 'Content-Type': 'application/json' },
        });
      } catch (err) {
        console.error('[ingest-summaries] error', err);
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
    console.log('[scheduled] started', { cron: event.cron, scheduledTime: event.scheduledTime });
    try {
      const result = await runIngestion(env);
      console.log('[ingestion] done', result);
      const summaries = await ensureAllSummaries(env);
      console.log('[summaries] ensured', summaries?.length ?? 0);
    } catch (err) {
      console.error('[scheduled] error', err);
      throw err;
    }
  },
};
