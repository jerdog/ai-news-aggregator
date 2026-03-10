/**
 * Generate AI summary for a period using Cloudflare Workers AI (@cf/google/gemma-3-12b-it).
 */

import { listStories } from '../storage/stories.js';
import { getSummary, upsertSummary } from '../storage/summaries.js';
import { yesterdayKey, yesterdayRange, lastWeekKeyAndRange, lastMonthKeyAndRange } from './periods.js';

const MODEL = '@cf/google/gemma-3-12b-it';

function buildPrompt(articles, periodLabel) {
  const list = articles
    .slice(0, 150)
    .map((a, i) => `${i + 1}. ${a.title}\n   URL: ${a.url}\n   Source: ${a.source}`)
    .join('\n\n');
  return `You are summarizing news about AI Native development and Agentic AI platforms for a digest.

Below are the top articles for ${periodLabel}. Write a concise summary (2–4 short paragraphs) that:
- Highlights the main themes and developments.
- Includes markdown links to the articles where relevant, using the exact URLs from the list above in format [description](url).
- Is readable and scannable.

Articles:
${list}

Write only the summary, in markdown. Use real URLs from the list above for links.`;
}

function extractText(response) {
  if (typeof response === 'string') return response;
  if (response?.response) return response.response;
  if (response?.result?.response) return response.result.response;
  if (response?.result) return typeof response.result === 'string' ? response.result : JSON.stringify(response.result);
  return JSON.stringify(response);
}

export async function ensureSummaryForPeriod(env, periodType) {
  const db = env.DB;
  const ai = env.AI;
  if (!ai) {
    console.warn('[summaries] AI binding not configured');
    return null;
  }

  let periodKey;
  let since;
  let until;
  let periodLabel;

  if (periodType === 'day') {
    periodKey = yesterdayKey();
    const r = yesterdayRange();
    since = r.since;
    until = r.until;
    periodLabel = `the day of ${periodKey}`;
  } else if (periodType === 'week') {
    const r = lastWeekKeyAndRange();
    periodKey = r.key;
    since = r.since;
    until = r.until;
    periodLabel = `the week starting ${periodKey} (Sunday–Saturday)`;
  } else if (periodType === 'month') {
    const r = lastMonthKeyAndRange();
    periodKey = r.key;
    since = r.since;
    until = r.until;
    periodLabel = `the month ${periodKey}`;
  } else {
    return null;
  }

  const existing = await getSummary(db, periodType, periodKey);
  if (existing?.content) return existing;

  const stories = await listStories(db, { since, until, limit: 500 });
  if (stories.length === 0) {
    await upsertSummary(db, periodType, periodKey, `_No articles in this period._`);
    return { period_type: periodType, period_key: periodKey, content: '_No articles in this period._' };
  }

  const prompt = buildPrompt(stories, periodLabel);
  const messages = [
    { role: 'system', content: 'You write concise news digests in markdown with working links. Output only the summary, no preamble.' },
    { role: 'user', content: prompt },
  ];

  const response = await ai.run(MODEL, {
    messages,
    max_tokens: 1024,
  });
  const content = extractText(response) || '_Summary unavailable._';
  await upsertSummary(db, periodType, periodKey, content);
  return { period_type: periodType, period_key: periodKey, content };
}

export async function ensureAllSummaries(env) {
  const now = new Date();
  const results = [];
  const day = await ensureSummaryForPeriod(env, 'day');
  if (day) results.push(day);
  if (now.getUTCDay() === 0) {
    const week = await ensureSummaryForPeriod(env, 'week');
    if (week) results.push(week);
  }
  if (now.getUTCDate() === 1) {
    const month = await ensureSummaryForPeriod(env, 'month');
    if (month) results.push(month);
  }
  return results;
}
