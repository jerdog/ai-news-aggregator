/**
 * GET /api/summaries — list all summaries (day, week, month) for the summaries page.
 */

import { listSummaries } from '../storage/summaries.js';

export async function handleGetSummaries(request, env) {
  const url = new URL(request.url);
  const periodType = url.searchParams.get('period_type');

  const summaries = await listSummaries(env.DB, {
    period_type: periodType || undefined,
    limit: 500,
  });

  return new Response(JSON.stringify({ summaries }), {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=60',
    },
  });
}
