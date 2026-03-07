/**
 * GET /api/stories — list stories with optional filters.
 */

import { listStories } from '../storage/stories.js';

export async function handleGetStories(request, env) {
  const url = new URL(request.url);
  const topic = url.searchParams.get('topic');
  const since = url.searchParams.get('since') ?? undefined;
  const limit = parseInt(url.searchParams.get('limit') ?? '50', 10);
  const offset = parseInt(url.searchParams.get('offset') ?? '0', 10);

  const validTopics = ['ai_native_development', 'agentic_ai_platforms'];
  if (topic && !validTopics.includes(topic)) {
    return new Response(JSON.stringify({ error: 'Invalid topic' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const stories = await listStories(env.DB, {
    topic: topic ?? undefined,
    since,
    limit: Number.isNaN(limit) ? 50 : limit,
    offset: Number.isNaN(offset) ? 0 : offset,
  });

  return new Response(JSON.stringify({ stories }), {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=300',
    },
  });
}
