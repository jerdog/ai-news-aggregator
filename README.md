# AI News Aggregator

Weekly aggregation of top news about **AI Native development** and **Agentic AI platforms**, served as a viewable list. Built entirely on **Cloudflare** (Worker + D1 + Cron).

## Stack

- **Cloudflare Worker** — HTTP API + scheduled ingestion
- **D1** — SQLite at the edge for stories
- **Cron Trigger** — daily run (1:00 AM Central Time = 07:00 UTC)
- **Workers AI** — Gemma 3 12B for AI-generated summaries (day / week / month)

## Setup

1. **Install dependencies**

   ```bash
   npm install
   ```

2. **Create the D1 database**

   ```bash
   npm run db:create
   ```

   Copy the `database_id` from the output and set it in `wrangler.toml`:

   ```toml
   [[d1_databases]]
   binding = "DB"
   database_name = "ai-news-db"
   database_id = "your-database-id-here"
   ```

3. **Apply migrations**

   Local (for `wrangler dev`):

   ```bash
   npm run db:migrate
   ```

   Remote (for production):

   ```bash
   npm run db:migrate:remote
   ```

   After adding the `summaries` table (migration 0002), run migrations again so the new table exists.

4. **Optional: API keys (local dev)**

   The Worker reads **secrets from `.dev.vars`** when you run `npm run dev` — **not from `.env`**. Copy the example and add keys when you add news sources:

   ```bash
   cp .dev.vars.example .dev.vars
   ```

   In `.dev.vars` (never commit this file):

   ```
   PERIGON_API_KEY=your_perigon_key_here
   ```

   For **production**, set secrets with:

   ```bash
   npx wrangler secret put PERIGON_API_KEY
   npx wrangler secret put INGEST_SECRET   # optional: for manual /ingest trigger (see below)
   ```

## Development

```bash
npm run dev
```

- **API:** <http://localhost:8787/api/stories>
  Query params: `topic` (`ai_native_development` | `agentic_ai_platforms`), `since`, `limit`, `offset`
- **Trigger cron manually:**
  `curl "http://localhost:8787/__scheduled?cron=0+7+*+*+*"`

## Checking that ingestion works

1. **Start the Worker** (in one terminal):

   ```bash
   npm run dev
   ```

2. **Run the ingestion job** (in another terminal).    This triggers the same code the daily cron runs:

   ```bash
   curl "http://localhost:8787/__scheduled?cron=0+7+*+*+*"
   ```

   You should see a response (e.g. no body or 204). In the `npm run dev` terminal you should see logs like `[ingestion] started` and `[ingestion] done { added: N, skipped: 0 }`.

3. **List stored stories**:

   ```bash
   curl "http://localhost:8787/api/stories"
   ```

   Or open <http://localhost:8787/api/stories> in a browser. You should get JSON like `{ "stories": [ ... ] }` with titles, URLs, and topics.

4. **Optional — filter by topic**:

   ```bash
   curl "http://localhost:8787/api/stories?topic=ai_native_development"
   curl "http://localhost:8787/api/stories?topic=agentic_ai_platforms"
   ```

   If `added` is 0, check that `PERIGON_API_KEY` (or `NEWSAPI_KEY`) is in `.dev.vars` and that the Perigon API returns articles for your query (e.g. test with your curl to `api.perigon.io/v1/articles/all`).

## Deploy

```bash
npm run deploy
```

Ensure remote migrations are applied before or after first deploy:

```bash
npm run db:migrate:remote
```

## Checking the deployed Worker

1. **Get your Worker URL**
   After `npm run deploy`, Wrangler prints it. It’s usually:
   - **workers.dev:** `https://ai-news-aggregator.<your-subdomain>.workers.dev`
   - Or your **custom domain** if you set one in `wrangler.toml`.
   You can also find it in the Cloudflare dashboard: Workers & Pages → your worker → overview.

