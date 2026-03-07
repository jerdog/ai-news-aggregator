-- Stories table for AI Native development & Agentic AI platforms news
CREATE TABLE IF NOT EXISTS stories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  external_id TEXT NOT NULL,
  title TEXT NOT NULL,
  url TEXT NOT NULL,
  source TEXT NOT NULL,
  topic TEXT NOT NULL CHECK (topic IN ('ai_native_development', 'agentic_ai_platforms')),
  published_at TEXT NOT NULL,
  discovered_at TEXT NOT NULL DEFAULT (datetime('now')),
  score REAL,
  summary TEXT,
  UNIQUE(external_id, source)
);

CREATE INDEX IF NOT EXISTS idx_stories_topic_published ON stories(topic, published_at DESC);
CREATE INDEX IF NOT EXISTS idx_stories_url ON stories(url);
