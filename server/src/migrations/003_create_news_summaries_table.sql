-- Create news_summaries table for centralized AI summaries
-- Cost optimization: One summary per article shared by all users

CREATE TABLE IF NOT EXISTS news_summaries (
  id SERIAL PRIMARY KEY,
  article_id VARCHAR(255) UNIQUE NOT NULL,
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  source VARCHAR(255),
  url TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP,
  ttl_ms BIGINT,
  created_by_device_id VARCHAR(50)
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_news_summaries_article_id ON news_summaries(article_id);
CREATE INDEX IF NOT EXISTS idx_news_summaries_expires_at ON news_summaries(expires_at);

-- Add comment
COMMENT ON TABLE news_summaries IS 'Centralized AI summaries for news articles - one summary per article shared by all users';