2. **Hit the API** (same as local, with the deployed base URL):

   ```bash
   curl "https://YOUR-WORKER-URL/api/stories"
   ```

   Or open `https://YOUR-WORKER-URL/api/stories` in a browser. You should get `{ "stories": [ ... ] }`.

   Filter by topic:

   ```bash
   curl "https://YOUR-WORKER-URL/api/stories?topic=ai_native_development"
   curl "https://YOUR-WORKER-URL/api/stories?topic=agentic_ai_platforms"
   ```

3. **Run ingestion on demand (don’t wait for the daily cron)**
   If you set a secret `INGEST_SECRET`, you can trigger ingestion once from the deployed worker:

   ```bash
   # Set once (use a random string; e.g. openssl rand -hex 24)
   npx wrangler secret put INGEST_SECRET

   # Then trigger (replace YOUR_SECRET with the value you set, and YOUR-WORKER-URL with your worker URL)
   curl "https://YOUR-WORKER-URL/ingest?key=YOUR_SECRET"
   ```

   Response: `{ "ok": true, "added": 42, "skipped": 0 }`. Then reload `https://YOUR-WORKER-URL/api/stories` — you should see the new stories.

   To generate AI summaries for the previous day (and, if applicable, last week/month), call the same secret on the summaries endpoint:

   ```bash
   curl "https://YOUR-WORKER-URL/ingest-summaries?key=YOUR_SECRET"
   ```

   Response: `{ "ok": true, "generated": 1, "summaries": [...] }`. Then open `https://YOUR-WORKER-URL/summaries.html` to see the digest.

4. **When does ingestion run automatically?**
   The **cron runs daily at 1:00 AM Central Time (07:00 UTC)**. Until then (or until you call `/ingest`), `/api/stories` can be empty.

5. **Watch production logs when the cron runs** (optional):

   ```bash
   npx wrangler tail
   ```

   Leave this running; when the daily cron fires you’ll see `[ingestion] started` and `[ingestion] done` in the stream.

**Checklist for a new deploy:** Set `PERIGON_API_KEY` and optionally `INGEST_SECRET` in production, run `npm run db:migrate:remote`, then `npm run deploy`. Trigger once with `curl "https://YOUR-WORKER-URL/ingest?key=YOUR_INGEST_SECRET"`, then open `https://YOUR-WORKER-URL/api/stories`.

## AI Summaries

The **Summaries** page (`/summaries.html`) shows AI-generated digests (Cloudflare Workers AI, `@cf/google/gemma-3-12b-it`) for:

- **Day** — yesterday’s articles (generated daily)
- **Week** — last full week Sunday–Saturday (generated each Sunday)
- **Month** — last full calendar month (generated on the 1st)

Summaries are stored in the `summaries` D1 table. As cron runs over time, more day/week/month entries appear on the page. The daily cron runs ingestion first, then ensures summaries exist for yesterday (and, when applicable, last week or last month). You can trigger summary generation on demand (e.g. after running `/ingest`) with `GET /ingest-summaries?key=YOUR_INGEST_SECRET`.

**Perigon limit:** The Perigon API allows at most 300 documents per query. Ingestion is capped at 300 articles per topic (last 7 days) to avoid 400 errors.

## Project layout

- `src/index.js` — fetch + scheduled handlers
- `src/api/stories.js` — GET /api/stories
- `src/api/summaries.js` — GET /api/summaries
- `src/ingestion/` — Perigon fetcher + orchestration
- `src/summaries/` — period helpers + AI generation (Gemma 3 12B)
- `src/storage/stories.js` — D1 stories
- `src/storage/summaries.js` — D1 summaries
- `migrations/` — D1 schema (0001 stories, 0002 summaries)
- `public/index.html` — article list; `public/summaries.html` — summaries page

See **[DEVELOPMENT_PLAN.md](./DEVELOPMENT_PLAN.md)** for the full roadmap (phases, sources, and UI).
