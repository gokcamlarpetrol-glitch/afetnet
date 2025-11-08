-- ELITE: Centralized AI Analysis Table
-- Stores AI analysis results for earthquakes (single analysis for all users)

CREATE TABLE IF NOT EXISTS earthquake_analyses (
  earthquake_id VARCHAR(255) PRIMARY KEY,
  risk_level VARCHAR(20) NOT NULL CHECK (risk_level IN ('low', 'medium', 'high', 'critical')),
  user_message TEXT NOT NULL,
  recommendations JSONB NOT NULL,
  verified BOOLEAN NOT NULL DEFAULT false,
  sources JSONB NOT NULL,
  confidence INTEGER NOT NULL CHECK (confidence >= 0 AND confidence <= 100),
  analyzed_at TIMESTAMP NOT NULL DEFAULT NOW(),
  ai_tokens_used INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_earthquake_analyses_analyzed_at ON earthquake_analyses(analyzed_at DESC);
CREATE INDEX IF NOT EXISTS idx_earthquake_analyses_risk_level ON earthquake_analyses(risk_level);

-- Comments
COMMENT ON TABLE earthquake_analyses IS 'Centralized AI analysis results for earthquakes (single analysis for all users)';
COMMENT ON COLUMN earthquake_analyses.earthquake_id IS 'Unique earthquake signature: timestamp-lat-lon-magnitude';
COMMENT ON COLUMN earthquake_analyses.ai_tokens_used IS 'Number of AI tokens used for this analysis (cost tracking)';

